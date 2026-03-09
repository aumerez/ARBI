import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsModule } from './documents.module';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DatabaseService } from '../shared/database/database.service';
import { RedisService } from '../shared/infrastructure/redis.service';
import { QdrantService } from '../shared/infrastructure/qdrant.service';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

// Mock workers to avoid loading processor dependencies (pdfjs-dist, etc.)
jest.mock('./jobs/document-upload.worker', () => ({
  DocumentUploadWorker: class MockDocumentUploadWorker {},
}));
jest.mock('./jobs/embedding-generation.worker', () => ({
  EmbeddingGenerationWorker: class MockEmbeddingGenerationWorker {},
}));

// Mock external services
const mockRedisService = {
  getConnection: () => ({} as any),
};

const mockDatabaseService = {
  getPrismaClient: () => ({
    document: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), delete: jest.fn(), findMany: jest.fn() },
    documentChunk: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
  }),
};

const mockQdrantService = {
  deletePoints: jest.fn(),
  upsertPoint: jest.fn(),
};

describe('DocumentsModule', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DocumentsModule],
    })
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .overrideProvider(DatabaseService)
      .useValue(mockDatabaseService)
      .overrideProvider(QdrantService)
      .useValue(mockQdrantService)
      .compile();
  });

  afterAll(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide DocumentsService', () => {
    const service = module.get<DocumentsService>(DocumentsService);
    expect(service).toBeDefined();
  });

  it('should provide DocumentsController', () => {
    const controller = module.get<DocumentsController>(DocumentsController);
    expect(controller).toBeDefined();
  });

  it('should provide DOCUMENT_UPLOAD_QUEUE as Queue', () => {
    const queue = module.get<Queue>('DOCUMENT_UPLOAD_QUEUE');
    expect(queue).toBeDefined();
    expect(queue instanceof Queue).toBe(true);
  });

  it('should provide EMBEDDING_QUEUE as Queue', () => {
    const queue = module.get<Queue>('EMBEDDING_QUEUE');
    expect(queue).toBeDefined();
    expect(queue instanceof Queue).toBe(true);
  });

  it('should provide DatabaseService', () => {
    const database = module.get<DatabaseService>(DatabaseService);
    expect(database).toBeDefined();
  });

  it('should provide RedisService', () => {
    const redis = module.get<RedisService>(RedisService);
    expect(redis).toBeDefined();
  });

  it('should provide QdrantService', () => {
    const qdrant = module.get<QdrantService>(QdrantService);
    expect(qdrant).toBeDefined();
  });

  it('should export DocumentsService', () => {
    const service = module.get<DocumentsService>(DocumentsService);
    expect(service).toBeDefined();
  });
});
