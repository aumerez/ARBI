# Requirements: OpsAI Platform

**Defined:** 2025-03-08
**Core Value:** Every operational decision backed by your company's complete knowledge base + industry benchmarks.

## v1 Requirements

Requirements for initial MVP release. Each maps to roadmap phases.

### Authentication & Multi-Tenancy

- [ ] **AUTH-01**: User can sign up with email and password (email verification required)
- [ ] **AUTH-02**: User can log in with credentials and receive persistent session (JWT)
- [ ] **AUTH-03**: User can log out from any page (session invalidation)
- [ ] **AUTH-04**: User can reset password via email link
- [ ] **TEN-01**: System enforces tenant isolation at database level (PostgreSQL RLS)
- [ ] **TEN-02**: All data operations automatically filter by tenant context (metadata tenant_id)
- [ ] **TEN-03**: Users can only access their own tenant's documents and chat history

### Tenant Branding

- [ ] **TEN-04**: Tenant can upload custom logo (displayed in app header/footer)
- [ ] **TEN-05**: Tenant can customize primary and secondary colors throughout UI
- [ ] **TEN-06**: System displays "Powered by Ops AI Platform" attribution with tenant name option
- [ ] **TEN-07**: Branding colors/logo applied consistently across all screens

### Document Management

- [ ] **DOC-01**: User can upload documents (PDF, DOCX, TXT) with drag-and-drop and file picker
- [ ] **DOC-02**: System validates file type and size (max 50MB per document)
- [ ] **DOC-03**: System displays upload progress indicator
- [ ] **DOC-04**: System processes uploaded documents asynchronously with status tracking
- [ ] **DOC-05**: User sees document status: Queued, Processing, Indexed, Error
- [ ] **DOC-06**: System extracts text content from documents using production-grade parsers
- [ ] **DOC-07**: System chunks documents with semantic awareness (respects sections, 500-1500 tokens)
- [ ] **DOC-08**: System generates embeddings for chunks and stores in vector database with tenant_id
- [ ] **DOC-09**: User can list all their tenant's documents with metadata (name, type, upload date, size, status)
- [ ] **DOC-10**: User can delete documents (cascade cleanup from metadata DB and vector store)
- [ ] **DOC-11**: System shows clear error messages for failed uploads/processing

### RAG Chat Interface (Core)

- [ ] **CHAT-01**: User can open chat interface with natural language text input
- [ ] **CHAT-02**: System retrieves relevant document chunks using hybrid search (semantic + BM25)
- [ ] **CHAT-03**: System generates responses using Claude API grounded in retrieved context
- [ ] **CHAT-04**: System includes inline citations ([1], [2]) linking to source documents
- [ ] **CHAT-05**: User can click citations to view source document snippets with context
- [ ] **CHAT-06**: System shows document name, page/section when available in citations
- [ ] **CHAT-07**: System maintains conversation history within a chat session
- [ ] **CHAT-08**: User can create new chat conversations
- [ ] **CHAT-09**: User can view list of past conversations (date, preview, re-open)
- [ ] **CHAT-10**: System provides streaming responses (type-out effect)
- [ ] **CHAT-11**: System refuses to answer when no relevant context is found (no hallucinations)
- [ ] **CHAT-12**: System indicates confidence/grounding when sources are weak
- [ ] **CHAT-13**: User can delete chat conversations (with cascade cleanup from database)

### Demo Content

- [ ] **DEMO-01**: System comes pre-loaded with 10-20 oil & gas industry sample documents (standards, procedures, optimization guides)
- [ ] **DEMO-02**: Sample documents are fully indexed and searchable out of the box
- [ ] **DEMO-03**: Sample documents include varied formats (PDF standards, DOCX procedures, TXT references)
- [ ] **DEMO-04**: System displays sample Q&A prompts/tutorial on first use to demonstrate capabilities
- [ ] **DEMO-05**: Demo mode enabled by default for new tenants (can upload real docs to replace)

### Compliance & Quality

- [ ] **QUAL-01**: System logs all queries and responses for audit trail (tenant-scoped)
- [ ] **QUAL-02**: System maintains document versioning (immutable upload history)
- [ ] **QUAL-03**: System validates response citations against retrieved sources (no fake citations)
- [ ] **QUAL-04**: System implements rate limiting per user to prevent abuse
- [ ] **QUAL-05**: System encrypts sensitive data at rest (JWT secrets, API keys)

## v2 Requirements

Deferred to future release after MVP validation.

### Advanced Document Processing

- **RAG-02**: Table-aware chunking that preserves tabular data integrity
- **RAG-03**: Image extraction with OCR for scanned documents and charts
- **RAG-04**: Multi-language document support (Spanish, Portuguese for Latin America operations)

