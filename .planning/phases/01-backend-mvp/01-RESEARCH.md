# Phase 1: Backend MVP - Research

**Researched:** 2025-03-08
**Domain:** RAG Pipeline Architecture, Multi-Tenant Backend Services
**Confidence:** HIGH

## Summary

Phase 1 delivers a complete backend API for a RAG-based document chat system with multi-tenant authentication. The standard stack is NestJS (Node.js/TypeScript) with PostgreSQL (RLS for tenant isolation), Qdrant (vector storage), BullMQ (async job queue), OpenAI embeddings, and Anthropic Claude API for generation.

**Primary recommendation:** Use NestJS modules to enforce boundaries: AuthModule (JWT + RLS context), DocumentsModule (async processing pipeline), ChatModule (RAG with hybrid search), and SharedModule (common guards, DTOs, interfaces). Implement tenant isolation at three levels: database row-level security (PostgreSQL RLS), vector collection filtering (Qdrant payload), and application-level guards (JWT tenant_id).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Authentication & Multi-Tenancy
- Email/password authentication (not SSO for MVP)
- JWT-based sessions with persistent cookies
- Password reset via email (forgot password flow)
- Tenant isolation enforced at database level via PostgreSQL Row Level Security (RLS)
- All queries automatically filter by tenant_id from JWT context
- Multi-tenancy baked into EVERY data operation (cannot be retrofitted)

#### Document Processing
- Supported formats: PDF, DOCX, TXT (minimum viable)
- Production-grade parsers: pdfjs-dist for PDF, mammoth for DOCX, native for TXT
- Chunking strategy: semantic-aware recursive splitting with 10-20% overlap (100-200 tokens)
- Target chunk size: 500-1500 tokens (preserves procedure boundaries)
- Processing: asynchronous via BullMQ job queue (Redis-backed)
- Maximum file size: 50MB per document
- Status tracking: queued → processing → indexed/error

#### RAG Pipeline
- Embedding model: OpenAI `text-embedding-3-large` (3072 dimensions, 8192 token context)
- Vector database: Qdrant with tenant-scoped collections (filter on tenant_id)
- Hybrid search: semantic (dense vectors 0.7 weight) + BM25 (lexical 0.3 weight) with RRF fusion
- Retrieval: top-k chunks (k=10-20) with reranking via cross-encoder (ms-marco-MiniLM-L-6-v2)
- LLM: Anthropic Claude API with citation support (`<cite>` tags)
- Streaming responses enabled for chat UX
- Strict grounding: refuse to answer if no relevant context retrieved
- Citation validation: inline [1], [2] linking to source document snippets

#### Chat Interface (Backend API)
- Conversation history: stored per user, within session persistence
- New conversation creation via POST /chats
- List past conversations with preview
- Delete conversations (cascade cleanup)
- Streaming responses via Server-Sent Events (SSE)
- User can send queries and receive grounded responses with citations
- Error handling: clear messages, retry logic for transient failures

#### Quality & Compliance (Locked)
- No hallucinations policy: system must refuse when context insufficient
- Citation accuracy mandatory: validate retrieved sources before including citations
- Audit logging: all queries/responses logged with tenant_id, user_id, timestamp
- Document versioning: append-only upload history, soft deletes
- Rate limiting: per-user JWT-based limits to prevent abuse
- Encryption: API keys and secrets encrypted at rest

#### Tech Stack (from Research)
- Backend: NestJS (Node.js + TypeScript)
- Database: PostgreSQL with pgvector extension for metadata + Qdrant for vectors
- Queue: BullMQ (Redis)
- Embeddings: OpenAI API (not self-hosted for MVP)
- LLM: Anthropic Claude API
- API: OpenAPI spec defined before implementation
- Authentication: JWT + bcrypt password hashing

### Claude's Discretion

Research options, make recommendations:
- Demo content strategy (pre-loaded oil & gas documents)
- Rate limiting thresholds and algorithms
- Redis cluster configuration vs standalone
- Error handling patterns and retry strategies
- Soft delete implementation approach

### Deferred Ideas (OUT OF SCOPE)

These belong to later phases (not in scope for Phase 1):
- SSO/SAML/OAuth integration (Phase 2+ per enterprise contracts)
- Advanced document formats: tables, images/OCR, CAD/DWG, spreadsheets (Phase 5+)
- Query expansion, acronym resolution (Phase 5+ differentiators)
- Hybrid search tuning and reranker optimization (Phase 3 refinement)
- User roles and management UI (admin/editor/viewer) (Phase 2+)
- Project/workspace organization (Phase 2+)
- Export chat conversations (Phase 2+)
- Usage analytics dashboard (Phase 5+)
- Fine-tuned embeddings on industrial corpus (Phase 5+)
- Mobile apps (out of scope for MVP entirely)

