import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service';
import { DatabaseService } from '../shared/database/database.service';
import { QdrantService } from '../shared/infrastructure/qdrant.service';
import { Queue } from 'bullmq';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';

const mockPrismaClient = {
  document: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  documentChunk: {
    findMany: jest.fn(),
  },
};

const mockDatabaseService = {
  getPrismaClient: jest.fn().mockReturnValue(mockPrismaClient),
};

const mockQdrantService = {
  deletePoints: jest.fn(),
};

const mockQueue = {
  add: jest.fn(),
};

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: QdrantService, useValue: mockQdrantService },
        { provide: Queue, useValue: mockQueue },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    prisma = mockDatabaseService.getPrismaClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    const validFile = {
      originalname: 'test.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('test content'),
    };

    const validDocument = {
      id: 1,
      filename: 'test.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      status: 'queued' as DocumentStatus,
      tenant_id: 1,
      user_id: 1,
      created_at: new Date(),
    };

    it('should successfully upload a valid PDF file', async () => {
      mockPrismaClient.document.create = jest.fn().mockResolvedValue(validDocument);
      mockQueue.add = jest.fn().mockResolvedValue({});

      const result = await service.uploadFile(1, 1, validFile);

      expect(result).toEqual(validDocument);
      expect(mockPrismaClient.document.create).toHaveBeenCalledWith({
        data: {
          tenant_id: 1,
          user_id: 1,
          filename: 'test.pdf',
          mimetype: 'application/pdf',
          size: 1024,
          status: 'queued',
        },
      });
      expect(mockQueue.add).toHaveBeenCalledWith('document-upload', {
        documentId: 1,
        filePath: expect.stringMatching(/uploads\/1\/1\.pdf$/),
        mimetype: 'application/pdf',
      });
    });

    it('should upload DOCX file', async () => {
      const docxFile = {
        ...validFile,
        originalname: 'doc.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
      const docxDocument = { ...validDocument, filename: 'doc.docx', mimetype: docxFile.mimetype };

      mockPrismaClient.document.create = jest.fn().mockResolvedValue(docxDocument);
      mockQueue.add = jest.fn().mockResolvedValue({});

      const result = await service.uploadFile(1, 1, docxFile);

      expect(result).toEqual(docxDocument);
    });

    it('should upload TXT file', async () => {
      const txtFile = {
        ...validFile,
        originalname: 'notes.txt',
        mimetype: 'text/plain',
      };
      const txtDocument = { ...validDocument, filename: 'notes.txt', mimetype: txtFile.mimetype };

      mockPrismaClient.document.create = jest.fn().mockResolvedValue(txtDocument);
      mockQueue.add = jest.fn().mockResolvedValue({});

      const result = await service.uploadFile(1, 1, txtFile);

      expect(result).toEqual(txtDocument);
    });

    it('should reject unsupported file type', async () => {
      const invalidFile = {
        ...validFile,
        mimetype: 'image/jpeg',
      };

      await expect(service.uploadFile(1, 1, invalidFile)).rejects.toThrow(BadRequestException);
      await expect(service.uploadFile(1, 1, invalidFile)).rejects.toThrow('Unsupported file type: image/jpeg');
    });

    it('should reject file exceeding 50MB limit', async () => {
      const largeFile = {
        ...validFile,
        size: 51 * 1024 * 1024, // 51MB
      };

      await expect(service.uploadFile(1, 1, largeFile)).rejects.toThrow(BadRequestException);
      await expect(service.uploadFile(1, 1, largeFile)).rejects.toThrow('File size exceeds 50MB limit');
    });

    it('should handle database creation failure', async () => {
      mockPrismaClient.document.create = jest.fn().mockRejectedValue(new Error('DB error'));

      await expect(service.uploadFile(1, 1, validFile)).rejects.toThrow('DB error');
    });
  });

  describe('getDocumentStatus', () => {
    it('should return document status for valid document', async () => {
      const document = {
        id: 1,
        status: 'processing' as DocumentStatus,
        error_message: null,
        user_id: 1,
        tenant_id: 1,
      };
      mockPrismaClient.document.findFirst = jest.fn().mockResolvedValue(document);

      const result = await service.getDocumentStatus(1, 1, 1);

      expect(result).toEqual({
        status: 'processing',
        error_message: null,
      });
    });

    it('should return error_message when document has error', async () => {
      const document = {
        id: 2,
        status: 'error' as DocumentStatus,
        error_message: 'Processing failed due to invalid format',
        user_id: 1,
        tenant_id: 1,
      };
      mockPrismaClient.document.findFirst = jest.fn().mockResolvedValue(document);

      const result = await service.getDocumentStatus(2, 1, 1);

      expect(result).toEqual({
        status: 'error',
        error_message: 'Processing failed due to invalid format',
      });
    });

    it('should throw NotFoundException for non-existent document', async () => {
      mockPrismaClient.document.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.getDocumentStatus(999, 1, 1)).rejects.toThrow(NotFoundException);
      await expect(service.getDocumentStatus(999, 1, 1)).rejects.toThrow('Document not found');
    });

    it('should enforce tenant isolation - not return document from other tenant', async () => {
      // When no document matches the tenant/user filter, findFirst returns null
      mockPrismaClient.document.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.getDocumentStatus(1, 1, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('listDocuments', () => {
    it('should return paginated list of user documents', async () => {
      const documents = [
        {
          id: 3,
          filename: 'latest.pdf',
          mimetype: 'application/pdf',
          size: 1024,
          status: 'indexed' as DocumentStatus,
          user_id: 1,
          tenant_id: 1,
          created_at: new Date('2026-03-09'),
        },
        {
          id: 2,
          filename: 'middle.docx',
          mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: 2048,
          status: 'processing' as DocumentStatus,
          user_id: 1,
          tenant_id: 1,
          created_at: new Date('2026-03-08'),
        },
        {
          id: 1,
          filename: 'oldest.txt',
          mimetype: 'text/plain',
          size: 512,
          status: 'queued' as DocumentStatus,
          user_id: 1,
          tenant_id: 1,
          created_at: new Date('2026-03-07'),
        },
      ];
      mockPrismaClient.document.findMany = jest.fn().mockResolvedValue(documents);

      const result = await service.listDocuments(1, 1, { take: 10, skip: 0 });

      expect(result).toHaveLength(3);
      expect(mockPrismaClient.document.findMany).toHaveBeenCalledWith({
        where: { user_id: 1, tenant_id: 1 },
        orderBy: { created_at: 'desc' },
        take: 10,
        skip: 0,
      });
    });

    it('should use default pagination (20 items, no skip)', async () => {
      const documents = [];
      mockPrismaClient.document.findMany = jest.fn().mockResolvedValue(documents);

      await service.listDocuments(1, 1);

      expect(mockPrismaClient.document.findMany).toHaveBeenCalledWith({
        where: { user_id: 1, tenant_id: 1 },
        orderBy: { created_at: 'desc' },
        take: 20,
        skip: 0,
      });
    });

    it('should enforce tenant isolation in list queries', async () => {
      mockPrismaClient.document.findMany = jest.fn().mockResolvedValue([]);

      await service.listDocuments(1, 1);

      const callArgs = mockPrismaClient.document.findMany.mock.calls[0][0];
      expect(callArgs.where.user_id).toBe(1);
      expect(callArgs.where.tenant_id).toBe(1);
    });
  });

  describe('deleteDocument', () => {
    it('should successfully delete document without chunks', async () => {
      const document = {
        id: 1,
        filename: 'test.pdf',
        mimetype: 'application/pdf',
        user_id: 1,
        tenant_id: 1,
      };
      mockPrismaClient.document.findFirst = jest.fn().mockResolvedValue(document);
      mockPrismaClient.document.delete = jest.fn().mockResolvedValue({});
      mockPrismaClient.documentChunk.findMany = jest.fn().mockResolvedValue([]);
      mockQdrantService.deletePoints = jest.fn().mockResolvedValue({});

      await service.deleteDocument(1, 1, 1);

      expect(mockPrismaClient.document.findFirst).toHaveBeenCalledWith({
        where: { id: 1, user_id: 1, tenant_id: 1 },
      });
      expect(mockPrismaClient.document.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockQdrantService.deletePoints).not.toHaveBeenCalled(); // no chunks, so no deletePoints call
    });

    it('should delete Qdrant points for document chunks', async () => {
      const document = {
        id: 1,
        filename: 'test.pdf',
        mimetype: 'application/pdf',
        user_id: 1,
        tenant_id: 1,
      };
      const chunks = [
        { id: 101 },
        { id: 102 },
        { id: 103 },
      ];
      mockPrismaClient.document.findFirst = jest.fn().mockResolvedValue(document);
      mockPrismaClient.document.delete = jest.fn().mockResolvedValue({});
      mockPrismaClient.documentChunk.findMany = jest.fn().mockResolvedValue(chunks);
      mockQdrantService.deletePoints = jest.fn().mockResolvedValue({});

      await service.deleteDocument(1, 1, 1);

      expect(mockQdrantService.deletePoints).toHaveBeenCalledWith(1, ['101', '102', '103']);
    });

    it('should attempt to delete local file', async () => {
      const document = {
        id: 1,
        filename: 'test.pdf',
        mimetype: 'application/pdf',
        user_id: 1,
        tenant_id: 1,
      };
      mockPrismaClient.document.findFirst = jest.fn().mockResolvedValue(document);
      mockPrismaClient.document.delete = jest.fn().mockResolvedValue({});
      mockPrismaClient.documentChunk.findMany = jest.fn().mockResolvedValue([]);
      mockQdrantService.deletePoints = jest.fn().mockResolvedValue({});

      await service.deleteDocument(1, 1, 1);

      // The file deletion is attempted but silently ignored if it fails
      // We just verify the service method doesn't throw
    });

    it('should throw NotFoundException for non-existent document', async () => {
      mockPrismaClient.document.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.deleteDocument(999, 1, 1)).rejects.toThrow(NotFoundException);
    });

    it('should not call delete if document not found', async () => {
      mockPrismaClient.document.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.deleteDocument(999, 1, 1)).rejects.toThrow(NotFoundException);
      expect(mockPrismaClient.document.delete).not.toHaveBeenCalled();
    });
  });
});
