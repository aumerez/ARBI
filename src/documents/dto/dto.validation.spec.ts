import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { DocumentResponseDto } from './document-response.dto';
import { DocumentStatusResponseDto } from './document-status.dto';
import { DocumentStatus } from '@prisma/client';

describe('Document DTOs Validation', () => {
  describe('DocumentResponseDto', () => {
    it('should validate correct document metadata', async () => {
      const dto = plainToInstance(DocumentResponseDto, {
        id: 1,
        filename: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        status: DocumentStatus.queued,
        created_at: new Date(),
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate document with error_message', async () => {
      const dto = plainToInstance(DocumentResponseDto, {
        id: 2,
        filename: 'doc.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 2048,
        status: DocumentStatus.error,
        error_message: 'Processing failed',
        created_at: new Date(),
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid id (not int)', async () => {
      const dto = plainToInstance(DocumentResponseDto, {
        id: 'abc',
        filename: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        status: DocumentStatus.queued,
        created_at: new Date(),
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('id');
    });

    it('should reject missing required filename', async () => {
      const dto = plainToInstance(DocumentResponseDto, {
        id: 1,
        mimetype: 'application/pdf',
        size: 1024,
        status: DocumentStatus.queued,
        created_at: new Date(),
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('filename');
    });

    it('should accept any string as mimetype (content validation is service-level)', async () => {
      const dto = plainToInstance(DocumentResponseDto, {
        id: 1,
        filename: 'test.pdf',
        mimetype: 'application/octet-stream', // any string is valid at DTO level
        size: 1024,
        status: DocumentStatus.queued,
        created_at: new Date(),
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid status (not enum)', async () => {
      const dto = plainToInstance(DocumentResponseDto, {
        id: 1,
        filename: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        status: 'invalid_status',
        created_at: new Date(),
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('status');
    });
  });

  describe('DocumentStatusResponseDto', () => {
    it('should validate correct status response', async () => {
      const dto = plainToInstance(DocumentStatusResponseDto, {
        documentId: 1,
        status: DocumentStatus.processing,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate status response with progress', async () => {
      const dto = plainToInstance(DocumentStatusResponseDto, {
        documentId: 2,
        status: DocumentStatus.indexed,
        progress: 100,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate status response with error_message', async () => {
      const dto = plainToInstance(DocumentStatusResponseDto, {
        documentId: 3,
        status: DocumentStatus.error,
        error_message: 'Failed to process',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid documentId (not int)', async () => {
      const dto = plainToInstance(DocumentStatusResponseDto, {
        documentId: 'abc',
        status: DocumentStatus.queued,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('documentId');
    });

    it('should reject missing status', async () => {
      const dto = plainToInstance(DocumentStatusResponseDto, {
        documentId: 1,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('status');
    });

    it('should reject invalid status (not enum)', async () => {
      const dto = plainToInstance(DocumentStatusResponseDto, {
        documentId: 1,
        status: 'bad_status',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('status');
    });

    it('should reject progress that is not int', async () => {
      const dto = plainToInstance(DocumentStatusResponseDto, {
        documentId: 1,
        status: DocumentStatus.processing,
        progress: '50',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('progress');
    });
  });
});
