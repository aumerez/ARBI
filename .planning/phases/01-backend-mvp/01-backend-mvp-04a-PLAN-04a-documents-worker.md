---
phase: 01-backend-mvp
plan: 04a
type: execute
wave: 13
depends_on:
  - 02f
  - 03c
files_modified:
  - src/documents/processors/pdf.processor.ts
  - src/documents/processors/docx.processor.ts
  - src/documents/processors/txt.processor.ts
  - src/documents/jobs/document-upload.worker.ts
  - src/documents/jobs/embedding-generation.worker.ts
autonomous: true
requirements:
  - DOC-01
  - DOC-02
  - DOC-03
  - DOC-04
user_setup: []
must_haves:
  truths:
    - "PDFProcessor extracts text from PDF files using pdfjs-dist"
    - "DOCXProcessor extracts text from DOCX files using mammoth"
    - "TXTProcessor reads plain text files"
    - "DocumentUploadWorker processes upload jobs: validates, extracts text, creates DocumentChunk records"
    - "EmbeddingGenerationWorker generates embeddings for chunks using OpenAI and stores in Qdrant"
    - "All processors handle errors gracefully and update Document status (indexed or error)"
  artifacts:
    - path: "src/documents/processors/pdf.processor.ts"
      provides: "PDF text extraction using pdfjs-dist"
      min_lines: 20
    - path: "src/documents/processors/docx.processor.ts"
      provides: "DOCX text extraction using mammoth"
      min_lines: 20
    - path: "src/documents/processors/txt.processor.ts"
      provides: "Plain text file reader"
      min_lines: 10
    - path: "src/documents/jobs/document-upload.worker.ts"
      provides: "BullMQ worker for document upload processing"
      min_lines: 50
    - path: "src/documents/jobs/embedding-generation.worker.ts"
      provides: "BullMQ worker for embedding generation"
      min_lines: 50
  key_links:
    - from: "src/documents/jobs/document-upload.worker.ts"
      to: "src/documents/processors/*.processor.ts"
      via: "dispatches to appropriate processor based on mimetype"
      pattern: "PDFProcessor|DOCXProcessor|TXTProcessor"
    - from: "src/documents/jobs/embedding-generation.worker.ts"
      to: "src/shared/infrastructure/openai.service.ts"
      via: "calls OpenAI embeddings API"
      pattern: "openai.*embeddings"
    - from: "src/documents/jobs/embedding-generation.worker.ts"
      to: "src/shared/infrastructure/qdrant.service.ts"
      via: "upserts vectors to Qdrant"
      pattern: "qdrant.*upsert"
    - from: "src/documents/jobs/document-upload.worker.ts"
      to: "prisma.document, prisma.documentChunk"
      via: "updates status and creates chunks"
      pattern: "prisma\\.document\\.update|prisma\\.documentChunk\\.create"

---

<objective>
Implement document processing pipeline with BullMQ workers and format-specific processors

Purpose: Build the asynchronous processing backbone for document ingestion. Uploads are validated, parsed, chunked, and embedded via job queues with proper error handling and status tracking.

Output: Complete document processing workers and text extractors for PDF, DOCX, TXT

</objective>

<execution_context>
@/Users/franciscoegloff/projects/metacortex/ops-ai-platform/.planning/workflows/execute-plan.md
@/Users/franciscoegloff/projects/metacortex/ops-ai-platform/.planning/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-backend-mvp/01-CONTEXT.md
@.planning/phases/01-backend-mvp/01-RESEARCH.md
@.planning/phases/01-backend-mvp/01-backend-mvp-02e-PLAN-02e-provider-services.md
@.planning/phases/01-backend-mvp/01-backend-mvp-02c-PLAN-02c-database-service.md

# BullMQ Worker Pattern
- Worker extends BullMQ's Worker class
- Processes jobs from Redis queue
- Each job type: document-upload, embedding-generation
- Use async/await; update job progress via job.progress/update
- On success: mark document as indexed; on error: mark document as error with error_message

# Text Extractors (from RESEARCH)
- PDF: pdfjs-dist (Node.js build requires canvas/canvas-prebuilt)
- DOCX: mammoth (extracts raw text, preserves basic structure)
- TXT: fs.promises.readFile with 'utf8'
- All return plain text string

