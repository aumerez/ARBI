# Roadmap: OpsAI Platform MVP

**Project:** OpsAI Platform - Industrial RAG for Oil & Gas Operations
**Granularity:** Coarse (5 phases)
**Total v1 Requirements:** 40
**Coverage:** 40/40 requirements mapped ✓

---

## Phases

- [x] **Phase 0: Architecture & Foundation** - Database schema with RLS, multi-tenancy strategy, API contracts, security model
- [x] **Phase 1: Backend MVP** - Authentication, document processing pipeline, RAG engine with hybrid search, chat API with streaming and citations
- [x] **Phase 2: Desktop MVP** - Electron application with secure IPC, document management UI, chat interface with streaming responses and citation display
- [x] **Phase 3: Evaluation & Compliance** - Golden evaluation dataset, automated testing pipeline, audit logging, document versioning, production monitoring
- [x] **Phase 4: Polish & Demo Preparation** - Pre-loaded demo documents, performance optimization, error handling, user documentation

---

## Phase Details

### Phase 0: Architecture & Foundation

**Goal:** Establish the architectural foundation and multi-tenancy strategy before any code is written.

**Depends on:** Nothing (first phase)

**Requirements:** TEN-01, TEN-02, TEN-03, QUAL-04, QUAL-05

**Success Criteria** (what must be TRUE):
1. Database schema includes tenant_id on all tenant-scoped tables with PostgreSQL RLS policies defined and documented
2. API layer has tenant context middleware that propagates tenant_id to all database operations
3. Security model finalized: JWT authentication strategy, password hashing algorithm (bcrypt), rate limiting implementation specified
4. API contracts (OpenAPI specs) defined for authentication, document upload, chat endpoints before implementation begins

**Plans:** TBD

---

### Phase 1: Backend MVP

**Goal:** Deliver all backend services needed for the RAG pipeline and user authentication.

**Depends on:** Phase 0

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06, DOC-07, DOC-08, CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-10, CHAT-11, CHAT-12, QUAL-03

**Success Criteria** (what must be TRUE):
1. User can sign up with email/password, verify email, log in with JWT session that persists across browser sessions, and log out from any page
2. User can upload documents (PDF, DOCX, TXT) up to 50MB, see upload progress, and receive status updates (queued, processing, indexed, error)
3. System extracts text from uploaded documents using production-grade parsers, chunks with semantic awareness (500-1500 tokens, 10-20% overlap), generates embeddings, and stores in vector database with tenant_id filtering
4. User can send chat queries that retrieve relevant chunks via hybrid search (semantic + BM25), receive streaming Claude responses grounded in retrieved context with inline citations ([1], [2])
5. System refuses to answer when no relevant context found (no hallucinations) and indicates confidence/grounding when sources are weak
6. System validates response citations against retrieved sources to prevent fake citations

**Plans:** TBD

---

### Phase 2: Desktop MVP

**Goal:** Complete the Electron desktop application with full UI for document management and chat.

**Depends on:** Phase 1 (API contracts defined; backend can be mocked initially)

**Requirements:** TEN-04, TEN-05, TEN-06, TEN-07, DOC-09, DOC-10, DOC-11, CHAT-05, CHAT-06, CHAT-07, CHAT-08, CHAT-09, CHAT-13

**Success Criteria** (what must be TRUE):
1. User can view list of all tenant documents with metadata (name, type, upload date, size, status) and delete documents (with cascade cleanup)
2. User can start new chat conversations, view list of past conversations (date, preview), reopen previous chats, and delete conversations
3. User can click citations in chat responses to see source document snippets with highlighted context, including document name and page/section when available
4. Tenant branding is applied: custom logo appears in app header/footer, primary/secondary colors applied consistently throughout UI, "Powered by Ops AI Platform" attribution displayed
5. Electron app enforces security: contextIsolation enabled, nodeIntegration disabled, secure IPC layer, no secrets in renderer process
6. User receives clear, user-friendly error messages for failed uploads, processing errors, or API failures

**Plans:** TBD

---

### Phase 3: Evaluation & Compliance

**Goal:** Implement quality assurance and compliance infrastructure before MVP launch.