</user_constraints>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can sign up with email and password (email verification required) | NestJS Passport strategy with bcrypt + JWT; email verification flows |
| AUTH-02 | User can log in with credentials and receive persistent session (JWT) | JWT access/refresh tokens with httpOnly cookies; persistent sessions |
| AUTH-03 | User can log out from any page (session invalidation) | JWT blacklist/refresh token revocation pattern |
| AUTH-04 | User can reset password via email link | Password reset token + email workflow |
| TEN-01 | System enforces tenant isolation at database level (PostgreSQL RLS) | PostgreSQL RLS policies with SET app.current_tenant from JWT |
| TEN-02 | All data operations automatically filter by tenant context (metadata tenant_id) | Database-level enforcement via RLS + application guards |
| TEN-03 | Users can only access their own tenant's documents and chat history | RLS + API guards ensure tenant-scoped queries |
| DOC-01 | User can upload documents (PDF, DOCX, TXT) with drag-and-drop and file picker | NestJS FileInterceptor, Multer; multi-part upload endpoint |
| DOC-02 | System validates file type and size (max 50MB per document) | File validation middleware (mime types, file size before queue) |
| DOC-03 | System displays upload progress indicator | Frontend polling; backend status endpoint |
| DOC-04 | System processes uploaded documents asynchronously with status tracking | BullMQ job queue with jobs/by-id/:id status endpoint |
| DOC-05 | User sees document status: Queued, Processing, Indexed, Error | Job status from BullMQ stored in PostgreSQL documents table |
| DOC-06 | System extracts text content from documents using production-grade parsers | pdfjs-dist for PDF (Node canvas), mammoth for DOCX, native fs for TXT |
| DOC-07 | System chunks documents with semantic awareness (respects sections, 500-1500 tokens) | LangChain.js RecursiveCharacterTextSplitter with separators |
| DOC-08 | System generates embeddings for chunks and stores in vector database with tenant_id | OpenAI text-embedding-3-large; upsert to Qdrant with tenant_id payload |
| CHAT-01 | User can open chat interface with natural language text input | POST /chats endpoint to create conversation |
| CHAT-02 | System retrieves relevant document chunks using hybrid search (semantic + BM25) | Qdrant hybrid search with density 0.7, bm25 0.3, RRF fusion |
| CHAT-03 | System generates responses using Claude API grounded in retrieved context | Claude messages API with retrieved chunks in system prompt |
| CHAT-04 | System includes inline citations ([1], [2]) linking to source documents | Citation generation from chunk metadata; Claude citation block support |
| CHAT-10 | System provides streaming responses (type-out effect) | Server-Sent Events (SSE) with Claude streaming API |
| CHAT-11 | System refuses to answer when no relevant context is found (no hallucinations) | No-context guard: check retrieval score threshold; return refusal message |
| CHAT-12 | System indicates confidence/grounding when sources are weak | Confidence score from retrieval; display warning to user |
| QUAL-03 | System validates response citations against retrieved sources (no fake citations) | Post-generation validation: verify cited chunk IDs exist in retrieved set |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **NestJS** | ^10.x | Backend application framework | Enterprise-grade modular architecture, built-in DI, guards, interceptors, decorators |
| **TypeScript** | ^5.x | Type safety & developer experience | Compile-time error detection; essential for complex RAG pipeline |
| **PostgreSQL** | 15+ | Relational data store | Mature, RLS support, pgvector extension for metadata search |
| **Qdrant** | 1.9+ | Vector database | Rust-based performance, native collection filtering, hybrid search, TypeScript client |
| **BullMQ** | ^5.x | Job queue | Redis-backed, reliable, supports retries, concurrency, delayed jobs |
| **OpenAI API** | Latest | Embeddings | text-embedding-3-large (3072 dims, 8192 tokens), proven quality, cost-effective |
| **Anthropic Claude API** | Latest | LLM generation | Strong citation support, streaming, reasoning capability |
| **LangChain.js** | ^0.3.x | RAG utilities | Document loaders, text splitters, parser abstractions |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt` | ^10.x | Authentication | JWT strategy with persistent cookies; cookie-parser middleware |
| `bcrypt` | ^5.x | Password hashing | Salt rounds 12; sync during registration, async during login |
| `pdfjs-dist` | ^4.x | PDF text extraction | Production-grade PDF parsing; Node canvas required |
| `mammoth` | ^1.x | DOCX text extraction | Extract raw text from .docx files reliably |
| `bullmq` | ^5.x | Job processing | Upload jobs, embedding generation, indexing workers |
| `ioredis` | ^5.x | Redis client | BullMQ requires Redis connection |
| `@qdrant/js-client-rest` | ^1.x | Vector operations | Qdrant REST client for upsert/search |
| `@langchain/textsplitters` | ^0.3.x | Document chunking | RecursiveCharacterTextSplitter with semantic separators |
| `openai` | ^4.x | Embedding generation | OpenAI Node.js client; embeddings.create() |
| `@anthropic-ai/sdk` | ^0.30.x | Claude API | Messages API with streaming; citation handling |
| `class-validator` + `class-transformer` | ^0.14.x | DTO validation | Request payload validation with decorators |
| `@nestjs/swagger` | ^7.x | OpenAPI spec | Auto-generate API documentation from decorators |
| `winston` + `nestjs-winston` | ^3.x | Logging | Structured logging with request context |
| `helmet` | ^7.x | Security headers | Express middleware for security best practices |
| `rate-limiter-flexible` | ^3.x | Rate limiting | Redis-based sliding window; per-user limits |
| `uuid` | ^9.x | ID generation | UUID v4 for documents, chats, jobs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PostgreSQL with RLS | Separate databases per tenant | Higher infrastructure cost; harder to manage; RLS simpler for MVP |
| Qdrant | pgvector (PostgreSQL) | pgvector simpler ops but limited scalability, no native hybrid search |
| BullMQ | Kafka/RabbitMQ | Overkill complexity; BullMQ sufficient for MVP async processing |
| OpenAI embeddings | self-hosted (sentence-transformers) | Self-hosted adds infra burden; OpenAI cost-effective for MVP |
| Anthropic Claude | OpenAI GPT-4 | Both capable; Claude's citation support matches requirements |
| LangChain.js | custom RAG code | Hand-rolling increases bugs; LangChain battle-tested patterns |

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── local.strategy.ts
│   ├── dto/
│   │   ├── login.dto.ts
│   │   ├── register.dto.ts
│   │   └── password-reset.dto.ts
│   └── guards/
│       ├── jwt-auth.guard.ts
│       └── tenant-context.guard.ts
├── documents/
│   ├── documents.module.ts
│   ├── documents.controller.ts
│   ├── documents.service.ts
│   ├── processors/
│   │   ├── pdf.processor.ts
│   │   ├── docx.processor.ts
│   │   └── txt.processor.ts
│   ├── chunking/
│   │   ├── text-splitter.service.ts
│   │   └── semantic-chunker.ts
│   └── jobs/
│       ├── document-upload.worker.ts
│       └── embedding-generation.worker.ts
├── chat/
│   ├── chat.module.ts
│   ├── chat.controller.ts
│   ├── chat.service.ts
│   ├── retrieval/
│   │   ├── hybrid-search.service.ts
│   │   ├── reranker.service.ts
│   │   └── qdrant.service.ts
│   └── generation/
│       ├── claude-client.service.ts
│       ├── citation-validator.service.ts
│       └── streaming.service.ts
├── shared/
│   ├── shared.module.ts
│   ├── database/
│   │   ├── database.module.ts
│   │   ├── rls-middleware.ts
│   │   └── tenants.repository.ts
│   ├── infrastructure/
│   │   ├── redis.service.ts
│   │   ├── qdrant.service.ts
│   │   └── openai.service.ts
│   └── common/
│       ├── decorators/
│       │   └── tenant.decorator.ts
│       ├── interceptors/
│       │   └── logging.interceptor.ts
│       └── filters/
│           └── http-exception.filter.ts
├── app/
│   ├── app.module.ts
│   ├── app.controller.ts
│   └── app.service.ts
└── main.ts
```

### Pattern 1: Multi-Tenancy with PostgreSQL RLS

**What:** Row-level security policies filter all database queries automatically by tenant_id from JWT context.

**When to use:** All database access for multi-tenant data (documents, chats, users).

**Implementation:**

1. Enable RLS on each tenant-scoped table:
```sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
```

2. Create policy that reads tenant_id from session context:
```sql
-- Set tenant context from application (after JWT validation)
SET app.current_tenant = '123';

-- Policy on documents table
CREATE POLICY tenant_isolation_documents ON documents
    USING (tenant_id = current_setting('app.current_tenant')::int);
```

3. NestJS middleware to extract tenant_id from JWT and set session:
```typescript
// tenant-context.middleware.ts
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const user = req.user as JwtPayload;
    const tenantId = user.tenant_id;

    // Set PostgreSQL session variable
    this.databaseService.query(`SET app.current_tenant = $1`, [tenantId]);

    next();
  }
}
```

**Source:** https://www.postgresql.org/docs/current/ddl-rowsecurity.html (Official PostgreSQL RLS documentation)

**Why this pattern:** Database-enforced isolation prevents accidental data leaks even if query builder forgets tenant filter. Zero application bypass possible.

---

### Pattern 2: Asynchronous Document Processing with BullMQ

**What:** Upload endpoint accepts file → creates job in Redis → worker processes extract/chunk/embed → status updates → user polls for completion.

**When to use:** All document ingestion (PDF, DOCX, TXT), embedding generation.

**Implementation:**

```typescript
// documents.controller.ts
@Post('upload')
@UseInterceptors(FileInterceptor('file', {
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
}))
async uploadDocument(@UploadedFile() file: Express.Multer.File) {
  const job = await this.documentQueue.add('process-document', {
    tenantId: this.tenantService.currentTenantId,
    userId: this.authService.currentUserId,
    filename: file.originalname,
    mimetype: file.mimetype,
    buffer: file.buffer,
  });

  return { jobId: job.id, status: 'queued' };
}

// document-upload.worker.ts
@Processor('document-processing', {
  concurrency: 2, // Process 2 docs concurrently per worker
})
export class DocumentUploadProcessor {
  @Process('process-document')
  async processDocument(job: Job<DocumentJobData>) {
    const { tenantId, buffer, mimetype } = job.data;

    // 1. Extract text based on mimetype
    const text = await this.extractText(buffer, mimetype);

    // 2. Chunk with LangChain splitter
    const chunks = await this.splitText(text);

    // 3. Generate embeddings via OpenAI
    const embeddings = await this.openai.generateEmbeddings(chunks);

    // 4. Upsert to Qdrant with tenant_id payload
    await this.qdrant.upsertVectors(tenantId, job.id, chunks, embeddings);

    // 5. Update document status in PostgreSQL to 'indexed'
    await this.documentsRepo.markIndexed(job.id);
  }
}
```

