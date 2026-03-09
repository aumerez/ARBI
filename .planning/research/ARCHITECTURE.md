# Architecture Patterns: Industrial RAG Platform

**Domain:** Oil & Gas production optimization RAG system
**Researched:** 2025-03-08

## Recommended Architecture

The industrial RAG platform follows a layered architecture with clear separation between data ingestion, knowledge storage, retrieval, and generation layers. The system supports multi-tenancy, Electron desktop delivery, and production-ready scalability.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Electron Frontend                          │
│  ┌─────────────────┐                    ┌────────────────────────┐│
│  │   Renderer      │◄──────────────────►│   Main Process API     ││
│  │   (React/Vue)   │  IPC Communication │   (Node.js)            ││
│  └─────────────────┘                    └────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Backend API Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │   Auth API  │  │  Docs API   │  │  Chat API   │               │
│  └─────────────┘  └─────────────┘  └─────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Application Logic Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │   Tenant    │  │  Pipeline   │  │   Retrieval │               │
│  │   Context   │  │  Orchestrator│  │   Engine    │               │
│  └─────────────┘  └─────────────┘  └─────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌──────────────────┐ ┌──────────────────┐ ┌─────────────────────┐
│   PostgreSQL     │ │  Vector Database │ │   LLM Provider      │
│   (Users, Docs,  │ │  (pgvector,      │ │   (Claude/OpenAI)   │
│    Tenants,      │ │   Pinecone,      │ │                     │
│    Metadata)     │ │   Weaviate)      │ │                     │
└──────────────────┘ └──────────────────┘ └─────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With | Technology |
|-----------|----------------|-------------------|------------|
| Electron Renderer | UI for chat, docs, auth | Main Process (IPC) | React/Vue |
| Electron Main | Desktop services, API proxy | Renderer, Backend API | Node.js |
| Backend API | REST/GraphQL endpoints | Main Process, App Logic | Express/Fastify |
| Tenant Context | Multi-tenancy enforcement, branding | All downstream | TypeScript |
| Pipeline Orchestrator | Document processing workflow | Vector DB, Metadata DB | TypeScript |
| Retrieval Engine | Context retrieval, reranking | Vector DB, LLM | TypeScript |
| PostgreSQL | Users, tenants, document metadata, chat history | App Logic | PostgreSQL |
| Vector Database | Embeddings storage & similarity search | Retrieval Engine | pgvector/Pinecone |
| LLM Provider | Response generation with citations | Retrieval Engine | Claude/OpenAI API |

## Data Flow

### 1. Document Upload → Indexing Pipeline

```
User Upload (Electron)
    │
    ▼
Backend API receives file
    │
    ▼
Pipeline Orchestrator:
├─ Validate file type, tenant permissions
├─ Extract text (Document Loader)
│  └─ PDF, DOCX, TXT support
├─ Preprocess text (clean headers, formatting)
├─ Chunk into segments (Text Splitter)
│  └─ Overlap: 100-200 tokens
│  └─ Strategy: RecursiveCharacterTextSplitter
└─ Generate embeddings (Embedding Model)
   └─ Model: sentence-transformers/all-MiniLM-L6-v2
    │
    ▼
Store in Vector Database:
├─ Vector: embedding array
├─ Metadata: tenant_id, doc_id, chunk_id, page, text
└─ Index: HNSW for fast similarity search
    │
    ▼
Store document metadata in PostgreSQL:
├─ Tenant info, upload timestamp, processing status
└─ File reference, original filename
```

### 2. Chat Query → Response Generation

```
User Query (Chat Interface)
    │
    ▼
Backend Chat API receives query with tenant context
    │
    ▼
Query Processing:
├─ Optional: Query expansion, synonym lookup
├─ Generate query embedding (same model as docs)
└─ Apply tenant filter (tenant_id in metadata)
    │
    ▼
Vector Database Search (Hybrid):
├─ Semantic search (dense vector similarity)
│  └─ top-k: 10-20 chunks
├─ Optional: Lexical search (BM25/sparse vectors)
└─ Rerank (cross-encoder or score fusion)
    │
    ▼
Retrieval Engine:
├─ Assemble context: retrieved chunks + query
├─ Apply token limit (~2K-4K tokens context)
├─ Format with citation markers
└─ Build prompt: "Using CONTEXT, answer QUESTION..."
    │
    ▼
LLM Generation:
├─ Send to Claude/OpenAI API
├─ Include instructions: "Ground in context, cite sources"
├─ Stream response to frontend
└─ Return citations with source references
    │
    ▼
Electron Renderer displays:
├─ Streamed response
├─ Clickable citations linking to source docs
├─ Save conversation to PostgreSQL (user_id, tenant_id)
└─ Update chat history UI
```

## Patterns to Follow

