---
phase: 01-backend-mvp
plan: 04c
type: execute
wave: 15
depends_on:
  - 04a
  - 04b
files_modified:
  - src/documents/documents.service.ts
  - src/documents/dto/document-status.dto.ts
  - src/documents/dto/document-response.dto.ts
autonomous: true
requirements:
  - DOC-02
  - DOC-03
  - DOC-05
user_setup: []
must_haves:
  truths:
    - "DocumentsService.uploadFile(userId, tenantId, file) validates file type (PDF/DOCX/TXT) and size (≤50MB), stores temporarily, creates Document record with status='queued'"
    - "DocumentsService.getDocumentStatus(documentId, userId, tenantId) returns current status (queued/processing/indexed/error) and error_message if any"
    - "DocumentsService.listDocuments(userId, tenantId, filters?) returns paginated list of user's documents with metadata (filename, mimetype, size, status, created_at)"
    - "DocumentsService.deleteDocument(documentId, userId, tenantId) performs soft delete (marks as deleted or removes from DB with cascade of chunks and Qdrant points)"
    - "All service methods enforce tenant isolation by scoping queries with tenant_id"
    - "File validation rejects unsupported mimetypes and oversized files (returns 400)"
  artifacts:
    - path: "src/documents/documents.service.ts"
      provides: "Core document business logic"
      min_lines: 100
      exports:
        - "uploadFile(userId, tenantId, file): Promise<DocumentResponse>"
        - "getDocumentStatus(documentId, userId, tenantId): Promise<DocumentStatusResponse>"
        - "listDocuments(userId, tenantId, options): Promise<Document[]>"
        - "deleteDocument(documentId, userId, tenantId): Promise<void>"
    - path: "src/documents/dto/document-status.dto.ts"
      provides: "Status response DTO"
      min_lines: 10
    - path: "src/documents/dto/document-response.dto.ts"
      provides: "Document metadata DTO"
      min_lines: 15
  key_links:
    - from: "src/documents/documents.service.ts"
      to: "prisma.document, prisma.documentChunk"
      via: "prisma.document.create, prisma.document.update, prisma.document.findMany"
      pattern: "prisma\\.document"
    - from: "src/documents/documents.service.ts"
      to: "BullMQ queue 'document-upload'"
      via: "queue.add('document-upload', { documentId, filePath, mimetype })"
      pattern: "queue\\.add.*document-upload"
    - from: "src/documents/documents.service.ts"
      to: "QdrantService (for cleanup on delete)"
      via: "qdrant.delete points for document's chunks"
      pattern: "qdrant.*delete"
    - from: "DocumentsService.uploadFile"
      to: "multer file handling"
      via: "validates file.mimetype, file.size"
      pattern: "file\\.mimetype|file\\.size"

---

<objective>
Implement DocumentsService with business logic for document lifecycle

Purpose: Provide application service layer for document upload, status retrieval, listing, and deletion. Enforce tenant-scoped operations, validate inputs, coordinate with BullMQ for async processing, and handle cleanup on delete.

Output: DocumentsService and related DTOs

</objective>

<execution_context>
@/Users/franciscoegloff/projects/metacortex/ops-ai-platform/.planning/workflows/execute-plan.md
@/Users/franciscoegloff/projects/metacortex/ops-ai-platform/.planning/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/01-backend-mvp/01-CONTEXT.md
@.planning/phases/01-backend-mvp/01-RESEARCH.md

# Service responsibilities:
- Upload: Validate file (mimetype, size ≤ 50MB), store to temporary location (e.g., uploads/), create Document DB record (status=queued, user_id, tenant_id, filename, mimetype, size), enqueue document-upload job, return document metadata (id, filename, status).
- Status: Query Document by id with user_id & tenant_id check; return status and error_message if any.
- List: FindMany Documents for user in tenant with pagination (skip/take or cursor), return array with minimal fields (id, filename, mimetype, size, status, created_at).
- Delete: Mark document as deleted (soft delete) OR hard delete: remove Document record, cascade deletes DocumentChunk (DB), and call Qdrant delete to remove vectors by payload filter (document_id). Also delete file from storage.

# Validation rules:
- Supported mimetypes: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document (DOCX), text/plain
- Max size: 50 * 1024 * 1024 = 52428800 bytes
- Throw BadRequestException if invalid

# Tenant isolation:
- All queries filter by { user_id, tenant_id } (or just tenant_id for admin later)
- Document belongs to tenant; ensure user belongs to same tenant

# Error handling:
- If file storage fails, clean up DB record if created
- If enqueue fails, mark document as error

