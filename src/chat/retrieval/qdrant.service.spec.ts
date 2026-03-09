import { Test, TestingModule } from '@nestjs/testing';
import { QdrantService } from './qdrant.service';
import { QdrantService as SharedQdrantService } from '../../shared/infrastructure/qdrant.service';

// Mock search result from shared QdrantService
interface SearchResult {
  id: string;
  score: number;
  payload: Record<string, any>;
}

// Fresh mock instance factory
const createMockSharedQdrant = () => ({
  search: jest.fn(),
});

// Track current mock instance
let currentMock: ReturnType<typeof createMockSharedQdrant>;

// Mock Shared Qdrant service
jest.mock('../../shared/infrastructure/qdrant.service', () => {
  const MockSharedQdrantService = jest.fn().mockImplementation(() => currentMock);
  return { QdrantService: MockSharedQdrantService };
});

describe('QdrantService (Chat Retrieval)', () => {
  let service: QdrantService;

  beforeEach(async () => {
    // Create fresh mock instance for each test
    currentMock = createMockSharedQdrant();
    currentMock.search.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      imports: [],
      providers: [
        {
          provide: SharedQdrantService,
          useValue: currentMock,
        },
        QdrantService,
      ],
    }).compile();

    service = module.get<QdrantService>(QdrantService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchByVector', () => {
    it('should call shared QdrantService.search with correct tenantId', async () => {
      await service.searchByVector('document_chunks', [0.1, 0.2, 0.3], 10, { tenant_id: 5 });

      expect(currentMock.search).toHaveBeenCalledWith(5, [0.1, 0.2, 0.3], 10, { tenant_id: 5 });
    });

    it('should pass through additional filters', async () => {
      await service.searchByVector('document_chunks', [0.1, 0.2, 0.3], 20, { tenant_id: 3, document_id: 100 });

      expect(currentMock.search).toHaveBeenCalledWith(3, [0.1, 0.2, 0.3], 20, expect.objectContaining({
        tenant_id: 3,
        document_id: 100,
      }));
    });

    it('should return the results array directly from shared service', async () => {
      const mockResults: SearchResult[] = [
        { id: '100:0', score: 0.95, payload: { chunk_index: 0 } },
        { id: '100:1', score: 0.90, payload: { chunk_index: 1 } },
      ];
      currentMock.search.mockResolvedValue(mockResults);

      const results = await service.searchByVector('document_chunks', [0.1, 0.2, 0.3], 10, { tenant_id: 1 });

      expect(results).toEqual(mockResults);
    });

    it('should use default limit of 10 when not specified', async () => {
      await service.searchByVector('document_chunks', [0.1, 0.2, 0.3], undefined, { tenant_id: 1 });

      expect(currentMock.search).toHaveBeenCalledWith(1, [0.1, 0.2, 0.3], 10, expect.any(Object));
    });

    it('should propagate errors from shared service', async () => {
      currentMock.search.mockRejectedValue(new Error('Qdrant error'));

      await expect(
        service.searchByVector('document_chunks', [0.1, 0.2, 0.3], 10, { tenant_id: 1 })
      ).rejects.toThrow('Qdrant error');
    });
  });
});