### Pattern 1: Layered Architecture with Tenant Context Propagation

**What:** Every request carries tenant_id through middleware that propagates to all downstream services.

**When:** All data operations to enforce isolation.

**Example:**
```typescript
// Middleware that extracts tenant from JWT/session
app.use((req, res, next) => {
  req.tenantId = decodeToken(req.headers.authorization);
  next();
});

// All database queries filter by tenant_id
const chunks = await vectorDB.search(queryEmbedding, {
  filter: { tenant_id: req.tenantId }
});
```

### Pattern 2: Separate Indexing and Runtime Pipelines

**What:** Document processing runs asynchronously (offline); query/response happens synchronously (online).

**When:** Index documents immediately after upload, but allow async processing to avoid blocking.

**Example:**
```typescript
// Upload endpoint enqueues job, returns immediately
app.post('/upload', async (req, res) => {
  const job = await queue.add('process-document', {
    file: req.file,
    tenantId: req.tenantId,
    userId: req.userId
  });
  res.json({ jobId: job.id, status: 'queued' });
});

// Worker processes queue independently
queue.process('process-document', async (job) => {
  await documentPipeline.run(job.data);
});
```

### Pattern 3: Hybrid Search for Industrial Terminology

**What:** Combine semantic search (vector similarity) with lexical search (BM25/keyword) to handle domain-specific jargon, acronyms, and codes.

**When:** Industrial domains have specialized terminology that may not be captured in embedding models.

**Implementation:**
- Index sparse vectors alongside dense vectors
- Use reciprocal rank fusion (RRF) to combine results
- Weight: semantic (0.7) + lexical (0.3)

### Pattern 4: Chunking with Overlap and Semantic Awareness

**What:** Use recursive text splitting with overlap; respect document structure (headings, sections).

**When:** Technical manuals and standards have hierarchical structure that should be preserved.

**Recommended Strategy:**
```typescript
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,      // tokens
  chunkOverlap: 200,    // tokens for context continuity
  separators: [
    '\n\n',      // paragraphs
    '\n',        // lines
    '. ',        // sentences
    ' ',         // words
    ''           // characters
  ]
});
```

### Pattern 5: Metadata-Enriched Embeddings

**What:** Include source document metadata in vector store to enable filtering and provenance tracking.

**Metadata to store:**
```typescript
{
  tenant_id: string,        // for isolation
  doc_id: string,          // links to PostgreSQL
  chunk_id: string,        // unique chunk identifier
  document_type: string,   // procedure, standard, manual
  section: string,         // hierarchical section
  page: number,            // source page
  uploaded_by: string,     // user ID
  uploaded_at: timestamp
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Shared Vector Tables Without Tenant Isolation

**What:** Storing all tenant embeddings in a single table without strict filtering.

**Why bad:** Data leakage between tenants; security breach; compliance violation.

**Instead:** Every query must filter by tenant_id; consider separate collections or namespaces for stronger isolation.

### Anti-Pattern 2: Client-Side Chunking or Embedding

**What:** Running chunking or embedding generation in Electron renderer process.

**Why bad:** Requires shipping embedding models (hundreds of MB); poor performance; exposes API keys.

**Instead:** All document processing on backend; frontend only sends files via IPC.

### Anti-Pattern 3: Synchronous Document Processing

**What:** Processing documents blocking the upload request until complete.

**Why bad:** Large industrial documents take minutes; users wait; poor UX.

**Instead:** Async queue processing; return job ID; poll for status.

### Anti-Pattern 4: No Chunk Overlap

**What:** Splitting documents without overlap between chunks.

**Why bad:** Semantic context lost at boundaries; reduces retrieval accuracy when answer spans chunk boundary.

**Instead:** 10-20% overlap (100-200 tokens for 1K chunks).

### Anti-Pattern 5: Single Embedding Model for All Purposes

**What:** Using general-purpose embedding model (e.g., text-embedding-ada-002) for industrial technical documents.

**Why bad:** Domain-specific terminology may not be well-represented.

**Instead:** Consider fine-tuned or domain-specific models like:
- `intfloat/e5-large-v2` (general)
- `BAAI/bge-large-en-v1.5` (English, strong MTEB)
- Custom fine-tune on industrial corpus

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| Document Storage | Local filesystem + PostgreSQL | Object storage (S3) + CDN | Sharded object storage |
| Vector DB | Single instance pgvector | Clustered pgvector or Pinecone | Multi-region Pinecone |
| API Layer | Single Node.js process | Load-balanced API servers | Microservices per domain |
| Queue Processing | Single worker | Multiple workers, priority queues | Distributed job processing |
| Database Queries | Indexed lookups | Connection pooling, read replicas | Sharding by tenant_id |
| LLM API Calls | Direct to provider | Rate limiting, caching layer | Regional providers, failover |

## Multi-Tenant Isolation Strategies

### Strategy 1: Metadata Filtering (Recommended for MVP)

**Approach:** Store all tenant data in shared tables with `tenant_id` column; filter at query time.

**Implementation:**
- PostgreSQL: All tenant-scoped tables include `tenant_id` with foreign key to tenants table
- Vector DB: Include `tenant_id` in metadata; filter all search queries
- Row Level Security (RLS): Enable PostgreSQL RLS for automatic tenant filtering

**Pros:**
- Simpler infrastructure (single database)
- Cost effective for small-to-medium tenant count
- Easy to manage migrations and schema changes

**Cons:**
- Requires discipline to always filter by tenant_id
- Risk of accidental data leakage if filter forgotten
- Harder to purge single tenant (must DELETE WHERE tenant_id)

**Mitigations:**
- Database middleware that auto-injects tenant filters
- Row Level Security (RLS) policies
- Comprehensive test suite for isolation

### Strategy 2: Database-Per-Tenant

**Approach:** Separate PostgreSQL database and vector collection per tenant.

**Pros:**
- Strong isolation (accidental query can't cross tenants)
- Easy to backup/restore/migrate single tenant
- Can scale resources per tenant (enterprise vs small)

**Cons:**
- Infrastructure complexity (connection pooling for N databases)
- Operational overhead (migrations across N databases)
- Cost increases with tenant count

**When:** Enterprise contracts with strict compliance requirements (ISO, HIPAA).

### Strategy 3: Schema-Per-Tenant

**Approach:** Separate schema within single database; `tenant_a.documents`, `tenant_b.documents`.

**Pros:**
- Moderate isolation
- Still single database connection pool
- Somewhat easier than full separate databases

**Cons:**
- PostgreSQL limits on number of schemas
- Migration complexity intermediate
- Still operational overhead

**Recommended for MVP:** **Strategy 1 - Metadata Filtering with RLS**

Start simple for MVP validation. Add RLS policies for automatic filtering. Upgrade to Strategy 2 for enterprise contracts requiring strict isolation.

## Electron Architecture Considerations

### Main vs Renderer Separation

```
Electron Main Process (Node.js)
├─ File system operations (uploads/downloads)
├─ IPC handlers (expose APIs to renderer)
├─ Local Node.js backend server (Express)
│  └─ Listens on localhost:PORT or Unix socket
└─ System tray, notifications, auto-updates

