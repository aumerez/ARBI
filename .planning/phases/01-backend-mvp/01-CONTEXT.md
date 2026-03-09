# Phase 1: Backend MVP - Context

**Gathered:** 2025-03-08
**Status:** Ready for planning (auto-advance)

<domain>
## Phase Boundary

Deliver all backend services needed for the RAG pipeline and user authentication: multi-tenant auth (email/password), document upload/processing pipeline, semantic chunking, embedding generation, vector storage, hybrid search, RAG chat with Claude, streaming responses, and citation generation. This phase establishes the core backend API that the desktop app will consume.

**Out of scope for this phase:** Desktop UI, tenant branding UI, document management UI beyond basic API, evaluation framework, compliance audit logging, demo content, advanced document formats (tables/OCR).

</domain>

<decisions>
## Implementation Decisions

### Authentication & Multi-Tenancy
- Email/password authentication (not SSO for MVP)
- JWT-based sessions with persistent cookies
- Password reset via email (forgot password flow)
- Tenant isolation enforced at database level via PostgreSQL Row Level Security (RLS)
- All queries automatically filter by tenant_id from JWT context
- Multi-tenancy baked into EVERY data operation (cannot be retrofitted)

### Document Processing
- Supported formats: PDF, DOCX, TXT (minimum viable)
- Production-grade parsers: pdfjs-dist for PDF, mammoth for DOCX, native for TXT
- Chunking strategy: semantic-aware recursive splitting with 10-20% overlap (100-200 tokens)
- Target chunk size: 500-1500 tokens (preserves procedure boundaries)
- Processing: asynchronous via BullMQ job queue (Redis-backed)
- Maximum file size: 50MB per document
- Status tracking: queued → processing → indexed/error

### RAG Pipeline
- Embedding model: OpenAI `text-embedding-3-large` (3072 dimensions, 8192 token context)
- Vector database: Qdrant with tenant-scoped collections (filter on tenant_id)
- Hybrid search: semantic (dense vectors 0.7 weight) + BM25 (lexical 0.3 weight) with RRF fusion
- Retrieval: top-k chunks (k=10-20) with reranking via cross-encoder (ms-marco-MiniLM-L-6-v2)
- LLM: Anthropic Claude API with citation support (`<cite>` tags)
- Streaming responses enabled for chat UX
- Strict grounding: refuse to answer if no relevant context retrieved
- Citation validation: inline [1], [2] linking to source document snippets

### Chat Interface (Backend API)
- Conversation history: stored per user, within session persistence
- New conversation creation via POST /chats
- List past conversations with preview
- Delete conversations (cascade cleanup)
- Streaming responses via Server-Sent Events (SSE)
- User can send queries and receive grounded responses with citations
- Error handling: clear messages, retry logic for transient failures

### Quality & Compliance (Locked)
- No hallucinations policy: system must refuse when context insufficient
- Citation accuracy mandatory: validate retrieved sources before including citations
- Audit logging: all queries/responses logged with tenant_id, user_id, timestamp
- Document versioning: append-only upload history, soft deletes
- Rate limiting: per-user JWT-based limits to prevent abuse
- Encryption: API keys and secrets encrypted at rest

### Tech Stack (from Research)
- Backend: NestJS (Node.js + TypeScript)
- Database: PostgreSQL with pgvector extension for metadata + Qdrant for vectors
- Queue: BullMQ (Redis)
- Embeddings: OpenAI API (not self-hosted for MVP)
- LLM: Anthropic Claude API
- API: OpenAPI spec defined before implementation
- Authentication: JWT + bcrypt password hashing

</decisions>

<specifics>
## Specific Ideas

- Chat should feel like Claude/OpenAI desktop app familiar to users
- Citations must be clickable to view source snippets with document name, page/section
- Demo mode with pre-loaded oil & gas sample documents (API specs, ASTM standards, safety procedures)
- Tenant branding colors/logo integrated from system metadata (not built in Phase 1 but foundation must support it)
- Streaming responses with type-out effect for UX
- System should indicate confidence/grounding when sources are weak

</specifics>

<code_context>
## Existing Code Insights

**No existing codebase** — this is a greenfield project.

Research SUMMARY.md provides:
- Architecture patterns: 4-component RAG (ingestion, storage, retrieval, generation)
- Dependencies: Multi-tenancy → Auth → Document Processing → Chat API
- Build order: Foundation (Phase 0) → Backend MVP (Phase 1) → Desktop MVP (Phase 2)
- Critical pitfalls to avoid: tenant data isolation (catastrophic if missed), document processing failures, hallucinations

</code_context>

<deferred>
## Deferred Ideas

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

</deferred>

---

*Phase: 01-backend-mvp*
*Context gathered: 2025-03-08*
