---
phase: 01-backend-mvp
plan: 01c
type: execute
wave: 2
depends_on:
  - 01b
files_modified:
  - tests/auth/auth.service.spec.ts
  - tests/auth/jwt.strategy.spec.ts
  - tests/auth/password-reset.service.spec.ts
  - tests/auth/register.pipe.spec.ts
  - tests/auth/login.pipe.spec.ts
  - tests/documents/documents.controller.spec.ts
  - tests/documents/file-validation.pipe.spec.ts
  - tests/documents/status.service.spec.ts
  - tests/documents/processors/pdf.processor.spec.ts
  - tests/documents/processors/docx.processor.spec.ts
  - tests/documents/processors/txt.processor.spec.ts
  - tests/documents/chunking/text-splitter.service.spec.ts
  - tests/documents/document-queue.service.spec.ts
  - tests/chat/chat.controller.spec.ts
  - tests/chat/retrieval/hybrid-search.service.spec.ts
  - tests/chat/generation/claude-client.service.spec.ts
  - tests/chat/citation-validator.service.spec.ts
  - tests/chat/no-context.service.spec.ts
  - tests/chat/confidence.service.spec.ts
  - tests/chat/reranker.service.spec.ts
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
    - "All unit test files exist with describe/it blocks for TDD red-green-refactor cycle"
    - "Each test file imports conftest mocks and uses test data builders"
    - "Tests compile without TypeScript errors"
  artifacts:
    - path: "tests/auth/auth.service.spec.ts"
      provides: "Tests for auth service (register, login, logout, password reset)"
      min_lines: 50
    - path: "tests/auth/jwt.strategy.spec.ts"
      provides: "Tests for JWT validation and tenant_id extraction"
      min_lines: 30
    - path: "tests/auth/password-reset.service.spec.ts"
      provides: "Tests for password reset flow"
      min_lines: 30
    - path: "tests/auth/register.pipe.spec.ts"
      provides: "Tests for register DTO validation"
      min_lines: 20
    - path: "tests/auth/login.pipe.spec.ts"
      provides: "Tests for login DTO validation"
      min_lines: 20
    - path: "tests/documents/documents.controller.spec.ts"
      provides: "Tests for document upload/status/list/delete endpoints"
      min_lines: 50
    - path: "tests/documents/file-validation.pipe.spec.ts"
      provides: "Tests for file type and size validation"
      min_lines: 20
    - path: "tests/documents/status.service.spec.ts"
      provides: "Tests for document status tracking"
      min_lines: 30
    - path: "tests/documents/processors/pdf.processor.spec.ts"
      provides: "Tests for PDF text extraction"
      min_lines: 30
    - path: "tests/documents/processors/docx.processor.spec.ts"
      provides: "Tests for DOCX text extraction"
      min_lines: 30
    - path: "tests/documents/processors/txt.processor.spec.ts"
      provides: "Tests for TXT extraction (identity)"
      min_lines: 20
    - path: "tests/documents/chunking/text-splitter.service.spec.ts"
      provides: "Tests for semantic chunking with 500-1500 tokens and 10-20% overlap"
      min_lines: 30
    - path: "tests/documents/document-queue.service.spec.ts"
      provides: "Tests for BullMQ job creation"
      min_lines: 30
    - path: "tests/chat/chat.controller.spec.ts"
      provides: "Tests for chat endpoints (create, list, delete, send, stream)"
      min_lines: 50
    - path: "tests/chat/retrieval/hybrid-search.service.spec.ts"
      provides: "Tests for hybrid search with RRF fusion"
      min_lines: 40
    - path: "tests/chat/generation/claude-client.service.spec.ts"
      provides: "Tests for Claude streaming client"
      min_lines: 40
    - path: "tests/chat/citation-validator.service.spec.ts"
      provides: "Tests for citation validation (QUAL-03)"
      min_lines: 30
    - path: "tests/chat/no-context.service.spec.ts"
      provides: "Tests for no-context guard logic (CHAT-11)"
      min_lines: 20
    - path: "tests/chat/confidence.service.spec.ts"
      provides: "Tests for confidence scoring (CHAT-12)"
      min_lines: 20
    - path: "tests/chat/reranker.service.spec.ts"
      provides: "Tests for reranker (optional MVP)"
      min_lines: 20
  key_links:
    - from: "tests/auth/*.spec.ts"
      to: "AUTH-01 through AUTH-04"
      via: "unit test coverage"
      pattern: "auth\.service\.spec"
    - from: "tests/documents/*.spec.ts"
      to: "DOC-01 through DOC-08"
      via: "unit test coverage"
      pattern: "documents/.*\.spec"
    - from: "tests/chat/*.spec.ts"
      to: "CHAT-01 through CHAT-04, CHAT-10-12, QUAL-03"
      via: "unit test coverage"
      pattern: "chat/.*\.spec"

---