# Dependencies to inject:
- PrismaService (DB)
- Queue (BullMQ Queue instance for 'document-upload')
- QdrantService (for vector cleanup on delete)
- Maybe ConfigService for upload directory

# Storage approach:
- For MVP, store uploaded files in local filesystem (e.g., ./uploads/{tenantId}/{documentId}.{ext})
- Use fs promises to write file after validation
- Workers read from same path

# File cleanup:
- On successful processing, optionally delete local temp file after embedding complete? Could be done by worker after embedding or later. For simplicity, worker can delete file after processing to free space.

# DTOs:
- UploadRequest (multipart file) - not needed as service param is file object from Multer
- DocumentResponse: { id, filename, mimetype, size, status, error_message?, created_at }
- DocumentStatusResponse: { status, progress?, error_message? }

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create DTOs for document responses</name>
  <files>
    src/documents/dto/document-response.dto.ts
    src/documents/dto/document-status.dto.ts
  </files>
  <action>
    **document-response.dto.ts:**
    ```typescript
    import { IsInt, IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
    import { Type } from 'class-transformer';
    import { DocumentStatus } from '@prisma/client';

    export class DocumentResponseDto {
      @IsInt()
      id: number;

      @IsString()
      filename: string;

      @IsString()
      mimetype: string;

      @IsInt()
      size: number;

      @IsEnum(DocumentStatus)
      status: DocumentStatus;

      @IsOptional()
      @IsString()
      error_message?: string;

      @IsDateString()
      created_at: Date;
    }
    ```

    **document-status.dto.ts:**
    ```typescript
    import { IsEnum, IsOptional, IsInt } from 'class-validator';

    export enum DocumentStatus {
      QUEUED = 'queued',
      PROCESSING = 'processing',
      INDEXED = 'indexed',
      ERROR = 'error',
    }

    export class DocumentStatusResponseDto {
      @IsInt()
      documentId: number;

      @IsEnum(DocumentStatus)
      status: DocumentStatus;

      @IsOptional()
      @IsInt()
      progress?: number; // percent

      @IsOptional()
      @IsString()
      error_message?: string;
    }
    ```

    Verify: DTOs compile; class-validator decorators applied.
  </action>
  <verify>
    <automated>
      npx tsc --noEmit src/documents/dto/document-response.dto.ts &&
      npx tsc --noEmit src/documents/dto/document-status.dto.ts &&
      echo "Document DTOs created"
    </automated>
  </verify>
  <done>DocumentResponseDto and DocumentStatusResponseDto defined</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement DocumentsService core methods</name>
  <files>
    src/documents/documents.service.ts
  </files>
  <action>
    Create DocumentsService:

    ```typescript
    import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
    import { PrismaService } from '../shared/database/database.service';
    import { Queue } from 'bullmq';
    import { QdrantService } from '../shared/infrastructure/qdrant.service';
    import { promisify } from 'util';
    import * as fs from 'fs';
    import * as path from 'path';
    import { DocumentResponseDto } from './dto/document-response.dto';
    import { DocumentStatus } from '@prisma/client';

    const mkdir = promisify(fs.mkdir);
    const writeFile = promisify(fs.writeFile);

    @Injectable()
    export class DocumentsService {
      private readonly logger = new Logger(DocumentsService.name);
      private readonly UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

      constructor(
        private readonly prisma: PrismaService,
        private readonly queue: Queue, // 'document-upload' queue
        private readonly qdrant: QdrantService,
      ) {}

      async uploadFile(userId: number, tenantId: number, file: Express.Multer.File): Promise<DocumentResponseDto> {
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
        const document = await this.prisma.document.create({
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
        await mkdir(tenantDir, { recursive: true });

        // Save file
        const ext = path.extname(file.originalname);
        const filePath = path.join(tenantDir, `${document.id}${ext}`);
        await writeFile(filePath, file.buffer);

        // Enqueue processing job
        await this.queue.add('document-upload', {
          documentId: document.id,
          filePath,
          mimetype: file.mimetype,
        });

        this.logger.log(`Document uploaded: ${file.originalname} (id=${document.id}, tenant=${tenantId})`);

        return document as DocumentResponseDto;
      }

      async getDocumentStatus(documentId: number, userId: number, tenantId: number): Promise<DocumentStatusResponseDto> {
        const document = await this.prisma.document.findFirst({
          where: { id: documentId, user_id: userId, tenant_id: tenantId },
        });

        if (!document) {
          throw new NotFoundException('Document not found');
        }

        return {
          documentId: document.id,
          status: document.status,
          error_message: document.error_message,
        };
      }

      async listDocuments(userId: number, tenantId: number, options?: { take?: number; skip?: number }): Promise<DocumentResponseDto[]> {
        const documents = await this.prisma.document.findMany({
          where: { user_id: userId, tenant_id: tenantId },
          orderBy: { created_at: 'desc' },
          take: options?.take || 20,
          skip: options?.skip || 0,
        });

        return documents as DocumentResponseDto[];
      }

      async deleteDocument(documentId: number, userId: number, tenantId: number): Promise<void> {
        // Find document (ensure ownership)
        const document = await this.prisma.document.findFirst({
          where: { id: documentId, user_id: userId, tenant_id: tenantId },
        });

        if (!document) {
          throw new NotFoundException('Document not found');
        }

        // Soft delete: Update status to indicate deletion, or actually delete
        // For MVP we'll hard delete: remove document, chunks cascade
        await this.prisma.document.delete({ where: { id: documentId } });

        // Delete from Qdrant: find all chunk IDs for this document and delete
        const chunks = await this.prisma.documentChunk.findMany({
          where: { document_id: documentId },
        });
        const chunkIds = chunks.map(c => c.id);
        if (chunkIds.length > 0) {
          await this.qdrant.deletePoints('document_chunks', chunkIds);
        }

        // Delete local file if exists
        try {
          const ext = path.extname(document.filename);
          const filePath = path.join(this.UPLOAD_DIR, String(tenantId), `${documentId}${ext}`);
          await fs.unlink(filePath).catch(() => {}); // ignore if not exists
        } catch (e) {
          this.logger.warn(`Failed to delete file ${documentId}: ${e.message}`);
        }

        this.logger.log(`Document deleted: ${documentId} by user ${userId}`);
      }
    }
    ```

    **Important:** Need to provide Queue instance. In DocumentsModule we will create queue named 'document-upload' using BullMQ Queue and provide it.

    Verify: Service compiles, methods implemented, uses Prisma, Queue, Qdrant.
  </action>
  <verify>
    <automated>
      grep -q "uploadFile" src/documents/documents.service.ts &&
      grep -q "getDocumentStatus" src/documents/documents.service.ts &&
      grep -q "listDocuments" src/documents/documents.service.ts &&
      grep -q "deleteDocument" src/documents/documents.service.ts &&
      grep -q "prisma.document" src/documents/documents.service.ts &&
      echo "DocumentsService methods implemented"
    </automated>
  </verify>
  <done>DocumentsService with upload, status, list, delete complete</done>