# Job Flow
1. document-upload worker receives job with documentId, file path, mimetype
2. Calls appropriate processor to extract text
3. Splits text into chunks (using TextSplitter service from 04b - but we can implement basic chunking here or call service)
4. Creates DocumentChunk records in DB (initial, without embeddings)
5. Enqueues embedding-generation job for each batch of chunks
6. Updates Document status to 'indexed' (or 'error' if fails)

5. embedding-generation worker receives job with chunkIds
6. Loads chunks from DB, generates embeddings via OpenAI provider
7. Upserts to Qdrant with payload: { chunk_id, document_id, tenant_id, content, embedding }
8. Marks chunks as processed (could set embedding_generated flag or just rely on presence in Qdrant)

# Error Handling
- Try/catch each step; on error, update Document.status = 'error' and error_message
- Log errors with context (documentId, error stack)
- Continue processing other chunks even if one fails? Better: mark individual chunk errors, not entire document.

# BullMQ Configuration (from 02d)
- Redis connection from RedisService
- Queue names: 'document-upload', 'embedding-generation'
- Concurrency: can set (e.g., 2 for upload, 4 for embedding)
- Job retries: exponential backoff (max 3 attempts)

# Files to create (following structure from RESEARCH):
- src/documents/processors/pdf.processor.ts
- src/documents/processors/docx.processor.ts
- src/documents/processors/txt.processor.ts
- src/documents/jobs/document-upload.worker.ts
- src/documents/jobs/embedding-generation.worker.ts

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create text extraction processors</name>
  <files>
    src/documents/processors/pdf.processor.ts
    src/documents/processors/docx.processor.ts
    src/documents/processors/txt.processor.ts
  </files>
  <action>
    Implement three processor classes/functions:

    **pdf.processor.ts:**
    ```typescript
    import { PDFLoader } from 'pdfjs-dist/legacy/build/pdf.latest';
    import * as fs from 'fs';
    import { promisify } from 'util';
    import * as path from 'path';

    const readFile = promisify(fs.readFile);

    export class PDFProcessor {
      async extractText(filePath: string): Promise<string> {
        const data = await readFile(filePath);
        const loadingTask = PDFLoader.loadDocument(data);
        const pdf = await loadingTask.promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          fullText += pageText + '\n';
        }

        return fullText;
      }
    }
    ```

    **docx.processor.ts:**
    ```typescript
    import * as mammoth from 'mammoth';
    import * as fs from 'fs';
    import { promisify } from 'util';

    const readFile = promisify(fs.readFile);

    export class DOCXProcessor {
      async extractText(filePath: string): Promise<string> {
        const buffer = await readFile(filePath);
        const result = await mammoth.extractRawText({ buffer });
        return result.value; // plain text
      }
    }
    ```

    **txt.processor.ts:**
    ```typescript
    import * as fs from 'fs';
    import { promisify } from 'util';

    const readFile = promisify(fs.readFile);

    export class TXTProcessor {
      async extractText(filePath: string): Promise<string> {
        return await readFile(filePath, 'utf8');
      }
    }
    ```

    **Dependencies:** Ensure package.json includes `pdfjs-dist` and `mammoth`. For pdfjs-dist in Node, need canvas? pdfjs-dist has legacy build that works without canvas for text extraction. We'll use that.

    Verify: Each processor compiles, exports class with extractText(filePath: string): Promise<string> method.
  </action>
  <verify>
    <automated>
      npx tsc --noEmit src/documents/processors/pdf.processor.ts &&
      npx tsc --noEmit src/documents/processors/docx.processor.ts &&
      npx tsc --noEmit src/documents/processors/txt.processor.ts &&
      echo "All processors compile"
    </automated>
  </verify>
  <done>PDF, DOCX, TXT processors implemented with extractText methods</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement BullMQ workers for document upload and embedding generation</name>
  <files>
    src/documents/jobs/document-upload.worker.ts
    src/documents/jobs/embedding-generation.worker.ts
  </files>
  <action>
    Create BullMQ workers that process jobs asynchronously.

    **document-upload.worker.ts:**
    ```typescript
    import { Worker, Job } from 'bullmq';
    import { Redis } from 'ioredis';
    import { PrismaService } from '../../shared/database/database.service';
    import { PDFProcessor } from '../processors/pdf.processor';
    import { DOCXProcessor } from '../processors/docx.processor';
    import { TXTProcessor } from '../processors/txt.processor';
    import { TextSplitterService } from '../chunking/text-splitter.service'; // from 04b

    export class DocumentUploadWorker extends Worker {
      constructor(
        private readonly prisma: PrismaService,
        private readonly redis: Redis,
      ) {
        super(
          'document-upload',
          async (job: Job) => {
            const { documentId, filePath, mimetype } = job.data;

            try {
              // Update document status to processing
              await prisma.document.update({
                where: { id: documentId },
                data: { status: 'processing' },
              });

              // Extract text based on mimetype
              let text: string;
              if (mimetype === 'application/pdf') {
                const processor = new PDFProcessor();
                text = await processor.extractText(filePath);
              } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                const processor = new DOCXProcessor();
                text = await processor.extractText(filePath);
              } else if (mimetype === 'text/plain') {
                const processor = new TXTProcessor();
                text = await processor.extractText(filePath);
              } else {
                throw new Error(`Unsupported mimetype: ${mimetype}`);
              }

              // Chunk the text (using TextSplitterService - to be created in 04b)
              // For now we can create a basic splitter inline or call service
              // We'll create chunks directly with CharacterTextSplitter from LangChain
              const splitter = new (await import('@langchain/textsplitters')).RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
                separators: ['\n\n', '\n', '. ', ' ', ''],
              });
              const rawChunks = await splitter.splitText(text);

              // Create DocumentChunk records
              for (let i = 0; i < rawChunks.length; i++) {
                await prisma.documentChunk.create({
                  data: {
                    tenant_id: 0, // will be set from document's tenant_id
                    document_id: documentId,
                    chunk_index: i,
                    content: rawChunks[i],
                    token_count: Math.ceil(rawChunks[i].length / 4), // rough estimate
                  },
                });
              }

              // Enqueue embedding-generation jobs for these chunks
              const chunkIds = rawChunks.map((_, i) => /* get chunk id */ 0); // need to fetch created chunks

              // Better: create chunks and collect IDs in one transaction or after creation
              // We'll fetch them by document_id and indices
              const chunks = await prisma.documentChunk.findMany({
                where: { document_id: documentId },
                orderBy: { chunk_index: 'asc' },
              });
              const chunkIdList = chunks.map(c => c.id);

              // Add jobs to embedding-generation queue
              for (const chunkId of chunkIdList) {
                await this.queue.add('embedding-generation', { chunkId });
              }

              // Update document status to indexed
              await prisma.document.update({
                where: { id: documentId },
                data: { status: 'indexed' },
              });

              job.updateProgress(100);
            } catch (error: any) {
              // Mark document as error
              await prisma.document.update({
                where: { id: documentId },
                data: { status: 'error', error_message: error.message },
              });
              throw error; // BullMQ will handle retry
            }
          },
          {
            connection: this.redis,
            concurrency: 2,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          }
        );
      }
    }
    ```

    **embedding-generation.worker.ts:**
    ```typescript
    import { Worker, Job } from 'bullmq';
    import { Redis } from 'ioredis';
    import { PrismaService } from '../../shared/database/database.service';
    import { QdrantService } from '../../shared/infrastructure/qdrant.service';
    import { OpenAIEmbeddingsService } from '../../shared/infrastructure/openai.service';

    export class EmbeddingGenerationWorker extends Worker {
      constructor(
        private readonly prisma: PrismaService,
        private readonly qdrant: QdrantService,
        private readonly openai: OpenAIEmbeddingsService,
        private readonly redis: Redis,
      ) {
        super(
          'embedding-generation',
          async (job: Job) => {
            const { chunkId } = job.data;

            try {
              // Load chunk
              const chunk = await prisma.documentChunk.findUnique({
                where: { id: chunkId },
                include: { document: true },
              });

              if (!chunk) {
                throw new Error(`Chunk ${chunkId} not found`);
              }

              // Generate embedding
              const embedding = await openai.createEmbedding([chunk.content]);

              // Upsert to Qdrant
              await qdrant.upsertPoint({
                collection: 'document_chunks',
                id: chunkId,
                vector: embedding[0],
                payload: {
                  chunk_id: chunkId,
                  document_id: chunk.document_id,
                  tenant_id: chunk.tenant_id,
                  content: chunk.content,
                },
              });

              // Optionally mark chunk as embedded (add field in schema? Could be inferred)
              job.updateProgress(100);
            } catch (error: any) {
              // Log error; could retry
              console.error(`Embedding generation failed for chunk ${chunkId}:`, error);
              throw error;
            }
          },
          {
            connection: this.redis,
            concurrency: 4,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 3000,
            },
          }
        );
      }
    }
    ```

    **Important:** Need to configure these workers as global providers in DocumentsModule (04e). They should be instantiated on application bootstrap.

    Verify: Workers compile; extend BullMQ Worker correctly; have async processor; handle errors.
  </action>
  <verify>
    <automated>
      grep -q "extends Worker" src/documents/jobs/document-upload.worker.ts &&
      grep -q "extends Worker" src/documents/jobs/embedding-generation.worker.ts &&
      grep -q "PDFProcessor\|DOCXProcessor\|TXTProcessor" src/documents/jobs/document-upload.worker.ts &&
      echo "BullMQ workers structured correctly"
    </automated>
  </verify>
  <done>Document upload and embedding generation workers implemented</done>