**Source:** https://docs.bullmq.io/ (BullMQ documentation)

**Why this pattern:** Decouples upload from processing; users get immediate feedback; retry logic built-in; horizontal scaling via multiple workers.

---

### Pattern 3: Hybrid Search with RRF Reranking

**What:** Combine semantic search (vector similarity) with BM25 (lexical) using Reciprocal Rank Fusion (RRF) to balance relevance and precision.

**When to use:** Document retrieval for RAG (CHAT-02 requirement).

**Implementation:**

```typescript
// hybrid-search.service.ts
async search(
  query: string,
  tenantId: number,
  k: number = 10
): Promise<SearchResult[]> {
  // 1. Semantic search (dense vectors)
  const semanticResults = await this.qdrant.search({
    vector: await this.openai.generateEmbedding(query),
    filter: { must: [{ key: 'tenant_id', match: { value: tenantId } }] },
    limit: k * 2, // Get more for fusion
    withPayload: true,
    params: { hnsw_ef: 128 },
  });

  // 2. BM25 lexical search (qpdrant supports)
  const lexicalResults = await this.qdrant.search({
    vector: null, // Triggers BM25-only
    filter: { must: [{ key: 'tenant_id', match: { value: tenantId } }] },
    limit: k * 2,
    withPayload: true,
    params: { query: query, query_mode: 'keyword' },
  });

  // 3. RRF fusion (k=60 typical)
  return this.rrfFuse(semanticResults, lexicalResults, k);
}

private rrfFuse(
  semantic: SearchResult[],
  lexical: SearchResult[],
  k: number
): SearchResult[] {
  const scores = new Map<string, number>();
  const kConstant = 60;

  semantic.forEach((r, rank) => {
    scores.set(r.id, (scores.get(r.id) || 0) + 1 / (kConstant + rank));
  });

  lexical.forEach((r, rank) => {
    scores.set(r.id, (scores.get(r.id) || 0) + 1 / (kConstant + rank));
  });

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([id]) => semantic.find(r => r.id === id)!);
}
```

**Configuration:** density weight 0.7, bm25 weight 0.3 in fusion. Qdrant hybrid search supports this directly with `search(params = { exact: false, hnsw_ef: 128, oversampling: 2.0 })`.

**Source:** https://qdrant.tech/documentation/concepts/hybrid-search/ (Qdrant hybrid search docs)

**Why this pattern:** Semantic alone misses exact keyword matches; BM25 alone misses semantic similarity. RRF combines strengths without complex tuning.

---

### Pattern 4: Claude Streaming with Server-Sent Events (SSE)

**What:** Forward Claude's stream to frontend via SSE with incremental tokens and citation metadata.

**When to use:** Chat endpoint for real-time user experience (CHAT-10 requirement).

**Implementation:**

```typescript
// chat.controller.ts
@Get(':conversationId/stream')
@Header('Content-Type', 'text/event-stream')
async streamResponse(
  @Param('conversationId') conversationId: string,
  @Body() request: ChatRequest,
  @Res() response: Response
) {
  const retrievalResults = await this.hybridSearch.search(request.message, tenantId);
  const chunks = this.citationValidator.validate(retrievalResults);

  // Prepare stream to client
  response.write(`event: message_start\ndata: ${JSON.stringify({ type: 'start' })}\n\n`);

  const stream = await this.claudeClient.streamChat({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      ...this.buildHistory(conversationId),
      {
        role: 'user',
        content: this.buildPrompt(request.message, chunks)
      }
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    if (chunk.type === 'text' && chunk.text) {
      response.write(`event: token\ndata: ${JSON.stringify({ text: chunk.text })}\n\n`);
    }
    if (chunk.type === 'message_stop') {
      response.write(`event: done\ndata: ${JSON.stringify({ citations: chunk.citations })}\n\n`);
    }
  }

  response.end();
}

// Claude client service
async streamChat(params: ChatParams): AsyncIterable<StreamChunk> {
  const response = await this.anthropic.messages.stream({
    model: params.model,
    max_tokens: params.max_tokens,
    messages: params.messages,
    stream: true,
  });

  for await (const event of response) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text') {
      yield { type: 'text', text: event.delta.text };
    }
    if (event.type === 'message_stop') {
      yield { type: 'message_stop', citations: event.message.content.find(c => c.type === 'text')?.citations };
    }
  }
}
```

**Source:** https://docs.claude.com/en/api/messages-streaming (Claude streaming documentation)

**Why this pattern:** SSE is lightweight, browser-native, works with EventSource API on frontend. No WebSocket complexity needed for unidirectional streaming.

---

### Anti-Patterns to Avoid

- **Tenant isolation in application layer only:** Never rely solely on query filters. Use PostgreSQL RLS for enforcement.
- **Blocking uploads during processing:** Don't wait for extraction/embedding before responding. Use async BullMQ immediately.
- **Synchronous Claude calls:** Never use non-streaming Claude in chat endpoint. Blocks response until full generation.
- **Embedding generation in request thread:** Offload to BullMQ worker; embedding API is slow (100ms+ per batch).
- **Soft deletes without cascade:** Implement proper cascade delete or orphan cleanup jobs.
- **Single Redis instance for production:** BullMQ requires Redis; use Redis Cluster for high availability.
- **Hard-coded chunk parameters:** Make chunk size configurable per document type; different for legal contracts vs technical manuals.
- **No rate limiting on Claude API:** Add per-user rate limiting to prevent runaway costs; Claude API is expensive.
- **Vector dimension mismatch:** Verify `text-embedding-3-large` (3072) matches Qdrant collection config. Mismatch causes search failures.
- **Ignoring BullMQ job failures:** Set up failed job listeners and dead-letter queue for manual recovery.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-tenant data isolation | Custom query filters in every repository | **PostgreSQL RLS** | Guarantees isolation at DB level; eliminates human error; can't bypass even if app logic flawed |
| PDF text extraction | Custom parser for PDF format | **pdfjs-dist** | Production-grade; handles complex layouts, encoding, compression; maintained by Mozilla |
| DOCX text extraction | Custom XML parser for .docx (zip+XML) | **mammoth.js** | Battle-tested; handles Word features, styles, tables; preserves text order |
| Document chunking | Simple fixed-size character splitting | **LangChain.js RecursiveCharacterTextSplitter** | Semantic-aware; respects paragraphs/sections; preserves boundaries; configurable overlap |
| Job queue & retries | Custom Redis queue implementation | **BullMQ** | Distributed jobs, priorities, retries, concurrency, delayed jobs, dead letters |
| Vector search | k-NN in PostgreSQL without vector optimizations | **Qdrant** | Rust-based HNSW index; native hybrid search; payload filtering; production-ready |
| Embedding generation | Self-hosted model (embedding transformer) | **OpenAI text-embedding-3-large** | API-based; no GPU infra; consistent quality; cost-effective for MVP |
| Streaming chat responses | Custom chunking + client polling | **Claude API + SSE** | Built-in streaming; proper token-by-token delivery; citation metadata; lower latency |
| JWT authentication | Custom token generation/validation | **@nestjs/passport + passport-jwt** | Standardized strategy pattern; integrates with Nest guards; community support |
| API documentation | Manual OpenAPI spec writing | **@nestjs/swagger** | Auto-generated from decorators; keeps docs in sync with code |

