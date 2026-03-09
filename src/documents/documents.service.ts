import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../shared/database/database.service';
import { Queue } from 'bullmq';
import { QdrantService } from '../shared/infrastructure/qdrant.service';
import { promises as fs } from 'fs';
import * as path from 'path';
import { DocumentResponseDto } from './dto/document-response.dto';
import { DocumentStatus } from '@prisma/client';

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

  constructor(
    private readonly database: DatabaseService,
    private readonly queue: Queue, // 'document-upload' queue
    private readonly qdrant: QdrantService,
  ) {}

  async uploadFile(userId: number, tenantId: number, file: UploadedFile): Promise<DocumentResponseDto> {
    // Validate mimetype
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    // Validate size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds 50MB limit');
    }

    // Create document record
    const document = await this.database.getPrismaClient().document.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        status: 'queued',
      },
    });

    // Ensure upload directory exists (tenant-specific)
    const tenantDir = path.join(this.UPLOAD_DIR, String(tenantId));
    await fs.mkdir(tenantDir, { recursive: true });

    // Save file
    const ext = path.extname(file.originalname);
    const filePath = path.join(tenantDir, `${document.id}${ext}`);
    await fs.writeFile(filePath, file.buffer);

    // Enqueue processing job
    await this.queue.add('document-upload', {
      documentId: document.id,
      filePath,
      mimetype: file.mimetype,
    });

    this.logger.log(`Document uploaded: ${file.originalname} (id=${document.id}, tenant=${tenantId})`);

    return document as DocumentResponseDto;
  }

  async getDocumentStatus(documentId: number, userId: number, tenantId: number): Promise<{ status: DocumentStatus; error_message?: string }> {
    const document = await this.database.getPrismaClient().document.findFirst({
      where: { id: documentId, user_id: userId, tenant_id: tenantId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return {
      status: document.status,
      error_message: document.error_message,
    };
  }

  async listDocuments(userId: number, tenantId: number, options?: { take?: number; skip?: number }): Promise<DocumentResponseDto[]> {
    const documents = await this.database.getPrismaClient().document.findMany({
      where: { user_id: userId, tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
      take: options?.take || 20,
      skip: options?.skip || 0,
    });

    return documents as DocumentResponseDto[];
  }

  async deleteDocument(documentId: number, userId: number, tenantId: number): Promise<void> {
    // Find document (ensure ownership)
    const document = await this.database.getPrismaClient().document.findFirst({
      where: { id: documentId, user_id: userId, tenant_id: tenantId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Hard delete: remove document, chunks cascade
    await this.database.getPrismaClient().document.delete({ where: { id: documentId } });

    // Delete from Qdrant: find all chunk IDs for this document and delete
    const chunks = await this.database.getPrismaClient().documentChunk.findMany({
      where: { document_id: documentId },
    });
    const chunkIds = chunks.map(c => c.id.toString());
    if (chunkIds.length > 0) {
      await this.qdrant.deletePoints(tenantId, chunkIds);
    }

    // Delete local file if exists
    try {
      const ext = path.extname(document.filename);
      const filePath = path.join(this.UPLOAD_DIR, String(tenantId), `${documentId}${ext}`);
      await fs.unlink(filePath).catch(() => {}); // ignore if not exists
    } catch (e) {
      this.logger.warn(`Failed to delete file ${documentId}: ${e instanceof Error ? e.message : String(e)}`);
    }

    this.logger.log(`Document deleted: ${documentId} by user ${userId}`);
  }
}