</task>

</tasks>

<verification>
Wave 3a - Document processing workers ready

**Automated checks:**
1. All processor files exist and compile: `npx tsc --noEmit src/documents/processors/*.ts`
2. Worker files extend `bullmq.Worker` correctly
3. Workers reference correct queues: 'document-upload', 'embedding-generation'
4. PDFProcessor uses pdfjs-dist, DOCXProcessor uses mammoth, TXTProcessor uses fs
5. Worker processor functions are defined with async (job: Job) => {...}
6. Error handling updates Document.status to 'error' on failure
7. Successful upload enqueues embedding-generation jobs
8. Embedding worker calls OpenAI and Qdrant

**Requirements coverage:**
- DOC-01: Upload acceptance (endpoint in 04d, these workers process)
- DOC-02: Validation (size/mimetype check should happen in controller pre-worker)
- DOC-03: Status tracking (queued → processing → indexed/error)
- DOC-04: Async processing via BullMQ
- DOC-06: Text extraction via processors

**Note:** Chunking service (04b) will be called by document-upload worker. We're importing TextSplitterService tentatively; it will be created in 04b.

**Dependencies:**
- Redis from 02d (Redis service)
- Qdrant from 02d
- OpenAI from 02e
- Prisma from 02c

**Next:** 04b (Chunking service & embedding integration) has dependency on this plan for processors; but processors are independent. We can parallelize 04a and 04b if no file conflicts. However 04a's worker may import TextSplitterService from 04b. That creates dependency. To break the cycle, either (a) defer TextSplitterService import until after 04b, or (b) make 04a independent and use simple inline chunking for now, refactor later. Simpler: make 04b first, then 04a depends on 04b. But wave assignment based on current plan: 04a → 04b → 04c → 04d. We'll keep that order. So 04a should not import from 04b. Instead we'll implement a basic chunking inline in the worker, to be replaced/refactored by TextSplitterService in 04b. That's acceptable for MVP.

Thus document-upload.worker will implement simple chunking inline (character-based) and later we'll enhance. We'll note that.

Proceed with that approach: 04a implements processors + workers with basic chunking.

</verification>

<success_criteria>
Plan 04a complete when:
- [ ] PDF, DOCX, TXT processors implemented with extractText(filePath) returning string
- [ ] DocumentUploadWorker extends BullMQ Worker, processes 'document-upload' queue
- [ ] EmbeddingGenerationWorker extends BullMQ Worker, processes 'embedding-generation' queue
- [ ] Workers handle errors, update Document.status appropriately
- [ ] DocumentUploadWorker creates DocumentChunk records and enqueues embedding jobs
- [ ] EmbeddingGenerationWorker calls OpenAI embeddings and Qdrant upsert
- [ ] All TypeScript files compile with `npx tsc --noEmit`
- [ ] Worker concurrency and retry settings configured
- [ ] Basic inline chunking implemented (will be replaced by 04b)

**Deliverable:** Asynchronous document processing pipeline foundation with format extraction and embedding pipeline.

**Output:** `.planning/phases/01-backend-mvp/01-backend-mvp-04a-PLAN-04a-summary.md`

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-04a-PLAN-04a-summary.md`
</output>
