---
phase: 01-backend-mvp
plan: 04
type: execute
wave: 3
depends_on:
  - 02
  - 03
files_modified:
  - src/documents/documents.module.ts
  - src/documents/documents.controller.ts
  - src/documents/documents.service.ts
  - src/documents/processors/pdf.processor.ts
  - src/documents/processors/docx.processor.ts
  - src/documents/processors/txt.processor.ts
  - src/documents/chunking/text-splitter.service.ts
  - src/documents/jobs/document-upload.worker.ts
  - src/documents/jobs/embedding-generation.worker.ts
  - src/documents/dto/upload-response.dto.ts
autonomous: true
requirements:
  - DOC-01
  - DOC-02
  - DOC-03
  - DOC-04
  - DOC-05
  - DOC-06
  - DOC-07
  - DOC-08
user_setup: []
must_haves:
  truths:
    - "User can upload PDF, DOCX, TXT files up to 50MB with progress tracking"
    - "System validates file type (mime) and size before accepting upload"
    - "Uploaded documents are queued for async processing via BullMQ"
    - "Document status transitions: queued → processing → indexed/error"
    - "System extracts text using production-grade parsers (pdfjs-dist, mammoth)"
    - "Documents are chunked semantically (500-1500 tokens, 10-20% overlap)"
    - "Chunks are embedded via OpenAI and stored in Qdrant with tenant_id"
    - "Users can query document processing status and see errors"
  artifacts:
    - path: "src/documents/documents.module.ts"
      provides: "NestJS module for document processing with BullMQ"
    - path: "src/documents/documents.controller.ts"
      provides: "REST endpoints: POST /documents/upload, GET /documents/:id/status, GET /documents"
      endpoints:
        - "POST /documents/upload - accepts multipart/form-data, returns jobId"
        - "GET /documents/:id/status - returns document status and job progress"
        - "GET /documents - lists all tenant documents with metadata"
    - path: "src/documents/documents.service.ts"
      provides: "Document CRUD, status tracking, BullMQ queue management"
    - path: "src/documents/processors/pdf.processor.ts"
      provides: "PDF text extraction using pdfjs-dist with page separation"
    - path: "src/documents/processors/docx.processor.ts"
      provides: "DOCX text extraction using mammoth"
    - path: "src/documents/processors/txt.processor.ts"
      provides: "TXT text extraction (identity)"
    - path: "src/documents/chunking/text-splitter.service.ts"
      provides: "Semantic chunking with RecursiveCharacterTextSplitter and tiktoken"
    - path: "src/documents/jobs/document-upload.worker.ts"
      provides: "BullMQ worker processing document upload pipeline"
    - path: "src/documents/jobs/embedding-generation.worker.ts"
      provides: "BullMQ worker generating embeddings and upserting to Qdrant (or combined in same worker)"
  key_links:
    - from: "src/documents/documents.controller.ts"
      to: "src/documents/documents.service.ts"
      via: "documentQueue.add()"
      pattern: "documentQueue.add"
    - from: "src/documents/documents.service.ts"
      to: "BullMQ Queue"
      via: "queue.add('process-document', jobData)"
      pattern: "queue.add"
    - from: "src/documents/jobs/document-upload.worker.ts"
      to: "src/documents/processors/*.processor.ts"
      via: "extractText(switch on mimetype)"
      pattern: "extractText"
    - from: "src/documents/jobs/document-upload.worker.ts"
      to: "src/documents/chunking/text-splitter.service.ts"
      via: "splitter.split(text)"
      pattern: "splitText"
    - from: "src/documents/jobs/document-upload.worker.ts"
      to: "src/shared/infrastructure/openai.service.ts"
      via: "openai.generateEmbeddings(chunks)"
      pattern: "generateEmbeddings"
    - from: "src/documents/jobs/document-upload.worker.ts"
      to: "src/shared/infrastructure/qdrant.service.ts"
      via: "qdrant.upsertVectors(tenantId, documentId, chunks, embeddings)"
      pattern: "upsertVectors"
    - from: "src/documents/documents.service.ts"
      to: "src/shared/database/database.service.ts"
      via: "setTenantContext before DB ops"
      pattern: "setTenantContext"
    - from: "src/auth/auth.module.ts"
      to: "src/auth/middleware/tenant-context.middleware.ts"
      via: "APP_MIDDLEWARE provider"
      pattern: "APP_MIDDLEWARE"

---

<objective>
Implement document upload and processing pipeline with async BullMQ workers

Purpose: Enable users to upload documents that are processed asynchronously: text extraction, semantic chunking, embedding generation, vector storage. Track status from upload to indexed.