**Key insight:** The RAG pipeline has 8+ complex moving parts (file upload, extraction, chunking, embedding, vector storage, retrieval, reranking, generation). Each piece has significant complexity and edge cases. Using established libraries (LangChain, BullMQ, Qdrant) reduces implementation time from months to weeks and provides battle-tested reliability. Custom solutions in these areas are high-risk for data loss, hallucinations, or performance issues.

---

## Common Pitfalls

### Pitfall 1: Tenant Data Leakage from Missing RLS

**What goes wrong:** Forgetting to enable RLS on a tenant-scoped table, or not setting `app.current_tenant` before queries, allows users to see other tenants' data through unsecured queries or direct database access.

**Why it happens:** Multi-tenancy baked into every operation (per decision). Single omitted `WHERE tenant_id = X` exposes entire tenant's data. RLS is the only safeguard that cannot be accidentally bypassed.

**How to avoid:**
- Create migration that enables RLS on ALL tenant-scoped tables (documents, chat_messages, chats, document_chunks)
- Create database policy: `CREATE POLICY tenant_isolation ON table USING (tenant_id = current_setting('app.current_tenant')::int)`
- Middleware that runs BEFORE any database query to set session context: `SET app.current_tenant = :tenantId` (extracted from validated JWT)
- Integration test that verifies isolation: attempt query as tenant A, ensure tenant B's data never returned even with `SELECT *`
- Audit log ALL cross-tenant access attempt violations (should be impossible with RLS enabled)

**Warning signs:**
- JWT validation guard runs AFTER some database queries (wrong order)
- RLS policy missing for a table (check `SELECT relrowsecurity FROM pg_class WHERE relname = 'documents'`)
- Application errors when `app.current_tenant` not set (good—means policies active and blocking)

**Confidence:** HIGH (based on PostgreSQL official RLS documentation and multi-tenancy best practices)

---

### Pitfall 2: BullMQ Job Loss on Worker Crash Without Proper Redis Persistence

**What goes wrong:** Worker processes crash mid-job; job lost or stuck in "active" state indefinitely; no retry; documents never indexed.

**Why it happens:** BullMQ relies on Redis for state. Without configured `limiter`, `settings` (stuck durations), or `attempts`, failed jobs don't auto-retry. Workers mark jobs "active" but never complete on crash; need "stuck" detection.

**How to avoid:**
- Configure worker with `removeOnComplete: 100`, `removeOnFail: 500` to prevent Redis memory leaks
- Set job `attempts: 3` and `backoff` strategy (exponential: delay = base * 2^attempt)
- Configure worker `stuckInterval: 30000` (30s) and `maxStalledCount: 1` to recover crashed jobs
- Implement failed job handler: send alert, write to audit log, move to dead-letter queue for manual review
- Use Redis with persistence (`appendonly yes`) to survive restarts

```typescript
// worker configuration
const worker = new Worker(
  'document-processing',
  async (job) => { /* process */ },
  {
    connection: redisConfig,
    concurrency: 2,
    autorun: false, // explicit start after graceful shutdown handler
  }
);

// stuck job recovery
worker.on('stalled', (job) => {
  logger.error(`Job ${job.id} stalled, re-queueing`);
  job.moveToFailed(new Error('Stalled'));
});

// failed job handler
worker.on('failed', (job, err) => {
  auditLogger.log('document_processing_failed', { jobId: job.id, error: err.message });
});
```

**Warning signs:**
- No job completion logs after hours (stuck jobs accumulating)
- Redis memory growing without job cleanup (check `redis-cli info memory`)
- Manual intervention required to re-queue failed uploads

**Confidence:** HIGH (based on BullMQ documentation and distributed systems patterns)

---

### Pitfall 3: Semantic Chunking Too Small or Too Large

**What goes wrong:** Chunk size too small (<100 tokens) fragments context; too large (>2000 tokens) exceeds embedding token limit or dilutes semantic meaning; retrieval returns chunks without complete procedure steps.

**Why it happens:** Recursive splitter splits on separators (paragraphs, sentences). Without proper configuration, splits mid-procedure (e.g., "Step 1:" on one chunk, "Open valve A" on next). Token counting differs by model (Claude vs OpenAI tokenizer).

**How to avoid:**
- Use `RecursiveCharacterTextSplitter` from LangChain.js with separators: `["\n\n\n", "\n\n", "\n", ". ", " ", ""]` (preserves sections first)
- Set `chunkSize: 1000` tokens (target), `chunkOverlap: 200` tokens (10-20% as requirement)
- Implement `lengthFunction` using OpenAI tiktoken for consistent token counting: `tiktoken.encoding_for_model('text-embedding-3-large').encode(text).length`
- Validate chunks: ensure no critical instruction spans chunk boundary (sample check on production docs)
- Make parameters configurable per document type: technical manuals may need larger chunks (1500) than safety procedures (500)

```typescript
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ['\n\n\n', '\n\n', '\n', '. ', ' ', ''],
  lengthFunction: (text) => encoding.encode(text).length,
});
```

**Warning signs:**
- Retrieved chunks cut off mid-sentence or mid-instruction (user complaints: "answers incomplete")
- Embedding API errors: "inputs exceed maximum context length" (chunks >8192 tokens)
- Low retrieval scores across corpus (chunks too small; embedding loses semantic meaning)

**Confidence:** MEDIUM (based on LangChain patterns and general RAG best practices; specific token counts per model require verification)

---

### Pitfall 4: Claude API Streaming Not Forwarded Correctly to Client (SSE Format Errors)

**What goes wrong:** Client receives malformed SSE events; no streaming tokens appear; connection hangs or errors; frontend EventSource `onmessage` never triggers.

**Why it happens:** SSE requires specific format: `event: <name>\ndata: <json>\n\n`. Missing double newline, improper JSON encoding, or not flushing response buffer breaks protocol. Also, forgetting to set `Content-Type: text/event-stream` causes browser to buffer.

**How to avoid:**
- Set headers: `res.setHeader('Content-Type', 'text/event-stream')`, `res.setHeader('Cache-Control', 'no-cache')`, `res.setHeader('Connection', 'keep-alive')`
- Format each event correctly:
```typescript
response.write(`event: token\ndata: ${JSON.stringify({ text: chunk })}\n\n`);
```
- Disable Nest response buffering: `@Res({ passthrough: true }) res: Response` ensures stream passthrough
- Handle errors: if Claude stream errors, send `event: error` with details so frontend can recover
- Test with curl: `curl -N http://localhost:3000/chats/abc/stream` should stream tokens line-by-line

```typescript
// streaming.controller.ts
@Get(':id/stream')
async stream(
  @Param('id') id: string,
  @Body() request: ChatRequest,
  @Req() req: Request,
  @Res({ passthrough: true }) res: Response
) {
  const tenantId = this.tenantService.extractFromRequest(req);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    for await (const chunk of this.chatService.streamChat(id, request)) {
      res.write(`event: token\ndata: ${JSON.stringify(chunk)}\n\n`);
    }
    res.write(`event: done\n\n`);
  } catch (error) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
  } finally {
    res.end();
  }
}
```

**Warning signs:**
- Browser Network tab shows "(pending)" or response size 0
- No `event: token` lines in raw response stream (check with curl -v)
- Frontend EventSource `onerror` fires immediately with "EventSource failed"

**Confidence:** HIGH (based on Claude API streaming spec and SSE standard)

---

### Pitfall 5: Citation hallucination (citations not matching retrieved chunks)

**What goes wrong:** Claude generates citations `[1]`, `[2]` but the cited chunk doesn't exist in retrieved results or cites wrong document. Breaks user trust; violates QUAL-03 requirement.

**Why it happens:** Claude can make up citations if system prompt unclear. Without explicit instruction "Only cite chunks provided in context [1], [2]..." and mapping of citation index → chunk ID, AI hallucinates.

