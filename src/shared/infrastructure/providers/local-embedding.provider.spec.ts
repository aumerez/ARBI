import { Test, TestingModule } from '@nestjs/testing';
import { LocalEmbeddingProvider } from './local-embedding.provider';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';

describe('LocalEmbeddingProvider', () => {
  let provider: LocalEmbeddingProvider;
  let httpService: HttpService;
  let configService: ConfigService;

  beforeEach(async () => {
    const mockHttpService = {
      post: jest.fn(),
    };

    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        LocalEmbeddingProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'OLLAMA_HOST') return 'http://localhost:11434';
              return undefined;
            }),
          },
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    provider = testingModule.get<LocalEmbeddingProvider>(LocalEmbeddingProvider);
    httpService = testingModule.get<HttpService>(HttpService);
    configService = testingModule.get<ConfigService>(ConfigService);

    // Reset mock before each test
    (httpService.post as jest.Mock).mockReset();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('constructor', () => {
    it('should initialize with ConfigService and HttpService', () => {
      expect(provider).toBeInstanceOf(LocalEmbeddingProvider);
    });

    it('should read OLLAMA_HOST from config with default', () => {
      const customProvider = new LocalEmbeddingProvider(
        { get: (key: string) => (key === 'OLLAMA_HOST' ? 'http://custom:11434' : undefined) } as ConfigService,
        {} as any
      );
      expect((customProvider as any).ollamaHost).toBe('http://custom:11434');
    });

    it('should default OLLAMA_HOST to localhost:11434', () => {
      expect(provider).toBeDefined();
    });
  });

  describe('generateEmbeddings', () => {
    it('should return empty array for empty input', async () => {
      const result = await provider.generateEmbeddings([]);
      expect(result).toEqual([]);
    });

    it('should call Ollama /api/embed with correct payload', async () => {
      const mockResponse = { embeddings: [[0.1, 0.2, 0.3]] };

      (httpService.post as jest.Mock).mockReturnValue(of({ data: mockResponse }));

      const result = await provider.generateEmbeddings(['test text']);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/embed',
        {
          model: 'nomic-embed-text',
          input: ['test text'],
        },
        { timeout: 30000 }
      );
      expect(result).toEqual([[0.1, 0.2, 0.3]]);
    });

    it('should use nomic-embed-text model', async () => {
      const mockResponse = { embeddings: [[0.1]] };
      (httpService.post as jest.Mock).mockReturnValue(of({ data: mockResponse }));

      await provider.generateEmbeddings(['test']);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/embed'),
        expect.objectContaining({
          model: 'nomic-embed-text',
        }),
        expect.any(Object)
      );
    });

    it('should handle multiple texts', async () => {
      const mockResponse = {
        embeddings: [[0.1, 0.2], [0.3, 0.4]],
      };
      (httpService.post as jest.Mock).mockReturnValue(of({ data: mockResponse }));

      const result = await provider.generateEmbeddings(['text1', 'text2']);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/embed'),
        expect.objectContaining({
          input: ['text1', 'text2'],
        }),
        expect.any(Object)
      );
      expect(result).toHaveLength(2);
    });

    it('should throw error when embeddings count mismatches', async () => {
      const mockResponse = { embeddings: [[0.1]] }; // only 1 embedding for 2 texts
      (httpService.post as jest.Mock).mockReturnValue(of({ data: mockResponse }));

      await expect(provider.generateEmbeddings(['text1', 'text2'])).rejects.toThrow(
        'Embedding count mismatch'
      );
    });

    it('should handle HTTP errors', async () => {
      (httpService.post as jest.Mock).mockReturnValue(
        throwError(() => new Error('Connection refused'))
      );

      await expect(provider.generateEmbeddings(['test'])).rejects.toThrow(
        'Local embedding provider error'
      );
    });

    it('should log errors when request fails', async () => {
      // Spy on the provider's logger.error (use any to bypass TS access modifier)
      const loggerErrorSpy = jest.spyOn((provider as any).logger, 'error');
      (httpService.post as jest.Mock).mockReturnValue(
        throwError(() => new Error('Ollama not responding'))
      );

      await expect(provider.generateEmbeddings(['test'])).rejects.toThrow('Local embedding provider error');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Ollama embedding request failed')
      );
      loggerErrorSpy.mockRestore();
    });
  });
});