Output: Upload endpoint, document processors, chunking service, BullMQ workers, status tracking

</objective>

<execution_context>
@/Users/franciscoegloff/.claude/get-shit-done/workflows/execute-plan.md
@/Users/franciscoegloff/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-backend-mvp/01-CONTEXT.md
@.planning/phases/01-backend-mvp/01-RESEARCH.md

# Key research patterns:
- File upload: Multer with FileInterceptor, maxFileSize 50MB
- Status tracking: Document.status enum (queued, processing, indexed, error); Document.error_message nullable
- Job queue: BullMQ with Redis; worker processes: extract → chunk → embed → upsert
- Text extraction: pdfjs-dist (Node canvas required), mammoth, native fs
- Chunking: LangChain RecursiveCharacterTextSplitter, 1000 token size, 200 overlap, tiktoken for counting
- Embeddings: OpenAI batch (100 chunks per request), store in Qdrant with tenant_id + document_id + chunk_index
- Worker flow: Create document record (queued) → extract text → split → generate embeddings → upsert → mark indexed
- Error handling: Try/catch → update Document.status = error, log error_message

# Important notes:
- pdfjs-dist requires canvas package in Node; need to install npm dependencies: pdfjs-dist, canvas (with system libs)
- For MVP, we can use combined worker (single worker does all steps) rather than separate embedding worker
- BullMQ: Queue name 'document-processing', worker 'DocumentUploadWorker'
- Tenant context: DatabaseService.setTenantContext(tenantId) must be called in job before DB ops (pass tenantId in job data)

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create DocumentsModule and register BullMQ</name>
<files>
    src/documents/documents.module.ts
    src/documents/jobs/document-upload.worker.ts
  </files>
  <behavior>
    - Test 1: DocumentsModule imports BullMQModule (or registers Queue and Worker)
    - Test 2: Worker registered with queue 'document-processing' and processor 'process-document'
    - Test 3: Worker concurrency configured (2 jobs per worker as per RESEARCH)
    - Test 4: Module provides DocumentsService and DocumentUploadWorker
    - Test 5: Worker connects to Redis via RedisService
  </behavior>
  <action>
    Create DocumentsModule:

    1. documents.module.ts:
       - Imports: DatabaseModule, RedisModule, QdrantModule, OpenAIModule (or OpenAI service provider)
       - Provides: DocumentsService, PdfProcessor, DocxProcessor, TxtProcessor, TextSplitterService, DocumentUploadWorker
       - Optionally use BullMQModule.registerAsync if community module exists, or manual registration in worker itself

    2. document-upload.worker.ts (implements OnModuleInit, OnModuleDestroy):
       - Inject dependencies: pdfProcessor, docxProcessor, txtProcessor, splitter, openai, qdrant, documentsRepo (Prisma), redisService, logger
       - Create Worker<DocumentJobData> in constructor with processing function:
         * Extract text (switch mimetype)
         * Split text → chunks[]
         * Generate embeddings (batch via openai)
         * Upsert to Qdrant (with tenant_id, document_id=job.id)
         * Update document status (indexed or error)
       - Configure: concurrency: 2, autorun: false
       - Event handlers: on('failed', log error), on('completed', log success)
       - onModuleInit: worker.run()
       - onModuleDestroy: worker.close()

    Job data interface: { tenantId: number; userId: number; filename: string; mimetype: string; buffer: Buffer }

    Verify: Worker compiles and can be instantiated with dependencies.
  </action>
  <verify>
    <automated>grep -q "class DocumentUploadWorker" src/documents/jobs/document-upload.worker.ts && grep -q "new Worker" src/documents/jobs/document-upload.worker.ts && grep -q "concurrency: 2" src/documents/jobs/document-upload.worker.ts && echo "BullMQ worker defined"</automated>
  </verify>
  <done>DocumentsModule with BullMQ worker ready for injection</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement document processors</name>
  <files>
    src/documents/processors/pdf.processor.ts
    src/documents/processors/docx.processor.ts
    src/documents/processors/txt.processor.ts
  </files>
  <behavior>
    - Test 1: PdfProcessor.extractText(buffer) returns full text with page markers
    - Test 2: PdfProcessor preserves reading order (top-to-bottom sorting)
    - Test 3: DocxProcessor.extractText(buffer) returns raw text with paragraph preservation
    - Test 4: TxtProcessor.extractText(buffer) returns exact file content (identity)
    - Test 5: All processors throw UnsupportedError for invalid input (empty buffer)
  </behavior>
  <action>
    Implement processors as per RESEARCH examples:

    1. pdf.processor.ts:
       - Use getDocument from 'pdfjs-dist/legacy/build/pdf.js' or modern entry
       - Set GlobalWorkerOptions.workerSrc = require('pdfjs-dist/build/pdf.worker.entry')
       - extractText(buffer): getDocument({ data: buffer }); iterate pages; getTextContent; sort items by transform[5] (Y position); concatenate with "--- Page N ---" markers

    2. docx.processor.ts:
       - mammoth.extractRawText({ buffer }) → result.value
       - Log warnings if result.messages non-empty

    3. txt.processor.ts:
       - Return buffer.toString('utf-8') (identity)

    Verify: Each processor implements DocumentProcessor interface (define in shared types).
  </action>
  <verify>
    <automated>grep -q "extractText" src/documents/processors/pdf.processor.ts && grep -q "mammoth" src/documents/processors/docx.processor.ts && grep -q "toString('utf-8')" src/documents/processors/txt.processor.ts && echo "All processors implemented"</automated>
  </verify>
  <done>Production-grade document processors ready</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Implement semantic chunking with LangChain</name>