**How to avoid:**
- Build system prompt with explicit instructions and numbered context:
```typescript
const systemPrompt = `
Answer based ONLY on the following retrieved context. Each source is marked [1], [2], etc.
If no relevant information, say "I cannot answer based on available documents."

Context:
${chunks.map((c, i) => `[${i + 1}] ${c.content} (source: ${c.documentName})`).join('\n')}

Instructions:
- Cite sources using [1], [2] format inline.
- Never cite a source not listed above.
- If uncertain, say so.
`;
```
- Post-process Claude response: parse citation markdown `[1]` → validate `chunkIds.includes(citationId)`. If invalid, either regenerate or remove citation with note "source unavailable".
- Store mapping of citation index → chunk_id in database for traceability
- Log validation failures for monitoring (indicates Claude not following instructions; may need prompt tuning)

```typescript
// citation-validator.service.ts
validateCitations(
  response: string,
  retrievedChunks: DocumentChunk[]
): { valid: boolean; correctedResponse?: string } {
  const citationRegex = /\[(\d+)\]/g;
  const citedIds = new Set<number>();
  let match;

  while ((match = citationRegex.exec(response)) !== null) {
    const index = parseInt(match[1]) - 1;
    if (index < 0 || index >= retrievedChunks.length) {
      return { valid: false }; // Invalid citation
    }
    citedIds.add(index);
  }

  // All citations valid
  return { valid: true };
}
```

**Warning signs:**
- QA logs show citations with no matching chunk_id in database
- User reports: "Citation [3] leads to empty page" or "Citation confused documents"
- High hallucination rate detected by post-generation validation (measureable metric)

**Confidence:** HIGH (based on Claude API citation capabilities and RAG best practices)

---

### Pitfall 6: Embedding Generation Rate Limit (OpenAI tpm/rpm Exceeded)

**What goes wrong:** Batch embedding generation hits OpenAI rate limits (requests per minute / tokens per minute). BullMQ workers throttle; document indexing slows to crawl; queue backs up with hundreds of pending embedding jobs.

**Why it happens:** OpenAI enforces tpm (tokens per minute) and rpm (requests per minute) per API key. text-embedding-3-large: 8k token context, but limit may be e.g., 1M tokens/min. Uploading 100 documents × 100 chunks each = 10k requests; exceeds quota quickly.

**How to avoid:**
- Implement rate limiter in embedding service (token bucket algorithm):
```typescript
import { RateLimiter } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiter({
  points: 1_000_000, // tokens per minute
  duration: 60,
  blockDuration: 300, // block 5 min if limit exceeded
});

async generateEmbeddings(texts: string[]): Promise<number[][]> {
  const tokens = texts.reduce((sum, t) => sum + encoding.encode(t).length, 0);
  await rateLimiter.consume('openai-embeddings', tokens);

  return await this.openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: texts,
  });
}
```
- Batch embedding requests (OpenAI allows up to 2048 inputs per request)
- Add job delay: BullMQ `delay: 1000` between embedding jobs per worker if rate limited
- Monitor OpenAI usage dashboard; request quota increase before production load
- Implement exponential backoff on 429 errors from OpenAI

**Warning signs:**
- OpenAI API returns 429 "rate limit exceeded" for embedding endpoint
- BullMQ job queue depth growing for "generate-embeddings" jobs (check `bullmq:queue:document-processing:waiting`)
- Document status shows "processing" for >30 minutes (embedding job pending)

**Confidence:** HIGH (based on OpenAI API rate limiting practices)

---

### Pitfall 7: Qdrant Collection Search Performance Degradation Without Proper Indexing

**What goes wrong:** Search queries slow (>1 second) as document chunks grow to 10k+; HNSW index not optimized; collection configuration defaults not tuned for 3072-dimensional vectors.

**Why it happens:** Qdrant requires HNSW parameters (`m`, `ef_construct`, `ef_search`) tuned for your data dimensionality and update pattern. Default `m=16` may be suboptimal for 3072 dimensions. Also, not using payload indexing for tenant_id filtering causes full collection scans.

**How to avoid:**
- Create collection with optimized HNSW config for 3072-dim vectors:
```typescript
await this.qdrant.createCollection(tenantId, {
  vectors: {
    size: 3072,
    distance: 'Cosine',
    hnsw_config: {
      m: 32, // Increase from default 16 for high dimensions
      ef_construct: 200, // Higher for better recall, slower indexing
      full_scan_threshold: 10000, // Switch to brute-force for <10k vectors
    },
  },
  payload: [
    { name: 'tenant_id', data_type: 'integer' }, // Indexed for filtering
    { name: 'document_id', data_type: 'integer' },
    { name: 'chunk_index', data_type: 'integer' },
  ],
});
```
- Always include tenant_id in payload fields AND filter queries: `filter: { must: [{ key: 'tenant_id', match: { value: tenantId }] }`
- Periodic index optimization: `POST /collections/{name}/points/optimizers` to merge segments
- Monitor search latency metrics; adjust `ef_search` upward (128 default, try 256) if recall insufficient
- For <10k vectors per tenant, consider `full_scan_threshold` to bypass HNSW (exact search is fast)

```typescript
// qdrant.service.ts
async search(params: SearchParams): Promise<SearchResult[]> {
  return this.client.search(this.collectionName, {
    vector: params.vector,
    filter: {
      must: [{ key: 'tenant_id', match: { value: params.tenantId } }],
    },
    limit: params.limit,
    with_payload: true,
    params: {
      hnsw_ef: 256, // Increase for recall, decrease for speed
      exact: false,
    },
  });
}
```

**Warning signs:**
- Search P99 latency >1000ms (measure via API monitoring)
- Qdrant logs show "too many segments" (merge needed)
- Recall drops when `ef_search` too low (test with ground truth queries)

**Confidence:** HIGH (based on Qdrant production tuning guidelines and HNSW research)

---

## Code Examples

### Example 1: JWT Strategy with Tenant Context

```typescript
// strategies/jwt.strategy.ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => {
          // Extract from httpOnly cookie OR Authorization header
          return req?.cookies?.access_token ||
                 (req?.headers?.authorization?.split(' ')[1]);
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }

    // Ensure tenant_id in payload (set during login)
    if (!payload.tenant_id) {
      throw new UnauthorizedException('Missing tenant context');
    }

    return { userId: user.id, tenantId: payload.tenant_id, email: user.email };
  }
}
```