</task>

</tasks>

<verification>
Wave 3c - DocumentsService ready

**Automated checks:**
1. DocumentsService file exists with methods: uploadFile, getDocumentStatus, listDocuments, deleteDocument
2. DTO files exist with validation decorators
3. uploadFile validates mimetype and size (max 50MB)
4. uploadFile creates Document record with status 'queued' and enqueues 'document-upload' job
5. Service queries always filter by user_id and tenant_id (tenant isolation)
6. deleteDocument removes document, cascades chunks (via DB), deletes from Qdrant, removes local file
7. TypeScript compiles for service and DTOs

**Requirements coverage:**
- DOC-02: File validation (type and size) in uploadFile ✓
- DOC-03: Status tracking via getDocumentStatus (queued/processing/indexed/error) ✓
- DOC-05: User sees document status (returned by listDocuments) ✓
- DOC-01: Provides uploadFile method called by controller (next plan) ✓
- Also deletion capability (good for UX)

**Dependencies:**
- PrismaService from 02c
- Queue (needs to be provided by DocumentsModule - will be created in 04e)
- QdrantService from 02d
- Local filesystem access (fs)

**Queue note:** The service injects Queue for 'document-upload'. In 04e we'll create and provide that Queue instance.

**Next:** 04d will create UploadController that uses this service.

</verification>

<success_criteria>
DocumentsService complete when:
- [ ] uploadFile accepts file (Multer), validates mimetype and size ≤50MB, returns DocumentResponseDto
- [ ] getDocumentStatus returns status and error_message for a specific document (scoped to user+tenant)
- [ ] listDocuments returns array of user's documents in tenant, ordered by created_at desc, with pagination
- [ ] deleteDocument removes document and related chunks from DB and Qdrant, deletes local file
- [ ] All DB queries filter by tenant_id and user_id for security
- [ ] DTOs defined with class-validator decorators
- [ ] `npx tsc --noEmit` passes for service and DTOs

**Deliverable:** Business logic layer for document management.

**Output:** `.planning/phases/01-backend-mvp/01-backend-mvp-04c-PLAN-04c-summary.md`

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-04c-PLAN-04c-summary.md`
