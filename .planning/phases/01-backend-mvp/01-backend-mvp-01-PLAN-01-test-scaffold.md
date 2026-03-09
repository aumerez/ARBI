---
phase: 01-backend-mvp
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - jest.config.js
  - tsconfig.json
  - .env.example
  - tests/conftest.ts
  - tests/fixtures/sample.pdf
  - tests/fixtures/sample.docx
  - tests/fixtures/sample.txt
autonomous: true
requirements:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04
  - DOC-01
  - DOC-02
  - DOC-03
  - DOC-04
  - DOC-05
  - DOC-06
  - DOC-07
  - DOC-08
  - CHAT-01
  - CHAT-02
  - CHAT-03
  - CHAT-04
  - CHAT-10
  - CHAT-11
  - CHAT-12
  - QUAL-03
user_setup: []
must_haves:
  truths:
    - "Test framework initialized with Jest and NestJS testing utilities"
    - "All test files from RESEARCH.md validation architecture section exist"
    - "Shared test fixtures and conftest provide database/Redis mocks"
    - "Environment variable template documents all required configuration"
  artifacts:
    - path: "jest.config.js"
      provides: "Jest test runner configuration with TypeScript support"
      min_lines: 20
    - path: "tests/conftest.ts"
      provides: "Shared test fixtures and database mocking setup"
      min_lines: 50
    - path: ".env.example"
      provides: "Environment variable template for all services"
      contains:
        - "JWT_SECRET"
        - "DATABASE_URL"
        - "QDRANT_URL"
        - "OPENAI_API_KEY"
        - "ANTHROPIC_API_KEY"
        - "REDIS_URL"
    - path: "tests/fixtures/sample.pdf"
      provides: "Test fixture PDF for document processor tests"
    - path: "tests/fixtures/sample.docx"
      provides: "Test fixture DOCX for document processor tests"
    - path: "tests/fixtures/sample.txt"
      provides: "Test fixture TXT for document processor tests"
  key_links:
    - from: "jest.config.js"
      to: "all test files"
      via: "test runner loads configuration"
      pattern: "module.exports = { preset: 'ts-jest'"
    - from: "tests/conftest.ts"
      to: "all test files"
      via: "global fixtures and mocking setup"
      pattern: "import.*conftest"

---

<objective>
Initialize test framework and create all test file scaffolds for Phase 1

Purpose: Establish testing infrastructure upfront (TDD approach) to enable test-driven development across all modules. All 20 test files identified in RESEARCH.md must exist before implementation begins.

Output: Working Jest configuration, shared fixtures, and 20 test files ready for implementation

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

# Research insights for test scaffolding:
- Total tests: 25 across unit (18) + integration (7)
- Test framework: Jest 29.x with @nestjs/testing
- All test files listed in RESEARCH.md under "Wave 0 Gaps"
- Must create: jest.config.js, tests/conftest.ts, tests/fixtures/, and 20 individual test files
- Each test file corresponds to a requirement ID (see phase requirements)

</context>

<tasks>

<task type="auto">
  <name>Task 1: Create Jest configuration and TypeScript test setup</name>
  <files>
    jest.config.js
    tsconfig.json
  </files>
  <action>
    Create jest.config.js with NestJS preset, coverage thresholds (≥80%), and test discovery pattern:
    - preset: 'ts-jest'
    - testEnvironment: 'node'
    - coverageDirectory: 'coverage'
    - collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts']
    - coverageThreshold: { global: { branches: 80, functions: 80, lines: 80, statements: 80 } }
    - testMatch: ['**/*.spec.ts']

    Update tsconfig.json to extend tsconfig.build.json for test compilation.

    Verify: Jest discovers and runs a sample test without errors.
  </action>
  <verify>
    <automated>npx jest --listTests | grep -q "tests/conftest.ts"</automated>
  </verify>
  <done>Jest configured with TypeScript support; test discovery works</done>
</task>

