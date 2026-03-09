import { Test, TestingModule } from '@nestjs/testing';
import { HybridSearchService } from './hybrid-search.service';
import { QdrantService } from './qdrant.service';
import { ProviderFactory } from '../../shared/infrastructure/providers/provider.factory';
import { DatabaseService } from '../../shared/database/database.service';
import { RerankerService } from './reranker.service';
import { ConfigService } from '@nestjs/config';

// Mock interfaces
interface MockVectorSearchResult {
  id: string;
  score: number;
  payload: any;
}

describe('HybridSearchService', () => {
  let service: HybridSearchService;
  let qdrantService: any;
  let providerFactory: any;
  let databaseService: any;
  let rerankerService: any;
  let mockPrisma: any;

  const mockEmbeddingProvider = {
    generateEmbeddings: jest.fn(),
  };

  const mockReranker = {
    rerank: jest.fn(),
  };

  const mockVectorResults: MockVectorSearchResult[] = [
    { id: '200:0', score: 0.95, payload: { chunk_id: 200, document_id: 100, content: 'ml chunk 1', tenant_id: 1 } },
    { id: '201:0', score: 0.90, payload: { chunk_id: 201, document_id: 101, content: 'ml chunk 2', tenant_id: 1 } },
  ];

  const mockBM25Results: any[] = [
    { chunk_id: 201, document_id: 101, content: 'ml chunk 2', page_number: 1, score: 0.85 },
    { chunk_id: 300, document_id: 102, content: 'ml chunk 3', page_number: 1, score: 0.80 },
  ];

  const mockChunkData = [
    { id: 200, document_id: 100, content: 'ml chunk 1', chunk_index: 0, document: { filename: 'doc100.pdf' } },
    { id: 201, document_id: 101, content: 'ml chunk 2', chunk_index: 0, document: { filename: 'doc101.pdf' } },
    { id: 300, document_id: 102, content: 'ml chunk 3', chunk_index: 0, document: { filename: 'doc102.pdf' } },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrisma = {
      documentChunk: {
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $queryRawUnsafe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HybridSearchService,
        { provide: QdrantService, useValue: { searchByVector: jest.fn(), getPoints: jest.fn() } },
        { provide: ProviderFactory, useValue: { getEmbeddingProvider: jest.fn(() => mockEmbeddingProvider) } },
        { provide: DatabaseService, useValue: { getPrismaClient: jest.fn(() => mockPrisma) } },
        { provide: RerankerService, useValue: mockReranker },
      ],
    }).compile();

    service = module.get<HybridSearchService>(HybridSearchService);
    qdrantService = module.get(QdrantService) as any;
    providerFactory = module.get(ProviderFactory) as any;
    databaseService = module.get(DatabaseService) as any;
    rerankerService = module.get(RerankerService) as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    const tenantId = 1;
    const query = 'machine learning';
    const topK = 10;
    const mockEmbedding = [0.1, 0.2, 0.3];

    it('should generate embedding, perform vector and BM25 search, fuse with RRF, and rerank', async () => {
      mockEmbeddingProvider.generateEmbeddings.mockResolvedValue([mockEmbedding]);
      qdrantService.searchByVector.mockResolvedValue(mockVectorResults);
      mockPrisma.$queryRawUnsafe.mockResolvedValue(mockBM25Results);
      mockPrisma.documentChunk.findMany.mockResolvedValue(mockChunkData);

      // Mock reranker to return chunks in expected order (just return input)
      mockReranker.rerank.mockImplementation(async (chunks) => chunks.slice(0, topK));

      const results = await service.search(query, tenantId, topK);

      expect(mockEmbeddingProvider.generateEmbeddings).toHaveBeenCalledWith([query]);

      expect(qdrantService.searchByVector).toHaveBeenCalledWith(
        'document_chunks',
        mockEmbedding,
        topK * 2,
        { tenant_id: tenantId },
        true
      );

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        query,
        tenantId,
        topK * 2
      );

      expect(mockReranker.rerank).toHaveBeenCalled();

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toMatchObject({
        chunkId: expect.any(Number),
        documentId: expect.any(Number),
        content: expect.any(String),
        pageNumber: expect.any(Number),
        score: expect.any(Number),
        documentName: expect.any(String),
      });
    });

    it('should return chunks from both vector and BM25 with RRF scores', async () => {
      mockEmbeddingProvider.generateEmbeddings.mockResolvedValue([mockEmbedding]);
      qdrantService.searchByVector.mockResolvedValue(mockVectorResults);
      mockPrisma.$queryRawUnsafe.mockResolvedValue(mockBM25Results);
      mockPrisma.documentChunk.findMany.mockResolvedValue(mockChunkData);

      // Mock reranker to return chunks in order (sorted by RRF)
      mockReranker.rerank.mockImplementation(async (chunks) => chunks.slice(0, 10));

      const results = await service.search(query, tenantId, 10);

      expect(results.length).toBe(3);

      const chunk201 = results.find(r => r.chunkId === 201);
      const chunk200 = results.find(r => r.chunkId === 200);
      const chunk300 = results.find(r => r.chunkId === 300);

      expect(chunk201).toBeDefined();
      expect(chunk200).toBeDefined();
      expect(chunk300).toBeDefined();
    });

    it('should handle empty results from both sources', async () => {
      mockEmbeddingProvider.generateEmbeddings.mockResolvedValue([mockEmbedding]);
      qdrantService.searchByVector.mockResolvedValue([]);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
      mockReranker.rerank.mockResolvedValue([]);

      const results = await service.search(query, tenantId, topK);
      expect(results).toEqual([]);
    });

    it('should limit final results to topK', async () => {
      mockEmbeddingProvider.generateEmbeddings.mockResolvedValue([mockEmbedding]);

      const manyVectorResults: MockVectorSearchResult[] = Array.from({ length: 20 }, (_, i) => ({
        id: `200:${i}`,
        score: 0.95 - i * 0.01,
        payload: { chunk_id: 200 + i, content: `chunk ${i}`, tenant_id: 1 },
      }));
      qdrantService.searchByVector.mockResolvedValue(manyVectorResults);

      const manyBM25Results: any[] = Array.from({ length: 20 }, (_, i) => ({
        chunk_id: 300 + i,
        content: `bm25 chunk ${i}`,
        score: 0.85 - i * 0.01,
      }));
      mockPrisma.$queryRawUnsafe.mockResolvedValue(manyBM25Results);

      mockPrisma.documentChunk.findMany.mockResolvedValue(
        [...manyVectorResults, ...manyBM25Results].map(r => {
          const isVector = r.payload !== undefined;
          const chunkId = isVector ? r.payload.chunk_id : r.chunk_id;
          const docId = isVector ? r.payload.document_id : r.chunk_id;
          const content = isVector ? r.payload.content : r.content;
          return {
            id: chunkId,
            document_id: docId,
            content,
            chunk_index: 0,
            document: { filename: `doc${chunkId}.pdf` },
          };
        })
      );

      // Mock reranker to limit to topK
      mockReranker.rerank.mockImplementation(async (chunks) => chunks.slice(0, 10));

      const results = await service.search(query, tenantId, 10);
      expect(results).toHaveLength(10);
    });

    it('should handle errors from embedding provider', async () => {
      mockEmbeddingProvider.generateEmbeddings.mockRejectedValue(new Error('API limit exceeded'));
      await expect(service.search(query, tenantId, topK)).rejects.toThrow('API limit exceeded');
    });

    it('should propagate BM25 search failures', async () => {
      mockEmbeddingProvider.generateEmbeddings.mockResolvedValue([mockEmbedding]);
      qdrantService.searchByVector.mockResolvedValue([]);
      mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error('Database connection error'));

      await expect(service.search(query, tenantId, topK)).rejects.toThrow('Database connection error');
    });

    it('should handle missing chunk data gracefully', async () => {
      mockEmbeddingProvider.generateEmbeddings.mockResolvedValue([mockEmbedding]);
      qdrantService.searchByVector.mockResolvedValue(mockVectorResults);
      mockPrisma.$queryRawUnsafe.mockResolvedValue(mockBM25Results);
      mockPrisma.documentChunk.findMany.mockResolvedValue([]);
      mockReranker.rerank.mockResolvedValue([]);

      const results = await service.search(query, tenantId, 10);
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
