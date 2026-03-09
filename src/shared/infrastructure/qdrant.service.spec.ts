import { Test, TestingModule } from '@nestjs/testing';
import { QdrantService } from './qdrant.service';
import { ConfigService } from '@nestjs/config';

// Fresh mock instance factory
const createMockClient = () => ({
  createCollection: jest.fn(),
  createPayloadIndex: jest.fn(),
  upsert: jest.fn(),
  search: jest.fn(),
  deleteCollection: jest.fn(),
});

// Track current mock instance
let currentMock: ReturnType<typeof createMockClient>;

// Mock Qdrant client
jest.mock('@qdrant/js-client-rest', () => {
  const MockQdrantClient = jest.fn().mockImplementation(() => currentMock);
  return { QdrantClient: MockQdrantClient };
});

describe('QdrantService', () => {
  let service: QdrantService;
  let configSpy: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    // Create fresh mock instance for each test
    currentMock = createMockClient();

    // Configure default resolved values
    currentMock.createCollection.mockResolvedValue(undefined);
    currentMock.createPayloadIndex.mockResolvedValue(undefined);
    currentMock.upsert.mockResolvedValue(undefined);
    currentMock.search.mockResolvedValue([]);
    currentMock.deleteCollection.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QdrantService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'QDRANT_URL') return 'http://localhost:6333';
              if (key === 'QDRANT_API_KEY') return 'test-api-key';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<QdrantService>(QdrantService);
    configSpy = module.get(ConfigService) as any;
  });

  describe('constructor', () => {
    it('should create QdrantClient with URL and API key', () => {
      const QdrantClient = require('@qdrant/js-client-rest').QdrantClient as jest.Mock;
      expect(QdrantClient).toHaveBeenCalledWith({
        url: 'http://localhost:6333',
        apiKey: 'test-api-key',
      });
    });

    it('should use default values when env not set', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          QdrantService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockImplementation((key: string, defaultValue: any) => defaultValue),
            },
          },
        ],
      }).compile();

      const QdrantClient = require('@qdrant/js-client-rest').QdrantClient as jest.Mock;
      expect(QdrantClient).toHaveBeenCalledWith({
        url: 'http://localhost:6333',
        apiKey: undefined,
      });
    });
  });

  describe('createCollection', () => {
    it('should create collection with correct name and vector config', async () => {
      await service.createCollection(5);

      expect(currentMock.createCollection).toHaveBeenCalledWith('tenant_5', {
        vectors: {
          size: 3072,
          distance: 'Cosine',
          hnsw_config: {
            m: 32,
            ef_construct: 200,
          },
        },
      });

      // Verify payload indexes are created
      expect(currentMock.createPayloadIndex).toHaveBeenCalledTimes(4);
      expect(currentMock.createPayloadIndex).toHaveBeenCalledWith('tenant_5', {
        field_name: 'tenant_id',
        field_schema: { type: 'keyword' },
        wait: true,
      });
      expect(currentMock.createPayloadIndex).toHaveBeenCalledWith('tenant_5', {
        field_name: 'document_id',
        field_schema: { type: 'keyword' },
        wait: true,
      });
      expect(currentMock.createPayloadIndex).toHaveBeenCalledWith('tenant_5', {
        field_name: 'chunk_index',
        field_schema: { type: 'keyword' },
        wait: true,
      });
      expect(currentMock.createPayloadIndex).toHaveBeenCalledWith('tenant_5', {
        field_name: 'indexed_at',
        field_schema: { type: 'keyword' },
        wait: true,
      });
    });

    it('should handle existing collection (409 status)', async () => {
      currentMock.createCollection.mockResolvedValue(undefined); // reset
      currentMock.createCollection.mockRejectedValue({
        statusCode: 409,
        message: 'Collection already exists',
      });

      await expect(service.createCollection(1)).resolves.toBeUndefined();
      expect(currentMock.createPayloadIndex).not.toHaveBeenCalled();
    });

    it('should throw on other errors', async () => {
      currentMock.createCollection.mockResolvedValue(undefined); // reset
      const error = new Error('Internal server error') as any;
      error.statusCode = 500;
      currentMock.createCollection.mockRejectedValue(error);

      await expect(service.createCollection(1)).rejects.toThrow();
      expect(currentMock.createPayloadIndex).not.toHaveBeenCalled();
    });
  });

  describe('upsertVectors', () => {
    const chunks = ['chunk 1', 'chunk 2'];
    const embeddings = [[1, 2, 3], [4, 5, 6]];

    beforeEach(() => {
      currentMock.upsert.mockResolvedValue(undefined);
    });

    it('should map chunks to points with correct payload', async () => {
      await service.upsertVectors(1, 100, chunks, embeddings);

      expect(currentMock.upsert).toHaveBeenCalledWith('tenant_1', {
        points: [
          {
            id: '100:0',
            vector: [1, 2, 3],
            payload: {
              tenant_id: 1,
              document_id: 100,
              chunk_index: 0,
              content: 'chunk 1',
              indexed_at: expect.any(String),
            },
          },
          {
            id: '100:1',
            vector: [4, 5, 6],
            payload: {
              tenant_id: 1,
              document_id: 100,
              chunk_index: 1,
              content: 'chunk 2',
              indexed_at: expect.any(String),
            },
          },
        ],
        wait: true,
      });
    });

    it('should throw error if chunks and embeddings count mismatch', async () => {
      const badEmbeddings = [[1, 2, 3]];

      await expect(
        service.upsertVectors(1, 100, chunks, badEmbeddings)
      ).rejects.toThrow('Chunks (2) and embeddings (1) count mismatch');
    });

    it('should include indexed_at as ISO string', async () => {
      await service.upsertVectors(1, 100, chunks, embeddings);

      const call = currentMock.upsert.mock.calls[0];
      const points = call[1].points;
      expect(points[0].payload.indexed_at).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('search', () => {
    const mockResults = [
      { id: '100:0', score: 0.95, payload: { chunk_index: 0 } },
      { id: '100:1', score: 0.90, payload: { chunk_index: 1 } },
    ];

    beforeEach(() => {
      currentMock.search.mockResolvedValue(mockResults);
    });

    it('should call client.search with tenant filter', async () => {
      const vector = [0.1, 0.2, 0.3];

      await service.search(2, vector, 10);

      expect(currentMock.search).toHaveBeenCalledWith('tenant_2', {
        vector,
        limit: 10,
        with_payload: true,
        filter: {
          must: [{ key: 'tenant_id', match: { value: 2 } }],
        },
        params: {
          hnsw_ef: 256,
        },
      });
    });

    it('should include additional filter if provided', async () => {
      const vector = [0.1, 0.2, 0.3];
      const extraFilter = { document_id: 100 };

      await service.search(2, vector, 10, extraFilter);

      expect(currentMock.search).toHaveBeenCalledWith('tenant_2', {
        vector,
        limit: 10,
        with_payload: true,
        filter: {
          must: [
            { key: 'tenant_id', match: { value: 2 } },
            { key: 'document_id', match: { value: 100 } },
          ],
        },
        params: {
          hnsw_ef: 256,
        },
      });
    });

    it('should return SearchResult[] with id, score, payload', async () => {
      const vector = [0.1, 0.2, 0.3];
      const results = await service.search(2, vector, 10);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        id: '100:0',
        score: 0.95,
        payload: { chunk_index: 0 },
      });
    });

    it('should use default k=10 if not specified', async () => {
      const vector = [0.1, 0.2, 0.3];

      await service.search(2, vector);

      expect(currentMock.search).toHaveBeenCalledWith('tenant_2', {
        vector,
        limit: 10,
        with_payload: true,
        filter: expect.any(Object),
        params: { hnsw_ef: 256 },
      });
    });
  });

  describe('deleteCollection', () => {
    it('should delete collection for tenant', async () => {
      await service.deleteCollection(3);

      expect(currentMock.deleteCollection).toHaveBeenCalledWith('tenant_3');
    });
  });
});