<objective>
Create all unit test file scaffolds (18 files) for TDD approach

Purpose: Establish complete test scaffolding before implementation. Each test file corresponds to one or more requirements described in RESEARCH.md validation architecture.

Output: 18 test files with basic describe/it structure, imports, and mocks ready for test-driven development

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

# Test structure from RESEARCH.md validation section:
- Auth (5 tests): AUTH-01,02,03,04
- Documents (8 tests): DOC-01 through DOC-08
- Chat (7 tests): CHAT-01,02,03,04,10,11,12, QUAL-03
- Total: 20 unit test files needed

# Each test file must:
- Import conftest mocks
- Use describe() and it() blocks
- Include test expectations (toBe, toEqual, etc.)
- Reference requirement IDs in comments
- Be discoverable by Jest pattern **/*.spec.ts

</context>

<tasks>

<task type="auto">
  <name>Task 1: Create auth unit test files</name>
  <files>
    tests/auth/auth.service.spec.ts
    tests/auth/jwt.strategy.spec.ts
    tests/auth/password-reset.service.spec.ts
    tests/auth/register.pipe.spec.ts
    tests/auth/login.pipe.spec.ts
  </files>
  <action>
    Create 5 auth test files with basic structure:

    For auth.service.spec.ts:
    ```typescript
    import { Test, TestingModule } from '@nestjs/testing';
    import { AuthService } from '../src/auth/auth.service';
    import { MockPostgresService } from '../tests/conftest';

    describe('AuthService', () => {
      let service: AuthService;

      beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
          providers: [
            AuthService,
            { provide: 'PostgresService', useClass: MockPostgresService },
          ],
        }).compile();

        service = module.get<AuthService>(AuthService);
      });

      describe('register (AUTH-01)', () => {
        it('should create user with hashed password', async () => {
          // RED: Write failing test first
        });
      });

      describe('login (AUTH-02)', () => {
        it('should issue JWT tokens (15m access, 7d refresh)', async () => {
          // RED: Test to be implemented
        });
      });

      describe('logout (AUTH-03)', () => {
        it('should invalidate refresh token', async () => {
          // RED: Test to be implemented
        });
      });

      describe('password reset (AUTH-04)', () => {
        it('should generate reset token with expiry', async () => {
          // RED: Test to be implemented
        });
      });
    });
    ```

    For jwt.strategy.spec.ts:
    ```typescript
    describe('JwtStrategy (AUTH-02)', () => {
      it('should validate token and extract tenant_id', async () => {
        // RED: Test to be implemented
      });
      it('should reject expired token', async () => {
        // RED: Test to be implemented
      });
    });
    ```

    For password-reset.service.spec.ts:
    ```typescript
    describe('PasswordResetService (AUTH-04)', () => {
      it('should update password with valid token', async () => {
        // RED: Test to be implemented
      });
    });
    ```

    For register.pipe.spec.ts and login.pipe.spec.ts:
    ```typescript
    describe('RegisterPipe', () => {
      it('should validate email and password length', () => {
        // RED: Test to be implemented using class-validator
      });
    });
    ```

    Verify: All 5 files exist, compile without syntax errors, contain describe/it blocks.
  </action>
  <verify>
    <automated>
      for f in tests/auth/*.spec.ts; do [ -f "$f" ] && grep -q "describe" "$f" && grep -q "it" "$f"; done &&
      echo "All 5 auth test files created with structure"
    </automated>
  </verify>
  <done>Auth unit test scaffolds created (5 files)</done>
</task>

<task type="auto">
  <name>Task 2: Create documents unit test files</name>
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
    Create 8 document test files:

    documents.controller.spec.ts (DOC-01):
    ```typescript
    describe('DocumentsController', () => {
      describe('POST /documents/upload (DOC-01)', () => {
        it('should accept file and return jobId', async () => {
          // RED: Test to implement
        });
        it('should reject files >50MB', async () => {
          // RED: Test to implement
        });
        it('should reject invalid mime types', async () => {
          // RED: Test to implement
        });
      });
    });
    ```

    file-validation.pipe.spec.ts (DOC-02):
    ```typescript
    describe('FileValidationPipe', () => {
      it('should validate mime type (accept PDF, DOCX, TXT)', () => {
        // RED: Test to implement
      });
      it('should validate file size (max 50MB)', () => {
        // RED: Test to implement
      });
    });
    ```

    status.service.spec.ts (DOC-03, DOC-04):
    ```typescript
    describe('StatusService', () => {
      it('should track job status (queued, processing, indexed, error)', async () => {
        // RED: Test to implement
      });
    });
    ```

    processors/*.spec.ts (DOC-06):
    - pdf.processor.spec.ts: test extractText returns text with page markers
    - docx.processor.spec.ts: test extractText returns raw text
    - txt.processor.spec.ts: test extractText returns exact content

    text-splitter.service.spec.ts (DOC-07):
    ```typescript
    describe('TextSplitterService', () => {
      it('should split text into 500-1500 token chunks', async () => {
        // RED: Test to implement
      });
      it('should apply 10-20% overlap', async () => {
        // RED: Test to implement
      });
    });
    ```

    document-queue.service.spec.ts (DOC-04, DOC-08):
    ```typescript
    describe('DocumentQueueService', () => {
      it('should add document job to BullMQ queue', async () => {
        // RED: Test to implement
      });
    });
    ```

    Verify: All 8 files exist with describe blocks referencing DOC requirements.
  </action>
  <verify>
    <automated>
      ls tests/documents/*.spec.ts tests/documents/processors/*.spec.ts tests/documents/chunking/*.spec.ts 2>/dev/null | wc -l | grep -q 8 &&
      echo "All 8 document test files created"
    </automated>
  </verify>
  <done>Documents unit test scaffolds created (8 files)</done>
</task>

<task type="auto">
  <name>Task 3: Create chat unit test files</name>
  <files>
    tests/chat/chat.controller.spec.ts
    tests/chat/retrieval/hybrid-search.service.spec.ts
    tests/chat/generation/claude-client.service.spec.ts
    tests/chat/citation-validator.service.spec.ts
    tests/chat/no-context.service.spec.ts
    tests/chat/confidence.service.spec.ts
    tests/chat/reranker.service.spec.ts
  </files>
  <action>
    Create 7 chat test files:

    chat.controller.spec.ts (CHAT-01, CHAT-10):
    ```typescript
    describe('ChatController', () => {
      describe('POST /chats (CHAT-01)', () => {
        it('should create conversation', async () => {
          // RED: Test to implement
        });
      });
      describe('GET /chats/:id/messages/stream (CHAT-10)', () => {
        it('should return SSE stream', async () => {
          // RED: Test to implement
        });
      });
    });
    ```

    retrieval/hybrid-search.service.spec.ts (CHAT-02):
    ```typescript
    describe('HybridSearchService', () => {
      it('should perform semantic and BM25 search with RRF fusion', async () => {
        // RED: Test to implement
      });
    });
    ```

    generation/claude-client.service.spec.ts (CHAT-03):
    ```typescript
    describe('ClaudeClientService', () => {
      it('should stream chat response from Claude API', async () => {
        // RED: Test to implement
      });
    });
    ```

    citation-validator.service.spec.ts (CHAT-04, QUAL-03):
    ```typescript
    describe('CitationValidatorService', () => {
      it('should validate citations match retrieved chunks', () => {
        // RED: Test to implement
      });
      it('should reject invalid citation [99] when only 5 chunks retrieved', () => {
        // RED: Test to implement
      });
    });
    ```

    no-context.service.spec.ts (CHAT-11):
    ```typescript
    describe('NoContextService', () => {
      it('should block response when retrieval score < 0.5', () => {
        // RED: Test to implement
      });
    });
    ```

    confidence.service.spec.ts (CHAT-12):
    ```typescript
    describe('ConfidenceService', () => {
      it('should indicate low/medium/high based on scores', () => {
        // RED: Test to implement
      });
    });
    ```

    reranker.service.spec.ts (optional):
    ```typescript
    describe('RerankerService', () => {
      it('should rerank chunks by relevance', async () => {
        // RED: Test stub or minimal implementation
      });
    });
    ```

    Verify: All 7 files exist with describe blocks referencing CHAT requirements.
  </action>
  <verify>
    <automated>
      ls tests/chat/*.spec.ts tests/chat/retrieval/*.spec.ts tests/chat/generation/*.spec.ts 2>/dev/null | wc -l | grep -q 7 &&
      echo "All 7 chat test files created"
    </automated>
  </verify>
  <done>Chat unit test scaffolds created (7 files)</done>
</task>

</tasks>

<verification>
Wave 0c - Unit test scaffolds complete

**Automated checks:**
1. All 18 unit test files exist:
   - Auth: 5 files
   - Documents: 8 files
   - Chat: 7 files
2. Each file contains `describe()` and at least one `it()`
3. Files compile without TypeScript syntax errors: `npx tsc --noEmit tests/auth/*.spec.ts tests/documents/*.spec.ts tests/chat/*.spec.ts`
4. Imports from conftest work (no module resolution errors)

**Coverage:** All 20 Phase 1 requirements have corresponding test files for TDD cycle.

</verification>

<success_criteria>
Unit test scaffolds ready when:
- [ ] 5 auth test files exist with basic describe/it structure
- [ ] 8 documents test files exist with basic describe/it structure
- [ ] 7 chat test files exist with basic describe/it structure
- [ ] All files import conftest or use test builders
- [ ] Each test file references corresponding requirement ID (AUTH-XX, DOC-XX, CHAT-XX, QUAL-03)
- [ ] `npx jest --listTests` discovers all 18 new test files

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-01c-PLAN-01c-summary.md`
</output>