<files>
    src/documents/chunking/text-splitter.service.ts
  </files>
  <behavior>
    - Test 1: Splitter splits text into chunks of 500-1500 tokens (target 1000)
    - Test 2: Overlap between consecutive chunks is 10-20% (100-200 tokens)
    - Test 3: Splitter respects separators (paragraph boundaries first)
    - Test 4: Length function uses tiktoken for text-embedding-3-large (8192 max per chunk)
    - Test 5: Returns string[] of chunk content
  </behavior>
  <action>
    Create TextSplitterService using LangChain.js RecursiveCharacterTextSplitter:

    - Import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
    - Import { encoding_for_model } from 'js-tiktoken'
    - Constructor: instantiate splitter with config:
      * chunkSize: 1000 (tokens), chunkOverlap: 200 (tokens)
      * separators: ['\n\n\n', '\n\n', '\n', '. ', ' ', '']
      * lengthFunction: (text) => encoding_for_model('text-embedding-3-large').encode(text).length
    - Method: async split(text: string): Promise<string[]> calls this.splitter.splitText(text)

    Verify: Service compiles; splits sample text from research into 1000-token chunks.
  </action>
  <verify>
    <automated>grep -q "RecursiveCharacterTextSplitter" src/documents/chunking/text-splitter.service.ts && grep -q "encoding_for_model" src/documents/chunking/text-splitter.service.ts && grep -q "chunkSize: 1000" src/documents/chunking/text-splitter.service.ts && echo "TextSplitter configured"</automated>
  </verify>
  <done>Semantic chunking service with tiktoken token counting ready</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Create DocumentsService and queue management</name>
<files>
    src/documents/documents.service.ts
    src/documents/dto/upload-response.dto.ts
  </files>
  <behavior>
    - Test 1: uploadDocument(file, mimetype, tenantId, userId) creates Document record with status 'queued' and returns jobId
    - Test 2: uploadDocument validates file size (≤50MB) and mime (PDF, DOCX, TXT) - throws ValidationException if invalid
    - Test 3: getStatus(documentId, tenantId) returns Document with status and error_message if any
    - Test 4: listDocuments(tenantId) returns all tenant's documents with metadata (filename, mimetype, size, status, created_at)
    - Test 5: deleteDocument(documentId, tenantId) soft deletes or deletes document and associated chunks (cascade)
  </behavior>
  <action>
    Implement DocumentsService:

    - Methods:
      * async uploadDocument(file: Express.Multer.File, tenantId: number, userId: number): Promise<UploadResponse>
        - Validate: file.size ≤ 50 * 1024 * 1024; file.mimetype in ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
        - Create Document record: prisma.document.create({ data: { tenant_id: tenantId, user_id: userId, filename: file.originalname, mimetype: file.mimetype, size: file.size, status: 'queued' } })
        - Add job to queue: queue.add('process-document', { tenantId, userId, filename: file.originalname, mimetype, buffer: file.buffer })
        - Return { documentId: document.id, jobId: job.id, status: 'queued' }

      * async getStatus(documentId: number, tenantId: number): Promise<DocumentStatusResponse>
        - Find document by id AND tenant_id (RLS auto-filters but still add explicit check)
        - Return { id, filename, status, error_message, created_at }

      * async listDocuments(tenantId: number): Promise<Document[]>
        - prisma.document.findMany({ where: { tenant_id: tenantId }, orderBy: { created_at: 'desc' } })

      * async deleteDocument(documentId: number, tenantId: number): Promise<void>
        - Find document → ensure tenant_id matches
        - Delete from Qdrant: qdrantService.deletePoints(tenantId, documentId) - delete all chunks for document
        - Delete document record (cascade should delete DocumentChunk records in PostgreSQL if any)
        - Optionally: trigger cleanup job to ensure orphaned Qdrant points removed

    - Inject: PrismaService, Queue (BullMQ), QdrantService

    Verify: Service methods correspond to controller actions and status tracking requirements.
  </action>
  <verify>
    <automated>grep -q "async uploadDocument" src/documents/documents.service.ts && grep -q "queue.add" src/documents/documents.service.ts && grep -q "async listDocuments" src/documents/documents.service.ts && echo "DocumentsService methods implemented"</automated>
  </verify>
  <done>DocumentsService with upload, status, list, delete operations ready</done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: Create DocumentsController endpoints</name>
