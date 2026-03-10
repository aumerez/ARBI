import { Test, TestingModule } from '@nestjs/testing';
import { StreamingService } from '../../src/chat/generation/streaming.service';
import { HybridSearchService } from '../../src/chat/retrieval/hybrid-search.service';
import { CitationValidatorService } from '../../src/chat/validation/citation-validator.service';
import { DatabaseService } from '../../src/shared/database/database.service';
import { ProviderFactory } from '../../src/shared/infrastructure/providers/provider.factory';

// Mock services
const mockHybridSearch = { search: jest.fn() };
const mockCitationValidator = { validate: jest.fn(() => ({ valid: true, errors: [] })) };
const mockDatabase = { getPrismaClient: jest.fn() };
const mockProviderFactory = { getLLMProvider: jest.fn() };

describe('StreamingService - No-Context Refusal (CHAT-11)', () => {
  let service: StreamingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamingService,
        { provide: HybridSearchService, useValue: mockHybridSearch },
        { provide: CitationValidatorService, useValue: mockCitationValidator },
        { provide: DatabaseService, useValue: mockDatabase },
        { provide: ProviderFactory, useValue: mockProviderFactory },
      ],
    }).compile();

    service = module.get<StreamingService>(StreamingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should refuse response when no chunks retrieved', async () => {
    // Arrange: hybrid search returns empty array (no matching documents)
    mockHybridSearch.search.mockResolvedValue([]);
    mockProviderFactory.getLLMProvider.mockReturnValue({
      streamChat: jest.fn().mockReturnValue(async function*() {
        yield { type: 'text', text: 'This should not be reached' };
      }),
    } as any);

    // Act
    const stream = service.generateResponse(1, 1, 1, 'query with no context');
    const chunks: any[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    // Assert
    expect(chunks[0]).toEqual({ type: 'text', text: 'I cannot answer because no relevant documents were found.' });
    expect(chunks[1]).toEqual({ type: 'done' });
    expect(mockProviderFactory.getLLMProvider).not.toHaveBeenCalled(); // LLM should NOT be invoked
  });

  it('should call LLM provider when chunks are present', async () => {
    // Arrange
    mockHybridSearch.search.mockResolvedValue([
      {
        chunkId: 1,
        documentId: 1,
        documentName: 'Test.pdf',
        pageNumber: 0,
        content: 'Test content',
        score: 0.95,
        embedding: new Array(3072).fill(0),
      },
    ]);

    const mockLLM = {
      streamChat: jest.fn().mockReturnValue(async function*() {
        yield { type: 'text', text: 'Hello from LLM' };
        yield { type: 'done' };
      }),
    };
    mockProviderFactory.getLLMProvider.mockReturnValue(mockLLM);

    // Act
    const stream = service.generateResponse(1, 1, 1, 'query with context');
    const chunks: any[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    // Assert
    expect(mockProviderFactory.getLLMProvider).toHaveBeenCalled();
    expect(chunks[0]).toEqual({ type: 'text', text: 'Hello from LLM' });
  });
});