Renderer Process (Browser)
├─ React/Vue UI for chat, document management
├─ IPC calls to main process
└─ State management, real-time updates
```

### IPC Communication Pattern

**Never** embed API keys or perform LLM calls in renderer. Renderer calls main process via IPC:

```typescript
// Renderer (preload or frontend)
const { ipcRenderer } = require('electron');
ipcRenderer.invoke('chat:sendMessage', { message, conversationId });

// Main
ipcMain.handle('chat:sendMessage', async (event, payload) => {
  // Forward to local backend API
  const response = await fetch(`http://localhost:${API_PORT}/chat`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return response.json();
});
```

**Why:** Renderer runs in sandboxed browser context; API keys must stay in main process; Node.js APIs unavailable in renderer.

### Offline Considerations

MVP requires internet for LLM API calls. However:
- Cache chat history locally (IndexedDB in renderer)
- Show connection status
- Queue uploads if offline (upload when reconnected)

### Update Strategy

Use Electron auto-updater:
- Host backend API centrally (SaaS)
- Electron app auto-updates via GitHub releases or custom server
- Backend API changes must maintain backward compatibility or enforce app updates

## Vector Database Schema Design

### Table Structure (pgvector)

```sql
-- Documents table (metadata in PostgreSQL)
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT,
  upload_status TEXT DEFAULT 'pending',
  uploaded_by UUID,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  INDEX idx_tenant (tenant_id)
);