**Depends on:** Phase 1 (RAG pipeline operational)

**Requirements:** QUAL-01, QUAL-02

**Success Criteria** (what must be TRUE):
1. System logs all queries and responses to immutable, tenant-scoped audit trail with query details, retrieved sources, response text, and timestamps
2. Document versioning implemented: uploads create new versions rather than overwriting; system retains immutable history with effective dates; deletions are soft deletes with retention
3. Automated evaluation pipeline runs against golden dataset (100+ query-answer pairs) to measure retrieval precision@5, answer similarity (ROUGE/BERTScore), hallucination rate (<5%), and citation accuracy
4. Production monitoring dashboard shows per-query metrics (retrieval score, context length, response length) and captures user feedback (implicit + explicit thumbs up/down)
5. Compliance features include: regulatory content displayed as exact quotes, "based on document version X" disclaimers on answers, and audit trail retained with PII anonymization

**Plans:** TBD

---

### Phase 4: Polish & Demo Preparation

**Goal:** Final integration, demo content, performance optimization, and documentation for MVP launch.

**Depends on:** Phases 1, 2, 3 (all core features complete, quality systems in place)

**Requirements:** DEMO-01, DEMO-02, DEMO-03, DEMO-04, DEMO-05

**Success Criteria** (what must be TRUE):
1. System comes pre-loaded with 10-20 oil & gas industry sample documents (API specs, ASTM standards, safety procedures) in varied formats (PDF, DOCX, TXT) that are fully indexed and searchable
2. System displays sample Q&A prompts/tutorial on first use that demonstrate core capabilities ("How do I optimize production for well X?")
3. Demo mode enabled by default for new tenants showing sample documents; users can upload real documents to replace demo content
4. End-to-end testing passes: upload document → processing within 5 minutes → appears in document list → query retrieves relevant chunks → chat response cites sources correctly
5. Performance optimized: vector search queries return in <2 seconds, embedding generation processes at least 10 pages/minute, chat streaming begins within 1 second of API response start
6. Documentation delivered: user guide (how to upload, query, manage documents), admin guide (tenant management, branding), troubleshooting runbook (common errors, support contacts)

**Plans:** TBD

---

## Progress Tracking

| Phase | Name | Requirements | Status | Plans Complete |
|-------|------|--------------|--------|----------------|
| 0 | Architecture & Foundation | 5 | Not started | 0/3 |
| 1 | Backend MVP | 20 | Not started | 0/8 |
| 2 | Desktop MVP | 13 | Not started | 0/6 |
| 3 | Evaluation & Compliance | 2 | Not started | 0/5 |
| 4 | Polish & Demo Preparation | 5 | Not started | 0/6 |

---

## Coverage Summary

**All 40 v1 requirements mapped to phases:**

**Phase 0 (5):** TEN-01, TEN-02, TEN-03, QUAL-04, QUAL-05

**Phase 1 (20):** AUTH-01, AUTH-02, AUTH-03, AUTH-04, DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06, DOC-07, DOC-08, CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-10, CHAT-11, CHAT-12, QUAL-03

**Phase 2 (13):** TEN-04, TEN-05, TEN-06, TEN-07, DOC-09, DOC-10, DOC-11, CHAT-05, CHAT-06, CHAT-07, CHAT-08, CHAT-09, CHAT-13

**Phase 3 (2):** QUAL-01, QUAL-02

**Phase 4 (5):** DEMO-01, DEMO-02, DEMO-03, DEMO-04, DEMO-05

**Total:** 5 + 20 + 13 + 2 + 5 = 40 ✓

---

## Dependencies

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4
(arch)    (backend)  (desktop) (evaluate) (polish)
```

**Notes:**
- Phase 2 can begin in parallel with Phase 1 after API contracts are defined (mock APIs)
- Phase 3 depends on Phase 1 (RAG pipeline must be operational for evaluation)
- Phase 4 depends on all prior phases (full integration required)

---

*Roadmap created: 2025-03-08*
*Based on research recommendations from SUMMARY.md*
*Granularity: coarse (5 phases)*
*Mode: yolo*