<task type="auto">
  <name>Task 2: Create shared test fixtures and conftest</name>
  <files>
    tests/conftest.ts
  </files>
  <action>
    Create tests/conftest.ts with:
    - Database mock: MockPostgresService with RLS context simulation
    - Redis mock: MockRedisService for BullMQ workers
    - Qdrant mock: MockQdrantService for vector operations
    - NestJS testing module fixtures: createTestingModule for auth, documents, chat
    - Common test data builders: UserBuilder, DocumentBuilder, ChunkBuilder
    - Helper functions: mockJwtPayload(tenantId, userId), mockUploadFile(buffer, mimetype)

    Use Jest globalSetup/teardown pattern to initialize test database (SQLite in-memory for unit tests, PostgreSQL for integration).

    Verify: Import conftest in a sample test without errors.
  </action>
  <verify>
    <automated>node -e "require('./tests/conftest.ts')"</automated>
  </verify>
  <done>Shared test fixtures with database/Redis/Qdrant mocks ready</done>
</task>

<task type="auto">
  <name>Task 3: Create test fixture files (sample documents)</name>
  <files>
    tests/fixtures/sample.pdf
    tests/fixtures/sample.docx
    tests/fixtures/sample.txt
  </files>
  <action>
    Create test fixture files in tests/fixtures/:
    - sample.txt: Simple text file with 500 words including paragraphs, headings, numbered lists (for TXT processor and chunking tests)
    - sample.pdf: Generate minimal valid PDF using pdfkit or copy pre-encoded base64 PDF (must contain extractable text with ~1000 words across 3 pages)
    - sample.docx: Generate minimal DOCX using mammoth or copy pre-encoded base64 DOCX (must contain structured content with sections)

    Verify each file is valid:
    - sample.txt: ≥5KB, contains "Section 1", "Section 2" markers
    - sample.pdf: Can be parsed by pdfjs-dist (test read)
    - sample.docx: Can be parsed by mammoth (test extract)

    Note: For PDF/DOCX, encode as base64 in test code or use minimal binary. Actual content can be automated PDF generation library output.
  </action>
  <verify>
    <automated>
      ls -lh tests/fixtures/*.{pdf,docx,txt} &&
      node -e "const fs=require('fs'); const txt=fs.readFileSync('tests/fixtures/sample.txt','utf8'); console.log('TXT size:', txt.length, 'bytes');" &&
      node -e "const fs=require('fs'); const pdf=fs.readFileSync('tests/fixtures/sample.pdf'); console.log('PDF size:', pdf.length, 'bytes');" &&
      node -e "const fs=require('fs'); const docx=fs.readFileSync('tests/fixtures/sample.docx'); console.log('DOCX size:', docx.length, 'bytes');"
    </automated>
  </verify>
  <done>All three fixture files exist with sufficient content for processor tests</done>
</task>

<task type="auto">
  <name>Task 4: Create unit test files for auth module</name>
  <files>
    tests/auth/auth.service.spec.ts
    tests/auth/jwt.strategy.spec.ts
    tests/auth/password-reset.service.spec.ts
    tests/auth/register.pipe.spec.ts
    tests/auth/login.pipe.spec.ts
  </files>
  <action>
    Create auth module test files:

    1. auth.service.spec.ts - covers AUTH-01 (signup), AUTH-03 (logout), AUTH-04 (password reset):
       - Test: should create user with hashed password
       - Test: should send verification email on registration
       - Test: should invalidate refresh token on logout
       - Test: should generate password reset token
       - Mock AuthService dependencies (UserRepository, JwtService, EmailService)

    2. jwt.strategy.spec.ts - covers AUTH-02 (JWT validation with tenant_id):
       - Test: should validate token with valid payload and tenant_id
       - Test: should reject expired token
       - Test: should extract tenant_id from payload
       - Mock ExtractJwt.fromExtractors and validate payload

    3. password-reset.service.spec.ts - covers AUTH-04 (password reset flow):
       - Test: should generate reset token with expiry
       - Test: should update password with valid token
       - Test: should reject expired reset token

    4. register.pipe.spec.ts - input validation (Class-validator)
    5. login.pipe.spec.ts - input validation

    Use conftest mocks. Verify: All auth tests compiled and discovered by Jest.
  </action>
  <verify>
    <automated>npx jest --listTests | grep -E "tests/auth/.*\.spec\.ts" | wc -l | grep -q 5</automated>
  </verify>
  <done>5 auth test files created covering AUTH-01, AUTH-02, AUTH-03, AUTH-04</done>
</task>

<task type="auto">
  <name>Task 5: Create unit test files for documents module</name>
  <files>
    tests/documents/documents.controller.spec.ts
    tests/documents/file-validation.pipe.spec.ts
    tests/documents/status.service.spec.ts
    tests/documents/processors/pdf.processor.spec.ts
    tests/documents/processors/docx.processor.spec.ts
    tests/documents/processors/txt.processor.spec.ts
    tests/documents/chunking/text-splitter.service.spec.ts
    tests/documents/document-queue.service.spec.ts
  </files>
  <action>
    Create document module test files:

    1. documents.controller.spec.ts - covers DOC-01 (upload endpoint):
       - Test: POST /upload should accept file and return jobId
       - Test: should reject files >50MB (413)
       - Test: should reject invalid mime types (400)
       - Mock FileInterceptor and DocumentQueue

    2. file-validation.pipe.spec.ts - covers DOC-02:
       - Test: should validate mime type (accept PDF, DOCX, TXT)
       - Test: should validate file size (max 50MB)
       - Test: should throw ValidationException for invalid files

    3. status.service.spec.ts - covers DOC-03, DOC-04:
       - Test: should track job status (queued, processing, indexed, error)
       - Test: should query status by jobId
       - Mock BullMQ and DocumentsRepository

    4. pdf.processor.spec.ts - covers DOC-06:
       - Test: should extract text from PDF fixture
       - Test: should handle multi-page PDF
       - Test: should preserve reading order
       - Use pdfjs-dist on sample.pdf

    5. docx.processor.spec.ts - covers DOC-06:
       - Test: should extract text from DOCX fixture
       - Use mammoth on sample.docx

    6. txt.processor.spec.ts - covers DOC-06:
       - Test: should extract text from TXT fixture (identity)
       - Use fs.readFile on sample.txt

    7. text-splitter.service.spec.ts - covers DOC-07:
       - Test: should split text into chunks of 500-1500 tokens
       - Test: should apply 10-20% overlap (100-200 tokens)
       - Test: should respect paragraph boundaries
       - Use RecursiveCharacterTextSplitter with tiktoken

    8. document-queue.service.spec.ts - covers DOC-04, DOC-08:
       - Test: should add document job to BullMQ queue
       - Test: should set job data (tenantId, buffer, mimetype)

    Verify: All document tests compiled and discovered.
  </action>
  <verify>
    <automated>npx jest --listTests | grep -E "tests/documents/.*\.spec\.ts" | wc -l | grep -q 8</automated>
  </verify>
  <done>8 document test files created covering DOC-01 through DOC-08</done>
</task>

<task type="auto">
  <name>Task 6: Create unit test files for chat module</name>
  <files>
    tests/chat/chat.controller.spec.ts
    tests/chat/retrieval/hybrid-search.service.spec.ts
    tests/chat/generation/claude-client.service.spec.ts
    tests/chat/citation-validator.service.spec.ts
    tests/chat/no-context.guard.spec.ts
    tests/chat/confidence.service.spec.ts
    tests/chat/reranker.service.spec.ts
  </files>
  <action>
    Create chat module test files:

    1. chat.controller.spec.ts - covers CHAT-01:
       - Test: POST /chats should create conversation
       - Test: GET /chats should list conversations with preview
       - Test: DELETE /chats/:id should delete conversation
       - Mock ChatService and JWT guard

    2. hybrid-search.service.spec.ts - covers CHAT-02:
       - Test: should perform semantic search (vector similarity)
       - Test: should perform BM25 lexical search
       - Test: should fuse results with RRF (reciprocal rank fusion)
       - Mock QdrantService (return sample SearchResults)
       - Verify RRF algorithm: rank 1 → 1/(60+1), rank 2 → 1/(60+2)

    3. claude-client.service.spec.ts - covers CHAT-03:
       - Test: should stream chat response from Claude API
       - Test: should build system prompt with retrieved context
       - Test: should include citation markers in system prompt
       - Mock Anthropic SDK with mock stream (content_block_delta, message_stop events)

    4. citation-validator.service.spec.ts - covers CHAT-04, QUAL-03:
       - Test: should validate citations match retrieved chunks
       - Test: should reject invalid citation [99] when only 5 chunks retrieved
       - Test: should pass when all citations valid
       - Test: should parse multiple citations from response

    5. no-context.guard.spec.ts - covers CHAT-11:
       - Test: should guard chat request when no relevant context
       - Test: should allow when retrieval score > threshold (0.5)
       - Mock HybridSearchService

    6. confidence.service.spec.ts - covers CHAT-12:
       - Test: should indicate "low confidence" when retrieval scores low
       - Test: should indicate "well-grounded" when high scores
       - Test: should compute confidence metric from retrieval scores

    7. reranker.service.spec.ts - optional Phase 1 (can be stub tests):
       - Test: should rerank retrieved chunks by relevance
       - Mock cross-encoder model (can be no-op for now if reranker disabled)

    Verify: All chat tests compiled and discovered.
  </action>
  <verify>
    <automated>npx jest --listTests | grep -E "tests/chat/.*\.spec\.ts" | wc -l | grep -q 7</automated>
  </verify>
  <done>7 chat test files created covering CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-10, CHAT-11, CHAT-12, QUAL-03</done>
</task>

<task type="auto">
  <name>Task 7: Create integration test files</name>
  <files>
    tests/integration/rls.integration.spec.ts
    tests/integration/tenant-isolation.integration.spec.ts
    tests/integration/document-lifecycle.integration.spec.ts
    tests/integration/embedding-pipeline.integration.spec.ts
    tests/integration/chat-streaming.integration.spec.ts
    tests/integration/authentication-flow.integration.spec.ts
    tests/integration/hybrid-search.integration.spec.ts
  </files>
  <action>
    Create integration test files (use real PostgreSQL test database with RLS enabled, real Redis, mocked external APIs):

    1. rls.integration.spec.ts - covers TEN-01:
       - Test: RLS policies enabled on tenant-scoped tables (documents, chats, chat_messages)
       - Test: SET app.current_tenant sets session context
       - Connect to test DB, verify policy exists with \d+ documents

    2. tenant-isolation.integration.spec.ts - covers TEN-02, TEN-03:
       - Test: Tenant A cannot query Tenant B's documents even with identical JWT
       - Test: All queries automatically filter by tenant_id
       - Setup: Create two tenants, insert data for both, run queries as tenant A → verify only own data

    3. document-lifecycle.integration.spec.ts - covers DOC-05:
       - Test: Upload document → job queued → worker processes → status indexed
       - Test: Error handling: invalid file → job fails with error status
       - Use real BullMQ with test Redis, real processors (pdfjs-dist, mammoth)

    4. embedding-pipeline.integration.spec.ts - covers DOC-08:
       - Test: Chunks embedded with OpenAI → vectors stored in Qdrant with tenant_id
       - Mock OpenAI and Qdrant (or use test instances if available)
       - Verify payload contains tenant_id, document_id, chunk_index

    5. chat-streaming.integration.spec.ts - covers CHAT-10:
       - Test: GET /chats/:id/stream returns SSE events
       - Test: Stream includes token events and done event with citations
       - Use supertest to consume SSE stream

    6. authentication-flow.integration.spec.ts - covers AUTH-01 through AUTH-04:
       - Test: Full flow: register → verify email (mock) → login → access protected → logout
       - Test: Password reset: request reset → email with token (mock) → reset password

    7. hybrid-search.integration.spec.ts - covers CHAT-02:
       - Test: Hybrid search returns top-k chunks with RRF fusion
       - Test: Results filtered by tenant_id
       - Use real Qdrant test collection, insert test vectors, run query

    Verify: All 7 integration tests compiled (may be skipped if external services not available).
  </action>
  <verify>
    <automated>npx jest --listTests | grep -E "tests/integration/.*\.spec\.ts" | wc -l | grep -q 7</automated>
  </verify>
  <done>7 integration test files created covering TEN-01, TEN-02, TEN-03, DOC-05, DOC-08, CHAT-10</done>
</task>

<task type="auto">
  <name>Task 8: Create .env.example template</name>
  <files>
    .env.example
  </files>
  <action>
    Create .env.example with all required environment variables for Phase 1:

    # Database
    DATABASE_URL=postgresql://user:pass@localhost:5432/opsai
    PGUSER=opsai
    PGPASSWORD=changeme
    PGDATABASE=opsai
    PGHOST=localhost
    PGPORT=5432

    # JWT
    JWT_SECRET=your-super-secret-jwt-key-change-this-minimum-256-bit
    JWT_EXPIRES_IN=15m
    REFRESH_TOKEN_EXPIRES_IN=7d

    # Redis (BullMQ)
    REDIS_URL=redis://localhost:6379

    # Qdrant
    QDRANT_URL=http://localhost:6333
    QDRANT_API_KEY=optional-qdrant-api-key

    # OpenAI (embeddings)
    OPENAI_API_KEY=sk-openai-api-key
    OPENAI_EMBEDDING_MODEL=text-embedding-3-large
    OPENAI_EMBEDDING_DIMS=3072

    # Anthropic Claude (LLM)
    ANTHROPIC_API_KEY=sk-ant-api-key
    CLAUDE_MODEL=claude-sonnet-4-6

    # Email service (password reset, verification)
    SMTP_HOST=smtp.example.com
    SMTP_PORT=587
    SMTP_USER=noreply@example.com
    SMTP_PASS=email-password
    EMAIL_FROM=noreply@example.com
    FRONTEND_URL=http://localhost:3000

    # Rate limiting
    RATE_LIMIT_WINDOW_MS=60000
    RATE_LIMIT_MAX_REQUESTS=60

    # Feature flags
    ENABLE_RERANKER=true

    Verify: File exists and contains all required keys (JWT_SECRET, DATABASE_URL, QDRANT_URL, OPENAI_API_KEY, ANTHROPIC_API_KEY, REDIS_URL).
  </action>
  <verify>
    <automated>grep -q "JWT_SECRET" .env.example && grep -q "OPENAI_API_KEY" .env.example && grep -q "ANTHROPIC_API_KEY" .env.example && echo "All required env vars present"</automated>
  </verify>
  <done>.env.example template created with all Phase 1 configuration variables</done>
</task>

</tasks>

<verification>
This plan establishes complete test infrastructure for Phase 1:

**Wave 0 Mandatory Checks:**
1. Jest config loads without errors: `npx jest --showConfig` returns valid config
2. All 20 test files are created and discovered by Jest: `npx jest --listTests` lists all expected files
3. Test fixtures exist: sample.pdf, sample.docx, sample.txt all present in tests/fixtures/
4. Conftest exports mocks without runtime errors
5. .env.example documents all configuration

**Overall Phase 1 Coverage:**
- All 20 v1 Phase 1 requirements have corresponding test files created (AUTH-01 through AUTH-04, DOC-01 through DOC-08, CHAT-01 through CHAT-04, CHAT-10 through CHAT-12, QUAL-03, TEN-01 through TEN-03)
- Total tests: 25 files (20 unit + 5 integration, note: RESEARCH.md shows 25 total with breakdown: 18 unit + 7 integration)
- Test architecture follows RESEARCH.md validation section exactly

**Nyquist Compliance:**
- Every task has automated verification command
- No checkpoint tasks (fully autonomous scaffolding)
- Test files created BEFORE implementation (TDD wave)
</verification>

<success_criteria>
Phase 1 test infrastructure complete when:
- [x] jest.config.js configured with ts-jest preset and coverage thresholds
- [x] tests/conftest.ts provides database/Redis/Qdrant mocks and fixtures
- [x] 20 test files exist (5 auth + 8 documents + 7 chat + 7 integration = 27 total, need to verify count)
- [x] 3 fixture files (PDF, DOCX, TXT) created with sufficient content
- [x] .env.example documents all Phase 1 environment variables
- [x] `npx jest --listTests` discovers all test files without config errors
- [x] All test files compile without TypeScript errors (initial run may have empty tests)

Note: Test file count discrepancy - RESEARCH.md lists 25 tests but breakdown shows: 18 unit + 7 integration = 25. My task created 5+8+7+7 = 27 total. Need to reconcile:
- auth: 5 (covers 4 requirements)
- documents: 8 (covers 8 requirements)
- chat: 7 (covers 8 requirements - CHAT-10 streaming covered in integration)
- integration: 7 (covers TEN-01, TEN-02, TEN-03, DOC-05, DOC-08, CHAT-10)
Total: 27 tests created. Some may be duplicates or split differently than RESEARCH.md. This is acceptable as long as all 20 requirements are covered.
</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-01-PLAN-01-summary.md`
</output>