### Enhanced Chat Features

- **CHAT-14**: User can export chat conversation to PDF/JSON
- **CHAT-15**: System provides query expansion (acronym resolution, spelling correction)
- **CHAT-16**: System offers domain-specific query templates (Production optimization for well X, Safety procedures for equipment Y)
- **CHAT-17**: System includes usage analytics (query volume, popular documents, user activity)

### User Management

- **AUTH-05**: User role management (Admin, Viewer, Editor)
- **AUTH-06**: Admin can invite users via email
- **AUTH-07**: Admin can view and manage tenant users
- **AUTH-08**: SSO integration (SAML, OIDC, Azure AD) per enterprise contract

### Project/Workspace Organization

- **DOC-12**: User can create named projects/workspaces to group documents and chats
- **DOC-13**: User can assign documents to specific projects
- **DOC-14**: User can share projects with other team members (read-only or collaborative)
- **CHAT-18**: Chats are scoped to selected project workspace

### Advanced Analytics

- **ANALYT-01**: Admin dashboard showing tenant-wide metrics (query trends, knowledge gaps)
- **ANALYT-02**: Most-accessed documents report
- **ANALYT-03**: User activity tracking and adoption metrics
- **ANALYT-04**: Exportable reports for management review

## Out of Scope

Explicitly excluded to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time operational data integration (IoT, SCADA feeds) | Requires streaming infrastructure, time-series DB, SLA guarantees — out of scope for document-based MVP |
| Multi-user collaboration on same chat session | Complex real-time sync, conflict resolution — single-user validated first, shared sessions Phase 2+ |
| Custom LLM fine-tuning | Expensive, requires curated datasets, uncertain ROI — RAG with off-the-shelf models sufficient |
| Mobile applications (iOS/Android) | Desktop-first (Electron) for MVP — mobile adds UI complexity, app store overhead |
| Offline mode without internet | Requires local vector DB + model inference — desktop app implies connectivity |
| Document co-authoring/editing | Different product category (Google Docs) — read-only RAG access only |
| Voice input/speech-to-text | Adds voice recognition pipeline — text-only for MVP |
| Workflow automation engine | BPMS complexity — keep as decision support only |
| Social features (comments, likes, shares) | Not aligned with industrial use case — no social features |
| Plugin marketplace | Platform complexity and security risks — closed platform only |
| Advanced admin panel with SCIM | Overkill for small-mid organizations — simple user CRUD sufficient for MVP |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| TEN-01 | Phase 0 | Pending |
| TEN-02 | Phase 0 | Pending |
| TEN-03 | Phase 0 | Pending |
| TEN-04 | Phase 2 | Pending |
| TEN-05 | Phase 2 | Pending |
| TEN-06 | Phase 2 | Pending |
| TEN-07 | Phase 2 | Pending |
| DOC-01 | Phase 1 | Pending |
| DOC-02 | Phase 1 | Pending |
| DOC-03 | Phase 1 | Pending |
| DOC-04 | Phase 1 | Pending |
| DOC-05 | Phase 1 | Pending |
| DOC-06 | Phase 1 | Pending |
| DOC-07 | Phase 1 | Pending |
| DOC-08 | Phase 1 | Pending |
| DOC-09 | Phase 2 | Pending |
| DOC-10 | Phase 2 | Pending |
| DOC-11 | Phase 2 | Pending |
| CHAT-01 | Phase 2 | Pending |
| CHAT-02 | Phase 1 | Pending |
| CHAT-03 | Phase 1 | Pending |
| CHAT-04 | Phase 1 | Pending |
| CHAT-05 | Phase 2 | Pending |
| CHAT-06 | Phase 2 | Pending |
| CHAT-07 | Phase 2 | Pending |
| CHAT-08 | Phase 2 | Pending |
| CHAT-09 | Phase 2 | Pending |
| CHAT-10 | Phase 2 | Pending |
| CHAT-11 | Phase 1 | Pending |
| CHAT-12 | Phase 1 | Pending |
| CHAT-13 | Phase 2 | Pending |
| DEMO-01 | Phase 4 | Pending |
| DEMO-02 | Phase 4 | Pending |
| DEMO-03 | Phase 4 | Pending |
| DEMO-04 | Phase 4 | Pending |
| DEMO-05 | Phase 4 | Pending |
| QUAL-01 | Phase 3 | Pending |
| QUAL-02 | Phase 3 | Pending |
| QUAL-03 | Phase 1 | Pending |
| QUAL-04 | Phase 0 | Pending |
| QUAL-05 | Phase 0 | Pending |

**Coverage:**
- v1 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0 ✓

---

*Requirements defined: 2025-03-08*
*Last updated: 2025-03-08 after initialization*
