import { Test, TestingModule } from '@nestjs/testing';
import { OpenAIEmbeddingProvider } from './openai-embedding.provider';
import { ConfigService } from '@nestjs/config';

// Mock the openai module
const mockEmbeddingsCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    embeddings: {
      create: mockEmbeddingsCreate,
    },
  }));
});

// Import after mocking
import OpenAI from 'openai';

describe('OpenAIEmbeddingProvider', () => {
  let provider: OpenAIEmbeddingProvider;
  let configService: ConfigService;

  beforeEach(async () => {
    mockEmbeddingsCreate.mockReset();
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
    });

    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAIEmbeddingProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('sk-test-key'),
          },
        },
      ],
    }).compile();

    provider = testingModule.get<OpenAIEmbeddingProvider>(OpenAIEmbeddingProvider);
    configService = testingModule.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('constructor', () => {
    it('should initialize with ConfigService and create OpenAI client', () => {
      expect(provider).toBeInstanceOf(OpenAIEmbeddingProvider);
      expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'sk-test-key' });
    });

    it('should throw error if OPENAI_API_KEY is missing', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            OpenAIEmbeddingProvider,
            {
              provide: ConfigService,
              useValue: {
                get: jest.fn().mockImplementation((key: string) => {
                  if (key === 'OPENAI_API_KEY') return undefined;
                  return 'default';
                }),
              },
            },
          ],
        }).compile()
      ).rejects.toThrow('OPENAI_API_KEY is required');
    });
  });

  describe('generateEmbeddings', () => {
    const mockEmbeddingResponse = {
      data: [
        { embedding: [0.1, 0.2, 0.3] },
        { embedding: [0.4, 0.5, 0.6] },
      ],
    };

    beforeEach(() => {
      mockEmbeddingsCreate.mockResolvedValue(mockEmbeddingResponse);
    });

    it('should return empty array for empty input', async () => {
      const result = await provider.generateEmbeddings([]);
      expect(result).toEqual([]);
    });

    it('should batch requests into chunks of BATCH_SIZE (100)', async () => {
      const largeInput = Array(250).fill('test text');
      mockEmbeddingsCreate.mockResolvedValue({
        data: Array(100).fill({ embedding: [0.1] }),
      });

      await provider.generateEmbeddings(largeInput);

      // Should be called 3 times: 100 + 100 + 50
      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(3);
    });

    it('should call OpenAI embeddings.create with correct model', async () => {
      await provider.generateEmbeddings(['test']);

      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-large',
        input: ['test'],
      });
    });

    it('should add delay between batches when processing multiple batches', async () => {
      jest.useFakeTimers();

      const largeInput = Array(150).fill('test');
      mockEmbeddingsCreate.mockResolvedValue({
        data: Array(100).fill({ embedding: [0.1] }),
      });

      const promise = provider.generateEmbeddings(largeInput);
      await Promise.resolve();

      // First batch called immediately
      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1);

      // Advance time by 100ms
      jest.advanceTimersByTime(100);
      await promise;

      // Should have called twice (100 + 50)
      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should return 3072-dimensional embeddings', async () => {
      const largeEmbedding = Array(3072).fill(0.1);
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: largeEmbedding }],
      });

      const result = await provider.generateEmbeddings(['test']);
      expect(result[0].length).toBe(3072);
    });

    it('should log errors when OpenAI request fails', async () => {
      // Spy on the provider's logger.error method (using any to access protected member in test)
      const loggerErrorSpy = jest.spyOn((provider as any).logger, 'error');

      mockEmbeddingsCreate.mockRejectedValue(new Error('OpenAI API error'));

      await expect(
        provider.generateEmbeddings(['test'])
      ).rejects.toThrow('OpenAI API error');

      expect(loggerErrorSpy).toHaveBeenCalled();
      loggerErrorSpy.mockRestore();
    });

    it('should handle rate limit errors (429) with logging', async () => {
      // Spy on the provider's logger.error method (using any to access protected member in test)
      const loggerErrorSpy = jest.spyOn((provider as any).logger, 'error');

      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;
      mockEmbeddingsCreate.mockRejectedValue(rateLimitError);

      await expect(
        provider.generateEmbeddings(['test'])
      ).rejects.toThrow('Rate limit exceeded');

      expect(loggerErrorSpy).toHaveBeenCalled();
      loggerErrorSpy.mockRestore();
    });
  });
});