**Source:** Based on NestJS passport-jwt integration patterns (https://docs.nestjs.com/security/authentication)

---

### Example 2: PDF Text Extraction with pdfjs-dist

```typescript
// processors/pdf.processor.ts
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';
import { TextItem } from 'pdfjs-dist/types/src/display/api';

GlobalWorkerOptions.workerSrc = pdfjsWorker;

@Injectable()
export class PdfProcessor implements DocumentProcessor {
  async extractText(buffer: Buffer): Promise<string> {
    const loadingTask = getDocument({ data: buffer });
    const pdf = await loadingTask.promise;

    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Sort items by position (preserve reading order)
      const items = textContent.items as TextItem[];
      items.sort((a, b) => {
        const aY = a.transform[5];
        const bY = b.transform[5];
        return aY - bY; // Top-to-bottom
      });

      const pageText = items.map(item => item.str).join(' ');
      fullText += `\n\n--- Page ${pageNum} ---\n\n${pageText}`;
    }

    return fullText;
  }
}
```

**Source:** https://mozilla.github.io/pdf.js/ (pdfjs-dist documentation)

**Why pdfjs-dist:** Production-grade PDF parser from Mozilla; handles compressed text, encoding, complex layouts better than alternatives like pdf-parse or pdf-text-extract.

---

### Example 3: DOCX Text Extraction with mammoth.js

```typescript
// processors/docx.processor.ts
import * as mammoth from 'mammoth';

@Injectable()
export class DocxProcessor implements DocumentProcessor {
  async extractText(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer });

    if (result.messages.length > 0) {
      this.logger.warn('DOCX extraction warnings:', result.messages);
    }

    return result.value; // Raw text with paragraphs separated by double newlines
  }
}
```

**Source:** https://github.com/mwilliamson/mammoth.js (mammoth.js README)

**Why mammoth:** Stable extraction preserving paragraph structure; handles .docx (Word 2007+); better than using zip + XML parser manually.

---

### Example 4: RecursiveCharacterTextSplitter Configuration

```typescript
// chunking/text-splitter.service.ts
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitters';
import { encoding_for_model } from 'js-tiktoken';

@Injectable()
export class TextSplitterService {
  private splitter: RecursiveCharacterTextSplitter;
  private encoding = encoding_for_model('text-embedding-3-large');

  constructor() {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n\n', '\n\n', '\n', '. ', ' ', ''],
      lengthFunction: (text: string) => this.encoding.encode(text).length,
      keepSeparator: false,
    });
  }

  async split(text: string): Promise<string[]> {
    return this.splitter.splitText(text);
  }
}
```

**Note:** `RecursiveCharacterTextSplitter` from LangChain.js v0.3.x. The exact API may vary; verify with official docs before implementation.

**Source:** Based on LangChain.js text splitting patterns (https://js.langchain.com/docs)

---

### Example 5: OpenAI Embeddings Generation with Batching

```typescript
// infrastructure/openai.service.ts
import OpenAI from 'openai';
import { encoding_for_model } from 'js-tiktoken';

@Injectable()
export class OpenAIService {
  private client: OpenAI;
  private encoding = encoding_for_model('text-embedding-3-large');
  private readonly BATCH_SIZE = 100; // Max 2048 per API but 100 safer for rate limits

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Ensure texts don't exceed 8192 tokens each
    const truncated = texts.map(text => this.truncateToTokenLimit(text, 8192));

    const embeddings: number[][] = [];

    // Batch to avoid rate limits
    for (let i = 0; i < truncated.length; i += this.BATCH_SIZE) {
      const batch = truncated.slice(i, i + this.BATCH_SIZE);
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-large',
        input: batch,
      });

      embeddings.push(...response.data.map(d => d.embedding));

      // Rate limit delay if needed
      if (i + this.BATCH_SIZE < truncated.length) {
        await this.delay(100); // 10 req/sec max
      }
    }

    return embeddings;
  }

  private truncateToTokenLimit(text: string, maxTokens: number): string {
    const tokens = this.encoding.encode(text);
    if (tokens.length <= maxTokens) return text;
    const truncatedTokens = tokens.slice(0, maxTokens);
    return this.encoding.decode(truncatedTokens);
  }
}
```

**Source:** https://github.com/openai/openai-node (OpenAI Node.js client)

**Key parameters:** `text-embedding-3-large` returns 3072 dimensions; input limit 8192 tokens per chunk; batch up to 2048 inputs per request.

---

### Example 6: Qdrant Upsert with Tenant Filtering

```typescript
// infrastructure/qdrant.service.ts
import { QdrantClient, PointStruct } from '@qdrant/js-client-rest';

@Injectable()
export class QdrantService {
  private client: QdrantClient;
  private readonly collectionPrefix = 'tenant_';

  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
    });
  }

  async upsertVectors(
    tenantId: number,
    documentId: number,
    chunks: string[],
    embeddings: number[][]
  ): Promise<void> {
    const collectionName = this.collectionName(tenantId);

    const points: PointStruct[] = chunks.map((chunk, index) => ({
      id: `${documentId}:${index}`, // Composite ID
      vector: embeddings[index],
      payload: {
        tenant_id: tenantId,
        document_id: documentId,
        chunk_index: index,
        content: chunk,
        indexed_at: new Date().toISOString(),
      },
    }));

    await this.client.upsert(collectionName, {
      points,
      wait: true, // Ensure indexed before returning
    });
  }

  async search(
    tenantId: number,
    vector: number[],
    k: number = 10,
    filter?: Record<string, any>
  ): Promise<SearchResult[]> {
    const collectionName = this.collectionName(tenantId);

    const results = await this.client.search(collectionName, {
      vector,
      limit: k,
      with_payload: true,
      filter: {
        must: [
          { key: 'tenant_id', match: { value: tenantId } },
          ...(filter ? Object.entries(filter).map(([k, v]) => ({
            key: k,
            match: { value: v },
          })) : []),
        ],
      },
      params: {
        hnsw_ef: 256, // Tradeoff recall vs speed
      },
    });

    return results.map(r => ({
      id: r.id,
      score: r.score,
      payload: r.payload,
    }));
  }

  private collectionName(tenantId: number): string {
    return `${this.collectionPrefix}${tenantId}`;
  }
}
```

**Source:** https://github.com/qdrant/qdrant-client-js (Qdrant TypeScript client examples)

**Why tenant-scoped collections:** Simplifies RLS at vector DB level; prevents cross-tenant search even if application bug; allows per-tenant tuning.

---

### Example 7: BullMQ Worker for Document Processing

```typescript
// jobs/document-upload.worker.ts
import { Processor, Worker } from 'bullmq';
import { Job } from 'bullmq';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

interface DocumentJobData {
  tenantId: number;
  userId: number;
  filename: string;
  mimetype: string;
  buffer: Buffer;
}

@Injectable()
export class DocumentUploadWorker implements OnModuleInit, OnModuleDestroy {
  private worker: Worker;

  constructor(
    private readonly pdfProcessor: PdfProcessor,
    private readonly docxProcessor: DocxProcessor,
    private readonly txtProcessor: TxtProcessor,
    private readonly splitter: TextSplitterService,
    private readonly openai: OpenAIService,
    private readonly qdrant: QdrantService,
    private readonly documentsRepo: DocumentsRepository,
    private readonly redisService: RedisService,
  ) {
    this.worker = new Worker<DocumentJobData>(
      'document-processing',
      async (job: Job<DocumentJobData>) => {
        const { tenantId, buffer, mimetype } = job.data;

        try {
          // 1. Extract text
          const text = await this.extractText(buffer, mimetype);

          // 2. Chunk
          const chunks = await this.splitter.split(text);

          // 3. Generate embeddings
          const embeddings = await this.openai.generateEmbeddings(chunks);

          // 4. Store vectors
          await this.qdrant.upsertVectors(
            tenantId,
            job.id, // Use job ID as temporary document ID
            chunks,
            embeddings
          );

          // 5. Mark document indexed in PostgreSQL
          await this.documentsRepo.markIndexed(job.id, 'indexed');

          return { success: true, chunks: chunks.length };
        } catch (error) {
          await this.documentsRepo.markIndexed(job.id, 'error', error.message);
          throw error;
        }
      },
      {
        connection: this.redisService.getConnection(),
        concurrency: 2, // Process 2 jobs concurrently per worker instance
        autorun: false, // Explicit start in onModuleInit
      }
    );

    // Error handling
    this.worker.on('failed', async (job, error) => {
      logger.error(`Job ${job.id} failed:`, error);
      await this.documentsRepo.logFailure(job.id, error.message);
    });
  }

  onModuleInit() {
    this.worker.run();
  }

  onModuleDestroy() {
    this.worker.close();
  }

  private async extractText(buffer: Buffer, mimetype: string): Promise<string> {
    switch (mimetype) {
      case 'application/pdf':
        return this.pdfProcessor.extractText(buffer);
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this.docxProcessor.extractText(buffer);
      case 'text/plain':
        return this.txtProcessor.extractText(buffer);
      default:
        throw new UnsupportedError(`Unsupported mimetype: ${mimetype}`);
    }
  }
}
```

**Source:** https://docs.bullmq.io/ (BullMQ worker patterns)

**Configuration notes:**
- Redis: `concurrency: 2` assumes 2 CPU cores per worker process; adjust based on CPU
- `autorun: false` + explicit `run()` allows graceful shutdown handler to `close()` worker
- Job data includes `buffer`; for large files, store buffer in S3/MinIO and pass URL instead to avoid Redis memory pressure

---

### Example 8: Streaming Chat with Citations

```typescript
// generation/claude-client.service.ts
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class ClaudeClientService {
  async streamChat(
    messages: ChatMessage[],
    retrievedChunks: RetrievedChunk[],
    onToken: (token: string) => void,
    onComplete: (citations: Citation[]) => void
  ): Promise<void> {
    const systemPrompt = this.buildSystemPrompt(retrievedChunks);

    const stream = await this.anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
      temperature: 0.3, // Lower for factual groundedness
    });

    let fullResponse = '';
    const citations: Citation[] = [];

    for await (const event of stream) {
      switch (event.type) {
        case 'content_block_delta':
          if (event.delta.type === 'text') {
            fullResponse += event.delta.text;
            onToken(event.delta.text);
          }
          break;

        case 'content_block_stop':
          // Citations appear in final text block
          if (event.content_block.type === 'text') {
            citations.push(...(event.content_block.citations || []));
          }
          break;

        case 'message_stop':
          onComplete(citations);
          break;
      }
    }
  }

  private buildSystemPrompt(chunks: RetrievedChunk[]): string {
    const context = chunks
      .map((c, i) => `[${i + 1}] ${c.content}\n(source: ${c.documentName}, page ${c.pageNumber || '?'})`)
      .join('\n\n');

    return `
You are a technical assistant for an oil & gas operations platform. Answer ONLY using the provided context.

Context from retrieved documents:
${context}

Instructions:
- Be concise and technical.
- Cite sources using [1], [2], etc. inline.
- If no relevant context, respond "I cannot answer based on available documents."
- Do NOT make up information.
- Citation format: [1] must match exactly one of the numbered sources above.
    `.trim();
  }
}
```

**Source:** https://docs.claude.com/en/api/messages (Claude Messages API)

**Why citations in system prompt:** Claude automatically generates citations when provided document blocks with `citations.enabled: true`. For manual string context, instruct explicitly to cite numbered sources.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual chunking (fixed 1000 chars) | Semantic-aware recursive splitting | LangChain.js widespread adoption ~2024 | Higher retrieval quality; respects document structure |
| Single vector search only | Hybrid search + RRF reranking | Qdrant hybrid search v1.7+ (2024) | Better recall for exact keywords + semantic |
| Non-streaming LLM calls | Server-Sent Events streaming | Claude API streaming standard (2024) | Real-time UX; perceived performance improvement |
| Self-hosted embeddings | API-based (OpenAI) | Cost/benefit shift 2023-2024 | 10x faster dev; no GPU ops; consistent quality |
| Application-layer tenant filters | Database RLS enforcement | Multi-tenant breach incidents 2023-2024 | Zero trust isolation; compliance-ready |
| In-process job queues | BullMQ + Redis distributed | BullMQ maturation 2022-2023 | Retry, persistence, concurrency, monitoring |
| pgvector only | Qdrant (separate vector DB) | Scale requirements >1M vectors (2023) | Specialized index (HNSW); better performance at scale |

**Deprecated/outdated:**
- **Manual PDF parsing with regex:** Use pdfjs-dist—regex fails on compressed/encoded text
- **Synchronous document processing:** Users abandon upload after 30s—async with status polling required
- **Single embedding model dimension 1536:** text-embedding-3-large offers better quality at 3072 dims
- **JWT in localStorage:** Vulnerable to XSS—use httpOnly cookies for persistence
- **Custom RAG implementations:** Use LangChain.js patterns—reinventing causes hallucination bugs

---

## Open Questions

1. **[Rate limiting thresholds]**
   - What we know: Must implement per-user rate limiting (QUAL-04). QUAL-04 mapped to Phase 0, but implementation details unspecified.
   - What's unclear: Specific thresholds (requests/min per user? per tenant?), burst allowances, different limits for embedding vs chat endpoints.
   - Recommendation: Set moderate limits initially (e.g., 60 chat requests/min, 1000 embedding tokens/min), monitor usage, adjust after 30 days. Differentiate endpoints: embedding generation API rate-limited stricter than chat (cost driver).

2. **[Email verification service provider]**
   - What we know: AUTH-01 requires email verification. No provider chosen.
   - What's unclear: SendGrid? AWS SES? Resend? Nodemailer with own SMTP?
   - Recommendation: Use Resend (developer-friendly API) or AWS SES (cost-effective at scale). Create abstraction (`EmailService`) so implementation can swap later.

3. **[Demo content sourcing]**
   - What we know: DEMO-01-05 mapped to Phase 4 (not this phase). But Phase 1 must support demo data for testing.
   - What's unclear: Do we need to seed demo documents in Phase 1 for development/testing? CONTEXT.md says "Demo mode with pre-loaded oil & gas sample documents" is a specific idea but defer decisions unclear.
   - Recommendation: Decouple demo seeding from Phase 1 implementation. Create `DemoSeeder` service but invoke manually or via admin script, not automatic in production. Phase 1 focus: backend API only; demo data can be added later as seed script.

4. **[Redis deployment for BullMQ]**
   - What we know: BullMQ requires Redis. No Redis config in STATE.md or decisions.
   - What's unclear: Standalone Redis instance? Redis Cluster? Cloud provider? Local dev setup?
   - Recommendation: Phase 1 uses standalone Redis (single node) for simplicity. Document Transition to Redis Cluster in Phase 3 when scaling needed. Local dev: Docker `redis:7-alpine`. Production: Managed Redis (AWS ElastiCache / GCP Memorystore). High availability not critical for MVP (jobs can be re-queued if Redis down briefly).

5. **[Cross-encoder reranker feasibility]**
   - What we know: Reranking via cross-encoder ms-marco-MiniLM-L-6-v2 locked in decision.
   - What's unclear: Self-hosted model? HuggingFace Inference API? OnnxRuntime? Latency impact? The cross-encoder is ~80M parameter model; inference 10-50ms on CPU, but requires dedicated service or heavy process.
   - Recommendation: Implement reranking as optional step after retrieval. For MVP, can skip if performance too slow; document as Phase 3 enhancement. If needed, use HuggingFace Inference Endpoints (managed) to avoid GPU infra. Add feature flag `ENABLE_RERANKER=false` in config for Phase 1.

---

## Validation Architecture

> Verification requirements enabled (workflow.nyquist_validation = true from config.json)

### Test Framework

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x with @nestjs/testing |
| **Config file** | jest.config.js (to be created in Wave 0) |
| **Quick run command** | `npm test -- --testPathPattern=auth --watch` |
| **Full suite command** | `npm test -- --coverage --runInBand` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| AUTH-01 | Email/password signup with verification email sent | unit | `npm test -- tests/auth/auth.service.spec.ts` | ❌ Wave 0 |
| AUTH-02 | JWT persistent session (cookies) | unit | `npm test -- tests/auth/jwt.strategy.spec.ts` | ❌ Wave 0 |
| AUTH-03 | Logout invalidates session | unit | `npm test -- tests/auth/auth.service.spec.ts` | ❌ Wave 0 |
| AUTH-04 | Password reset token generation & email | unit | `npm test -- tests/auth/password-reset.service.spec.ts` | ❌ Wave 0 |
| TEN-01 | RLS policies enforced on tenant tables | integration | `npm test -- tests/integration/rls.integration.spec.ts` | ❌ Wave 0 |
| TEN-02 | All queries filter by tenant context | integration | `npm test -- tests/integration/tenant-isolation.integration.spec.ts` | ❌ Wave 0 |
| TEN-03 | Users cannot access other tenant's data | integration | `npm test -- tests/integration/tenant-isolation.integration.spec.ts` | ❌ Wave 0 |
| DOC-01 | Document upload endpoint accepts files | unit | `npm test -- tests/documents/documents.controller.spec.ts` | ❌ Wave 0 |
| DOC-02 | File validation (type, size 50MB max) | unit | `npm test -- tests/documents/file-validation.pipe.spec.ts` | ❌ Wave 0 |
| DOC-03 | Upload progress tracking (status endpoint) | unit | `npm test -- tests/documents/status.service.spec.ts` | ❌ Wave 0 |
| DOC-04 | Async processing with BullMQ job creation | unit | `npm test -- tests/documents/document-queue.service.spec.ts` | ❌ Wave 0 |
| DOC-05 | Document status transitions (queued→processing→indexed/error) | integration | `npm test -- tests/integration/document-lifecycle.integration.spec.ts` | ❌ Wave 0 |
| DOC-06 | Text extraction from PDF, DOCX, TXT | unit | `npm test -- tests/documents/processors/*.processor.spec.ts` | ❌ Wave 0 |
| DOC-07 | Semantic chunking with overlap 100-200 tokens | unit | `npm test -- tests/documents/chunking/text-splitter.service.spec.ts` | ❌ Wave 0 |
| DOC-08 | Embeddings generated and stored in Qdrant | integration | `npm test -- tests/integration/embedding-pipeline.integration.spec.ts` | ❌ Wave 0 |
| CHAT-01 | Create chat conversation endpoint | unit | `npm test -- tests/chat/chat.controller.spec.ts` | ❌ Wave 0 |
| CHAT-02 | Hybrid search with semantic + BM25 weights | unit | `npm test -- tests/chat/retrieval/hybrid-search.service.spec.ts` | ❌ Wave 0 |
| CHAT-03 | Claude grounding with retrieved context | unit | `npm test -- tests/chat/generation/claude-client.service.spec.ts` | ❌ Wave 0 |
| CHAT-04 | Inline citations generated correctly | unit | `npm test -- tests/chat/citation-validator.service.spec.ts` | ❌ Wave 0 |
| CHAT-10 | Streaming responses via SSE | integration | `npm test -- tests/integration/chat-streaming.integration.spec.ts` | ❌ Wave 0 |
| CHAT-11 | Refusal when no relevant context retrieved | unit | `npm test -- tests/chat/no-context.guard.spec.ts` | ❌ Wave 0 |
| CHAT-12 | Confidence indication for weak sources | unit | `npm test -- tests/chat/confidence.service.spec.ts` | ❌ Wave 0 |
| QUAL-03 | Citation validation against retrieved sources | unit | `npm test -- tests/chat/citation-validator.service.spec.ts` | ❌ Wave 0 |

**Total automated tests:** 25 across unit (18) + integration (7)

### Sampling Rate

- **Per task commit:** Run affected unit tests only: `npm test -- --testPathPattern=<module> --watch`
- **Per wave merge:** Run full suite: `npm test -- --coverage --runInBand`
- **Phase gate:** Full suite green (100% passing) before `/gsd:verify-work`

### Wave 0 Gaps

These test files must be created in Wave 0 (before implementation tasks):

- [ ] `tests/auth/auth.service.spec.ts` — covers AUTH-01, AUTH-03, AUTH-04
- [ ] `tests/auth/jwt.strategy.spec.ts` — covers AUTH-02
- [ ] `tests/auth/password-reset.service.spec.ts` — covers AUTH-04
- [ ] `tests/documents/documents.controller.spec.ts` — covers DOC-01
- [ ] `tests/documents/file-validation.pipe.spec.ts` — covers DOC-02
- [ ] `tests/documents/status.service.spec.ts` — covers DOC-03, DOC-04
- [ ] `tests/documents/processors/pdf.processor.spec.ts` — covers DOC-06
- [ ] `tests/documents/processors/docx.processor.spec.ts` — covers DOC-06
- [ ] `tests/documents/processors/txt.processor.spec.ts` — covers DOC-06
- [ ] `tests/documents/chunking/text-splitter.service.spec.ts` — covers DOC-07
- [ ] `tests/chat/chat.controller.spec.ts` — covers CHAT-01
- [ ] `tests/chat/retrieval/hybrid-search.service.spec.ts` — covers CHAT-02
- [ ] `tests/chat/generation/claude-client.service.spec.ts` — covers CHAT-03
- [ ] `tests/chat/citation-validator.service.spec.ts` — covers CHAT-04, QUAL-03
- [ ] `tests/chat/no-context.guard.spec.ts` — covers CHAT-11
- [ ] `tests/chat/confidence.service.spec.ts` — covers CHAT-12
- [ ] `tests/integration/rls.integration.spec.ts` — covers TEN-01, TEN-02, TEN-03
- [ ] `tests/integration/document-lifecycle.integration.spec.ts` — covers DOC-05
- [ ] `tests/integration/embedding-pipeline.integration.spec.ts` — covers DOC-08
- [ ] `tests/integration/chat-streaming.integration.spec.ts` — covers CHAT-10
- [ ] `jest.config.js` — test runner configuration
- [ ] `tests/conftest.ts` — shared fixtures (database, Redis, mocks)
- [ ] `tests/fixtures/` — mock data files (sample PDFs, DOCX)

---

## Sources

### Primary (HIGH confidence)

- PostgreSQL RLS official documentation - Row Level Security policies, `SET` session variables, `USING` expressions
- Claude API Messages endpoint (platform.claude.com/docs/en/api/messages) - Streaming format, parameters, citation handling
- Qdrant documentation (qdrant.tech) - Hybrid search, payload filtering, collection configuration
- BullMQ documentation (docs.bullmq.io) - Job queue patterns, worker configuration, retry mechanisms

### Secondary (MEDIUM confidence)

- WebSearch verified with official library sources:
  - pdfjs-dist - Text extraction methods from Mozilla's PDF.js library
  - mammoth.js - extractRawText API from GitHub repository
  - LangChain.js patterns - RecursiveCharacterTextSplitter usage (general patterns from ecosystem)
  - OpenAI Node.js client - embeddings.create API from openai-node repository

### Tertiary (LOW confidence)

- WebSearch results for specific code patterns (NestJS integrations, BullMQ examples, Qdrant TypeScript usage) - These are community examples; should verify against official docs during implementation
- Configuration parameters (HNSW m=32, ef_search=256, chunkSize=1000) - Based on typical RAG tuning; may need adjustment for oil & gas domain corpora

---

## Metadata

**Confidence breakdown:**
- **Standard stack:** HIGH - Stack decisions locked from Phase 0 research; libraries match ecosystem norms
- **Architecture:** HIGH - Patterns derived from official documentation (PostgreSQL RLS, BullMQ, Claude API, Qdrant)
- **Pitfalls:** HIGH - All pitfalls identified from official docs + distributed systems best practices
- **Code examples:** MEDIUM - Examples synthesize multiple sources; need verification against latest library APIs before implementation

**Research date:** 2025-03-08
**Valid until:** 2025-06-08 (90 days - stable stack, limited breaking changes expected)

**Critical dependencies requiring API verification before implementation:**
1. LangChain.js `RecursiveCharacterTextSplitter` exact API (v0.3.x)
2. Qdrant client Node.js `search` hybrid parameters syntax
3. BullMQ NestJS integration patterns (module vs standalone worker lifecycle)
4. Claude streaming response event types (verify SSE event structure)