-- Chunks table with embeddings
CREATE TABLE chunks (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(384),  -- dimension depends on model
  metadata JSONB,
  FOREIGN KEY (document_id) REFERENCES documents(id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- HNSW index for fast similarity search
CREATE INDEX idx_chunks_embedding ON chunks
USING hnsw (embedding vector_cosine_ops);

-- Critical: Filter by tenant_id in EVERY query
-- Enable Row Level Security
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON chunks
  USING (tenant_id = current_setting('app.current_tenant')::UUID);
```

### Query Pattern with Tenant Isolation

```typescript
// Set tenant context for RLS
await pool.query(`SET app.current_tenant = '${tenantId}'`);

// Query automatically filtered by RLS
const results = await pool.query(`
  SELECT id, content, metadata, embedding <=> $1 as distance
  FROM chunks
  WHERE embedding <=> $1 < 0.3
  ORDER BY distance
  LIMIT 10
`, [queryEmbedding]);
```

## Recommended Technology Stack

| Layer | Technology | Rationale | Alternatives |
|-------|------------|-----------|--------------|
| Frontend | React + TypeScript | Industry standard, rich ecosystem | Vue 3, Svelte |
| Electron | Electron 28+ | Desktop distribution, Node integration | Tauri (smaller bundle) |
| Backend | Node.js + Express/Fastify | TypeScript support, async I/O | NestJS (structured), AdonisJS |
| Metadata DB | PostgreSQL 15+ | ACID, JSONB, pgvector extension | MySQL (limited vector support) |
| Vector DB | pgvector (extension) | Same DB, no separate infra | Pinecone (managed), Weaviate |
| Queue | Bull (Redis) or AWS SQS | Reliable async processing | RabbitMQ, Temporal |
| Embedding Model | sentence-transformers/all-MiniLM-L6-v2 | 384-dim, good quality, small | OpenAI text-embedding-3, Cohere |
| LLM Provider | Claude 3.5 Sonnet / GPT-4o | Strong RAG performance, citations | Llama 3 (self-hosted) |
| File Storage | Local filesystem (MVP) → S3 | Simple MVP, scalable later | Azure Blob, GCS |

## Build Order Dependencies

### Phase 1: Foundation (Weeks 1-2)

**Start with:**
1. PostgreSQL schema with multi-tenancy (tenants, users, RLS policies)
2. Authentication API (email/password, JWT tokens)
3. Tenant context middleware (propagate tenant_id)
4. Basic vector DB setup (pgvector extension, chunk table)

**Why first:** All subsequent components depend on tenant isolation and authentication.

### Phase 2: Document Ingestion (Weeks 2-3)

**Build:**
1. Document upload API (file validation, storage)
2. Asynchronous pipeline orchestrator (queue setup)
3. Text extraction (PDF/DOCX/TXT loaders)
4. Chunking logic with overlap
5. Embedding generation (embedding model integration)

**Dependencies:** Needs tenant context for metadata; needs base schema.

### Phase 3: Chat Core (Weeks 3-4)

**Build:**
1. Vector search API (tenant-scoped, similarity search)
2. Retrieval engine with reranking
3. LLM integration (Claude/OpenAI API with citation prompting)
4. Chat conversation persistence (chat history table)

**Dependencies:** Needs indexed documents; needs embedding pipeline operational.

### Phase 4: Electron Integration (Week 4-5)

**Build:**
1. Electron main process setup
2. IPC layer (secure communication)
3. React/Vue renderer with chat UI
4. Backend API proxy in main process

**Dependencies:** Backend APIs complete; can develop in parallel with Phase 3 after API contracts defined.

### Phase 5: Polish & Demo Data (Week 5-6)

**Build:**
1. Pre-loaded demo documents (industry standards, procedures)
2. Tenant branding system (logo, colors)
3. Document management UI (list, delete, status)
4. Error handling, loading states, progress indicators

**Dependencies:** All core features complete; final integration.

### Parallelization Strategy

- **Backend team** can work on Phases 1-3 while frontend team
  sets up Electron scaffolding and UI components against mock APIs.
- **Define API contracts early** (OpenAPI/Swagger) to enable parallel development.
- **API-first approach:** Backend implements contracts, frontend mocks locally, then integrates.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Multi-tenancy | Data leakage between tenants due to missing filter | Enable RLS, write integration tests that verify isolation, audit queries |
| Document Chunking | Over-chunking (too many small pieces) or under-chunking (too large) | Benchmark with industrial docs; target 500-1500 tokens per chunk; measure retrieval quality |
| Hybrid Search | Complexity without measurable improvement | Start with pure semantic search; add lexical only if relevance suffers on domain-specific queries |
| Electron IPC | Blocking main process with synchronous IPC | Use async IPC only; never block main thread; handle errors gracefully |
| Vector Indexing | Slow queries without proper index | Create HNSW index BEFORE production; tune parameters (M, ef_construction) |
| LLM Prompting | Hallucinations without citations | Strict prompt engineering: "If answer not in CONTEXT, say 'I cannot answer from available documents'" |
| Async Processing | Jobs failing silently | Job status tracking in DB; retry logic; alerting on failed jobs |

## Sources

- [Pinecone RAG Guide](https://www.pinecone.io/learn/retrieval-augmented-generation/)
- [LangChain RAG Tutorial](https://docs.langchain.com/oss/python/langchain/rag)
- [Databricks RAG Overview](https://www.databricks.com/glossary/retrieval-augmented-generation-rag)
- [AWS Multi-Tenant RAG](https://aws.amazon.com/blogs/machine-learning/implementing-multi-tenant-rag-applications-on-aws/)