<files>
    src/documents/documents.controller.ts
  </files>
  <behavior>
    - Test 1: POST /documents/upload accepts multipart/form-data with 'file' field, requires authentication
    - Test 2: Upload returns 201 with { documentId, jobId, status: 'queued' }
    - Test 3: GET /documents/:id/status returns document metadata and status
    - Test 4: GET /documents lists all tenant documents (pagination optional)
    - Test 5: DELETE /documents/:id deletes document and triggers cascade cleanup
    - Test 6: Routes protected with @UseGuards(JwtAuthGuard, TenantContextGuard)
    - Test 7: File size validation (50MB) enforced via FileInterceptor limits
  </behavior>
  <action>
    Create DocumentsController:

    ```typescript
    @Controller('documents')
    @UseGuards(JwtAuthGuard, TenantContextGuard)
    export class DocumentsController {
      constructor(private documentsService: DocumentsService) {}

      @Post('upload')
      @UseInterceptors(FileInterceptor('file', {
        limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
        fileFilter: (req, file, callback) => {
          const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
          allowed.includes(file.mimetype) ? callback(null, true) : callback(new BadRequestException('Invalid file type'));
        },
      }))
      async upload(@UploadedFile() file: Express.Multer.File, @Req() req: Request): Promise<UploadResponse> {
        const tenantId = (req.user as JwtPayload).tenant_id;
        const userId = (req.user as JwtPayload).sub;
        return this.documentsService.uploadDocument(file, tenantId, userId);
      }

      @Get(':id/status')
      async getStatus(@Param('id') id: string, @Req() req: Request): Promise<DocumentStatusResponse> {
        const tenantId = (req.user as JwtPayload).tenant_id;
        return this.documentsService.getStatus(parseInt(id), tenantId);
      }

      @Get()
      async list(@Req() req: Request): Promise<Document[]> {
        const tenantId = (req.user as JwtPayload).tenant_id;
        return this.documentsService.listDocuments(tenantId);
      }

      @Delete(':id')
      async delete(@Param('id') id: string, @Req() req: Request): Promise<void> {
        const tenantId = (req.user as JwtPayload).tenant_id;
        await this.documentsService.deleteDocument(parseInt(id), tenantId);
      }
    }
    ```

    Verify: Controllers correctly extract tenantId and userId from JWT payload; use guards.
  </action>
  <verify>
    <automated>grep -q "@Controller('documents')" src/documents/documents.controller.ts && grep -q "FileInterceptor" src/documents/documents.controller.ts && grep -q "@UseGuards" src/documents/documents.controller.ts && echo "DocumentsController endpoints defined"</automated>
  </verify>
  <done>DocumentsController with upload, status, list, delete endpoints complete</done>
</task>

<task type="auto">
  <name>Task 6: Wire DocumentsModule into AppModule</name>
<files>
    src/app/app.module.ts
  </files>
  <action>
    Update src/app/app.module.ts to import DocumentsModule:

    ```typescript
    @Module({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
        DatabaseModule,
        RedisModule,
        QdrantModule,
        AuthModule,
        DocumentsModule, // ← Add
      ],
      // ...
    })
    ```

    Verify: Module imports in correct order (Auth before Documents since Documents may use auth guards); no circular dependencies.
  </action>
  <verify>
    <automated>grep -q "DocumentsModule" src/app/app.module.ts && echo "DocumentsModule integrated"</automated>
  </verify>
  <done>DocumentsModule imported into application root</done>
</task>

<task type="auto">
  <name>Task 7: Create DocumentRepository helper (optional abstraction)</name>
