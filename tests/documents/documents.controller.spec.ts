import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsController } from '../src/documents/documents.controller';
import { MockPostgresService } from '../../mocks/postgres.service';
import { MockRedisService } from '../../mocks/redis.service';
import { DocumentBuilder } from '../../conftest';

describe('DocumentsController', () => {
  let controller: DocumentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        { provide: 'PostgresService', useClass: MockPostgresService },
        { provide: 'RedisService', useClass: MockRedisService },
      ],
    }).compile();

    controller = module.get<DocumentsController>(DocumentsController);
  });

  describe('POST /documents/upload (DOC-01)', () => {
    it('should accept file and return jobId', async () => {
      // RED: Test to implement
    });

    it('should reject files >50MB', async () => {
      // RED: Test to be implemented
    });

    it('should reject invalid mime types', async () => {
      // RED: Test to be implemented - only PDF, DOCX, TXT allowed
    });

    it('should create document record with queued status', async () => {
      // RED: Test to be implemented
    });
  });

  describe('GET /documents/:id/status (DOC-03)', () => {
    it('should return document processing status', async () => {
      // RED: Test to be implemented
    });

    it('should return 404 for non-existent document', async () => {
      // RED: Test to be implemented
    });
  });

  describe('GET /documents (DOC-01, DOC-05)', () => {
    it('should list user documents with pagination', async () => {
      // RED: Test to be implemented
    });

    it('should filter by tenant_id automatically', async () => {
      // RED: Test to be implemented - multi-tenancy check
    });
  });

  describe('DELETE /documents/:id (DOC-05)', () => {
    it('should soft delete document', async () => {
      // RED: Test to be implemented
    });

    it('should cascade delete associated chunks', async () => {
      // RED: Test to be implemented
    });
  });
});
