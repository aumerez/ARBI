import { Test, TestingModule } from '@nestjs/testing';
import { RerankerService } from './reranker.service';
import { ProviderFactory } from '../../shared/infrastructure/providers/provider.factory';
import { RetrievedChunk } from '../../shared/types/providers.interface';

describe('RerankerService', () => {
  let service: RerankerService;
  let providerFactory: any;
  let mockEmbeddingProvider: any;

  const mockChunks: RetrievedChunk[] = [
    {
      id: '100:0',
      content: 'First chunk about machine learning',
      documentName: 'doc1.pdf',
      pageNumber: 1,
      score: 0.9,
      embedding: [0.1, 0.2, 0.3],
    },
    {
      id: '101:0',
      content: 'Second chunk about neural networks',
      documentName: 'doc2.pdf',
      pageNumber: 1,
      score: 0.85,
      embedding: [0.4, 0.5, 0.6],
    },
    {
      id: '102:0',
      content: 'Third chunk about deep learning',
      documentName: 'doc3.pdf',
      pageNumber: 2,
      score: 0.8,
      embedding: [0.7, 0.8, 0.9],
    },
  ];

  const queryEmbedding = [0.15, 0.25, 0.35];

  beforeEach(async () => {
    mockEmbeddingProvider = {
      generateEmbeddings: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RerankerService,
        { provide: ProviderFactory, useValue: { getEmbeddingProvider: jest.fn(() => mockEmbeddingProvider) } },
      ],
    }).compile();

    service = module.get<RerankerService>(RerankerService);
    providerFactory = module.get(ProviderFactory);
  });

  describe('rerank', () => {
    it('should compute cosine similarity and rerank chunks', async () => {
      mockEmbeddingProvider.generateEmbeddings.mockResolvedValue([queryEmbedding]);

      const result = await service.rerank(mockChunks, 'machine learning', 2);

      expect(mockEmbeddingProvider.generateEmbeddings).toHaveBeenCalledWith(['machine learning']);
      expect(result).toHaveLength(2);
      // Result should be sorted by cosine score descending
      // Chunk 100: [0.1,0.2,0.3] has highest cosine (~0.998) with query [0.15,0.25,0.35]
      expect(result[0].id).toBe('100:0');
      expect(result[1].id).toBe('101:0'); // Second highest
    });

    it('should return empty array for empty input', async () => {
      const result = await service.rerank([], 'query', 10);
      expect(result).toEqual([]);
    });

    it('should skip reranking for chunks without embedding and keep original order', async () => {
      const chunksWithoutEmbedding: RetrievedChunk[] = [
        { id: '1', content: 'test', documentName: 'doc', score: 0.9, embedding: [0.1, 0.2] },
        { id: '2', content: 'test2', documentName: 'doc', score: 0.8 }, // No embedding
      ];
      mockEmbeddingProvider.generateEmbeddings.mockResolvedValue([[0.1, 0.2]]);

      const result = await service.rerank(chunksWithoutEmbedding, 'query', 2);

      expect(result[0].id).toBe('1'); // Keeps original score order
      expect(result[1].id).toBe('2');
    });

    it('should warn when chunk is missing embedding', async () => {
      const chunks: RetrievedChunk[] = [
        { id: '1', content: 'test', documentName: 'doc', score: 0.9 },
      ];
      mockEmbeddingProvider.generateEmbeddings.mockResolvedValue([[0.1, 0.2]]);

      const result = await service.rerank(chunks, 'query', 1);

      expect(result[0].id).toBe('1');
      expect(result[0].score).toBe(0.9); // Original score preserved
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity correctly for identical vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];
      const similarity = (service as any).cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should calculate cosine similarity correctly for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      const similarity = (service as any).cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(0, 5);
    });

    it('should calculate cosine similarity correctly for opposite vectors', () => {
      const a = [1, 2, 3];
      const b = [-1, -2, -3];
      const similarity = (service as any).cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(-1, 5);
    });

    it('should throw error for vectors with different dimensions', () => {
      const a = [1, 2, 3];
      const b = [1, 2];
      expect(() => (service as any).cosineSimilarity(a, b)).toThrow('Vector dimensions mismatch');
    });

    it('should return 0 for zero vectors', () => {
      const a = [0, 0, 0];
      const b = [1, 2, 3];
      const similarity = (service as any).cosineSimilarity(a, b);
      expect(similarity).toBe(0);
    });
  });
});