<files>
    src/documents/documents.repository.ts
    src/documents/dto/document-status-response.dto.ts
  </files>
  <action>
    Create DocumentsRepository (optional but good pattern) with methods:

    - createDocument(data: CreateDocumentData): Promise<Document>
    - updateStatus(documentId: number, status: DocumentStatus, error?: string): Promise<Document>
    - findById(documentId: number, tenantId: number): Promise<Document | null>
    - findAllForTenant(tenantId: number): Promise<Document[]>
    - delete(documentId: number, tenantId: number): Promise<void> (also triggers Qdrant cleanup)

    And DTOs:
    - UploadResponseDto: { documentId: number; jobId: string; status: string }
    - DocumentStatusResponseDto extends Document but excludes buffer/size details maybe

    Verify: Repository encapsulates Prisma queries; service uses repository.
  </action>
  <verify>
    <automated>[ -f src/documents/documents.repository.ts ] && grep -q "createDocument" src/documents/documents.repository.ts || echo "Repository optional but recommended"</automated>
  </verify>
  <done>DocumentsRepository abstraction created (if used by service)</done>
</task>

</tasks>

<verification>
Wave 4 - Document Processing Pipeline Complete

**Automated verification:**
1. Unit tests (from Plan 01): `npx jest tests/documents/*.spec.ts --runInBand`
   - Documents controller tests: upload validation, status endpoints
   - Processor tests: PDF, DOCX, TXT extraction on fixtures
   - Chunking tests: semantic splitting with correct token counts and overlap
   - Queue service: job creation with correct data
2. Integration test: `npx jest tests/integration/document-lifecycle.integration.spec.ts --runInBand`
   - Upload → job queued → worker processes → status indexed → Qdrant points created
3. Manual API test (with test server):
   - POST /documents/upload with sample PDF → 201 {documentId, jobId}
   - GET /documents/:id/status → eventually returns 'indexed'
   - GET /documents → lists uploaded file
   - DELETE /documents/:id → cascades cleanup

**Requirements mapping:**
- DOC-01: Upload endpoint with drag/drop (frontend handles UI; backend provides API)
- DOC-02: File validation (size 50MB, mime types)
- DOC-03: Status tracking via document.status and GET /documents/:id/status
- DOC-04: Async processing via BullMQ
- DOC-05: Status transitions: queued → processing → indexed/error
- DOC-06: Production-grade parsers (pdfjs-dist, mammoth, fs)
- DOC-07: Semantic chunking with 500-1500 tokens, 10-20% overlap
- DOC-08: Embeddings via OpenAI + Qdrant upsert with tenant_id

**Critical checks:**
- Worker sets tenant context: In document-upload.worker, before any DB ops, call `databaseService.setTenantContext(job.data.tenantId)`
- Embedding batch size: 100 chunks per OpenAI request to avoid rate limits
- Qdrant upsert payload includes tenant_id, document_id, chunk_index, content, indexed_at
- Error handling: Worker catches errors, updates Document.status = 'error', logs error_message
- File size validated at controller (Multer limits) AND service (double-check)

**External dependencies:**
- pdfjs-dist requires system libraries for Node canvas. Install: `npm install pdfjs-dist canvas` and system lib: `brew install pkg-config cairo pango libpng jpeg gif librsvg` (or use npx envinfo)
- BullMQ queue runs only when worker module loaded (eager in DocumentsModule)

**Security:**
- Upload endpoints protected by JwtAuthGuard + TenantContextGuard
- All DB queries filter by tenant_id (RLS ensures enforcement)
- File content never stored in Redis (only buffer temporarily in job data; for large files might need S3 but 50MB fits Redis memory for MVP)

</verification>

<success_criteria>
Document pipeline complete when:
- [ ] DocumentsModule imports Database, Redis, Qdrant, OpenAI services
- [ ] DocumentUploadWorker runs with concurrency=2, processes jobs successfully
- [ ] PdfProcessor extracts multi-page text with page markers using pdfjs-dist
- [ ] DocxProcessor extracts clean text with mammoth
- [ ] TxtProcessor returns exact content
- [ ] TextSplitterService splits text into 500-1500 token chunks with 200 token overlap using tiktoken
- [ ] DocumentsService.uploadDocument validates size (50MB) and mime, creates Document + adds BullMQ job
- [ ] DocumentsController: POST /documents/upload returns 201 with jobId; GET /documents returns list; DELETE cascades cleanup
- [ ] Integration test: upload PDF → get status 'indexed' → Qdrant collection has points with tenant_id payload
- [ ] Worker updates Document.status from 'queued' → 'processing' (implied) → 'indexed' or 'error'
- [ ] All document unit tests pass: `npx jest tests/documents/*.spec.ts`

**Performance:**
- [ ] Embedding generation: at least 10 pages/minute (≈ 60 chunks/min) achievable with batch size 100 and rate limiting delays
- [ ] Worker processes 2 jobs concurrently without memory leaks

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-04-PLAN-04-summary.md`
</output>
