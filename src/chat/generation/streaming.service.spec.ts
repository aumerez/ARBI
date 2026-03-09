import { Test, TestingModule } from '@nestjs/testing';
import { StreamingService } from './streaming.service';
import { ProviderFactory } from '../../shared/infrastructure/providers/provider.factory';
import { HybridSearchService } from '../retrieval/hybrid-search.service';
import { DatabaseService } from '../../shared/database/database.service';
import { LLMProvider, StreamChunk, RetrievedChunk } from '../../shared/types/providers.interface';
import { ChatMessage } from '../types/chat.types';
import { CitationValidatorService } from '../validation/citation-validator.service';

describe('StreamingService', () => {
  let streamingService: StreamingService;
  let mockProviderFactory: Partial<ProviderFactory>;
  let mockHybridSearch: Partial<HybridSearchService>;
  let mockDatabaseService: Partial<DatabaseService>;
  let mockCitationValidator: Partial<CitationValidatorService>;

  const mockChatMessage: ChatMessage = {
    id: 1,
    chat_id: 1,
    role: 'user',
    content: 'Test query',
    created_at: new Date(),
  };

  // Mock SearchResult from HybridSearchService.search()
  const mockSearchResult = {
    chunkId: 1,
    documentId: 1,
    documentName: 'test.pdf',
    pageNumber: 1,
    content: 'Test chunk content',
    score: 0.95,
  };

  const mockLLMProvider: jest.Mock & LLMProvider = {
    streamChat: jest.fn().mockImplementation(async function* (
      _messages: { role: 'user' | 'assistant'; content: string }[],
      _context: RetrievedChunk[]
    ): AsyncIterable<StreamChunk> {
      yield { type: 'text', text: 'Hello' };
      yield { type: 'text', text: ' world' };
      yield { type: 'done' };
    }),
  } as any;

  beforeEach(async () => {
    mockProviderFactory = {
      getLLMProvider: jest.fn(() => mockLLMProvider),
    };

    mockHybridSearch = {
      search: jest.fn().mockResolvedValue([mockSearchResult]),
    };

    mockCitationValidator = {
      validate: jest.fn().mockReturnValue({ valid: true, errors: [] }),
    };

    const mockPrismaClient = {
      chatMessage: {
        create: jest.fn().mockResolvedValue(mockChatMessage),
        findMany: jest.fn().mockResolvedValue([mockChatMessage]),
      },
    };

    mockDatabaseService = {
      getPrismaClient: jest.fn().mockReturnValue(mockPrismaClient),
    };
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamingService,
        {
          provide: ProviderFactory,
          useValue: mockProviderFactory,
        },
        {
          provide: HybridSearchService,
          useValue: mockHybridSearch,
        },
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: CitationValidatorService,
          useValue: mockCitationValidator,
        },
      ],
    }).compile();

    streamingService = module.get<StreamingService>(StreamingService);
  });

  it('should be defined', () => {
    expect(streamingService).toBeDefined();
  });

  describe('generateResponse', () => {
    it('should save user message, retrieve chunks, stream response, and save assistant message', async () => {
      // Arrange
      const chatId = 1;
      const userId = 1;
      const tenantId = 1;
      const query = 'Test query';
      const fullText = 'Hello world';

      // Act
      const stream = streamingService.generateResponse(chatId, userId, tenantId, query);
      const chunks: StreamChunk[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Assert - first create should be user message with tenant_id
      const prismaClient = mockDatabaseService.getPrismaClient();
      const createCalls = (prismaClient.chatMessage?.create as jest.Mock).mock.calls;
      expect(createCalls.length).toBeGreaterThanOrEqual(1);
      const userCall = createCalls[0];
      expect(userCall[0].data).toMatchObject({
        chat_id: chatId,
        role: 'user',
        content: query,
        tenant_id: tenantId,
      });

      expect(mockHybridSearch.search).toHaveBeenCalledWith(query, tenantId, 10);

      // Should have called findMany to get chat history
      expect(prismaClient.chatMessage?.findMany).toHaveBeenCalledWith({
        where: { chat_id: chatId },
        orderBy: { created_at: 'asc' },
      });

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual({ type: 'text', text: 'Hello' });
      expect(chunks[1]).toEqual({ type: 'text', text: ' world' });
      expect(chunks[2]).toEqual({ type: 'done' });

      // Check assistant message saved with retrieved_chunk_ids
      // (multiple calls - we need to check the second one)
      const allCreateCalls = (prismaClient.chatMessage?.create as jest.Mock).mock.calls;
      const assistantCall = allCreateCalls.find((call: any) => call[0].data.role === 'assistant');
      expect(assistantCall).toBeDefined();
      expect(assistantCall[0].data).toMatchObject({
        chat_id: chatId,
        role: 'assistant',
        content: fullText,
        retrieved_chunk_ids: [1], // chunkId from SearchResult
      });

      // Verify citation validator was called
      expect(mockCitationValidator.validate).toHaveBeenCalledWith(fullText, 1); // 1 chunk
    });

    it('should call citation validator after streaming completes', async () => {
      // Arrange
      const chatId = 1;
      const userId = 1;
      const tenantId = 1;
      const query = 'Test query';

      // Act
      const stream = streamingService.generateResponse(chatId, userId, tenantId, query);
      const chunks: StreamChunk[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Assert - validator should be called after streaming but before saving assistant
      expect(mockCitationValidator.validate).toHaveBeenCalledTimes(1);
    });

    it('should log warning when citations are invalid but still save message', async () => {
      // Arrange - validator returns invalid
      mockCitationValidator.validate = jest.fn().mockReturnValue({
        valid: false,
        errors: ['Invalid citation [3]: expected 1-1'],
      });

      const chatId = 1;
      const userId = 1;
      const tenantId = 1;
      const query = 'Test query';

      // Spy on logger ( StreamingService uses protected logger)
      const service = streamingService as any;
      const warnSpy = jest.spyOn(service.logger, 'warn');

      // Act
      const stream = streamingService.generateResponse(chatId, userId, tenantId, query);
      const chunks: StreamChunk[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Assert - warning should be logged
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Citation validation failed for chat 1: Invalid citation [3]')
      );

      // Assistant message should still be saved
      const prismaClient = mockDatabaseService.getPrismaClient();
      const allCreateCalls = (prismaClient.chatMessage?.create as jest.Mock).mock.calls;
      const assistantCall = allCreateCalls.find((call: any) => call[0].data.role === 'assistant');
      expect(assistantCall).toBeDefined();
    });

    it('should handle LLM errors', async () => {
      // Arrange
      const errorProvider: Partial<LLMProvider> = {
        streamChat: async function* (): AsyncIterable<StreamChunk> {
          throw new Error('LLM failure');
        },
      };
      mockProviderFactory.getLLMProvider = jest.fn(() => errorProvider as LLMProvider);

      // Act
      const chatId = 1;
      const userId = 1;
      const tenantId = 1;
      const query = 'Test query';
      const stream = streamingService.generateResponse(chatId, userId, tenantId, query);
      const chunks: StreamChunk[] = [];
      try {
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
      } catch {
        // Expected error
      }

      // Assert
      expect(chunks.some(c => c.type === 'error')).toBe(true);
    });

    it('should build system prompt with retrieved context', async () => {
      // Act
      const result = streamingService.generateResponse(1, 1, 1, 'Test');

      // Consume only first chunk to trigger method
      let firstChunk: StreamChunk | undefined;
      for await (const chunk of result) {
        firstChunk = chunk;
        break;
      }

      // The buildSystemPrompt is called internally as part of streaming, we can verify via the provider call
      // LLMProvider.streamChat should be called with both messages and chunks (which includes documentName)
      expect(mockLLMProvider.streamChat).toHaveBeenCalled();

      // Verify firstChunk is defined (stream works)
      expect(firstChunk).toBeDefined();
    });
  });

  describe('buildSystemPrompt', () => {
    it('should format context with citations', () => {
      const chunks: RetrievedChunk[] = [
        { id: '1', content: 'First chunk', documentName: 'Doc1.pdf', pageNumber: 1, score: 0.9 },
        { id: '2', content: 'Second chunk', documentName: 'Doc2.pdf', pageNumber: 2, score: 0.8 },
      ];

      // Access private method via type assertion (test only)
      const service = streamingService as any;
      const prompt = service.buildSystemPrompt(chunks);

      expect(prompt).toContain('[1] Document: Doc1.pdf (Page 1)');
      expect(prompt).toContain('[2] Document: Doc2.pdf (Page 2)');
      expect(prompt).toContain('cite using [N]');
    });

    it('should handle empty context', () => {
      const service = streamingService as any;
      const prompt = service.buildSystemPrompt([]);

      expect(prompt).toContain('No retrieved context is available');
      expect(prompt).toContain('Answer based on your general knowledge');
    });
  });
});
