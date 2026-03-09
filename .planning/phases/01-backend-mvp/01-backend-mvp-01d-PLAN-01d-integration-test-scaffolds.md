---
phase: 01-backend-mvp
plan: 01d
type: execute
wave: 3
depends_on:
  - 01c
files_modified:
  - .env.example
  - tests/integration/rls.integration.spec.ts
  - tests/integration/tenant-isolation.integration.spec.ts
  - tests/integration/document-lifecycle.integration.spec.ts
  - tests/integration/embedding-pipeline.integration.spec.ts
  - tests/integration/chat-streaming.integration.spec.ts
  - tests/integration/authentication-flow.integration.spec.ts
  - tests/integration/hybrid-search.integration.spec.ts
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
  - TEN-01
  - TEN-02
  - TEN-03
user_setup: []
must_haves:
  truths:
    - "Integration test scaffolding ready for PostgreSQL with RLS"
    - "Environment variable template documents all required configuration"
    - ".env.example includes database, Redis, Qdrant, OpenAI, Anthropic, JWT secrets"
  artifacts:
    - path: ".env.example"
      provides: "Environment variable template for Phase 1 services"
      contains:
        - "DATABASE_URL"
        - "JWT_SECRET"
        - "REDIS_URL"
        - "QDRANT_URL"
        - "OPENAI_API_KEY"
        - "ANTHROPIC_API_KEY"
    - path: "tests/integration/rls.integration.spec.ts"
      provides: "Integration test verifying RLS policies active (TEN-01)"
    - path: "tests/integration/tenant-isolation.integration.spec.ts"
      provides: "Integration test verifying tenant isolation (TEN-02, TEN-03)"
    - path: "tests/integration/document-lifecycle.integration.spec.ts"
      provides: "Integration test for end-to-end document processing (DOC-05)"
    - path: "tests/integration/embedding-pipeline.integration.spec.ts"
      provides: "Integration test for embedding generation and Qdrant storage (DOC-08)"
    - path: "tests/integration/chat-streaming.integration.spec.ts"
      provides: "Integration test for SSE streaming responses (CHAT-10)"
    - path: "tests/integration/authentication-flow.integration.spec.ts"
      provides: "Integration test for full auth flow (AUTH-01 through AUTH-04)"
    - path: "tests/integration/hybrid-search.integration.spec.ts"
      provides: "Integration test for hybrid search with RRF (CHAT-02)"
  key_links:
    - from: "tests/integration/rls.integration.spec.ts"
      to: "PostgreSQL RLS policies"
      via: "SQL query checking relrowsecurity"
      pattern: "SELECT.*relrowsecurity"
    - from: ".env.example"
      to: "all integration tests"
      via: "test environment configuration"
      pattern: "DATABASE_URL"

---

<objective>
Create integration test scaffolds and .env.example template for Phase 1

Purpose: Provide integration testing infrastructure using real PostgreSQL, Redis (mocks optional). These tests verify RLS, tenant isolation, end-to-end document processing, full chat pipeline, and authentication flows.

Output: 7 integration test files with basic structure and complete .env.example template

</objective>

<execution_context>
@/Users/franciscoegloff/.claude/get-shit-done/workflows/execute-plan.md
@/Users/francisco/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-backend-mvp/01-CONTEXT.md
@.planning/phases/01-backend-mvp/01-RESEARCH.md

# Integration test requirements from RESEARCH.md:
- 7 integration tests covering TEN-01, TEN-02, TEN-03, DOC-05, DOC-08, CHAT-10, and full auth flow
- Use real PostgreSQL test database with RLS enabled
- Can mock external services (OpenAI, Anthropic) to avoid costs/latency
- Tests should be idempotent and clean up after themselves
- Use supertest for HTTP API testing
- Each test file should have basic structure and README instructions

# .env.example must include all Phase 1 configuration:
- Database: DATABASE_URL, PGUSER, PGPASSWORD, PGDATABASE, PGHOST, PGPORT
- JWT: JWT_SECRET, JWT_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN
- Redis: REDIS_URL
- Qdrant: QDRANT_URL, QDRANT_API_KEY
- OpenAI: OPENAI_API_KEY, OPENAI_EMBEDDING_MODEL, OPENAI_EMBEDDING_DIMS
- Anthropic: ANTHROPIC_API_KEY, CLAUDE_MODEL
- Email: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, FRONTEND_URL
- Rate limiting: RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS
- Feature flags: ENABLE_RERANKER
- Encryption: ENCRYPTION_KEY

</context>

<tasks>

<task type="auto">
  <name>Task 1: Create .env.example template</name>
  <files>
    .env.example
  </files>
  <action>
    Create .env.example with all required environment variables:

    ```bash
    # Database (PostgreSQL)
    DATABASE_URL=postgresql://user:pass@localhost:5432/opsai
    PGUSER=opsai
    PGPASSWORD=changeme
    PGDATABASE=opsai
    PGHOST=localhost
    PGPORT=5432

    # JWT Authentication
    JWT_SECRET=your-super-secret-jwt-key-change-this-minimum-256-bit
    JWT_EXPIRES_IN=15m
    REFRESH_TOKEN_EXPIRES_IN=7d

    # Redis (BullMQ)
    REDIS_URL=redis://localhost:6379

    # Qdrant (Vector Database)
    QDRANT_URL=http://localhost:6333
    QDRANT_API_KEY=optional-qdrant-api-key

    # OpenAI (Embeddings)
    OPENAI_API_KEY=sk-openai-api-key
    OPENAI_EMBEDDING_MODEL=text-embedding-3-large
    OPENAI_EMBEDDING_DIMS=3072

    # Anthropic Claude (LLM)
    ANTHROPIC_API_KEY=sk-ant-api-key
    CLAUDE_MODEL=claude-sonnet-4-6

    # Email Service (for verification, password reset)
    SMTP_HOST=smtp.example.com
    SMTP_PORT=587
    SMTP_USER=noreply@example.com
    SMTP_PASS=email-password
    EMAIL_FROM=noreply@example.com
    FRONTEND_URL=http://localhost:3000

    # Rate Limiting
    RATE_LIMIT_WINDOW_MS=60000
    RATE_LIMIT_MAX_REQUESTS=60

    # Feature Flags
    ENABLE_RERANKER=true

    # Encryption
    ENCRYPTION_KEY=change-this-to-32-byte-random-base64

    # Node Environment
    NODE_ENV=development
    ```

    Verify: File contains all required keys. Use grep to check for essential vars.
  </action>
  <verify>
    <automated>
      grep -q "DATABASE_URL" .env.example &&
      grep -q "JWT_SECRET" .env.example &&
      grep -q "OPENAI_API_KEY" .env.example &&
      grep -q "ANTHROPIC_API_KEY" .env.example &&
      grep -q "REDIS_URL" .env.example &&
      grep -q "QDRANT_URL" .env.example &&
      grep -q "ENCRYPTION_KEY" .env.example &&
      echo "All required env vars present in .env.example"
    </automated>
  </verify>
  <done>.env.example template created with all Phase 1 configuration variables</done>
</task>

<task type="auto">
  <name>Task 2: Create RLS integration test scaffold</name>
  <files>
    tests/integration/rls.integration.spec.ts
  </files>
  <action>
    Create rls.integration.spec.ts for TEN-01:

    ```typescript
    import { Test, TestingModule } from '@nestjs/testing';
    import { INestApplication } from '@nestjs/common';
    import * as request from 'supertest';
    import { AppModule } from '../src/app/app.module';
    import { PostgresService } from '../src/shared/database/database.service';

    describe('RLS Enforcement (TEN-01)', () => {
      let app: INestApplication;
      let db: PostgresService;

      beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
          imports: [AppModule],
        }).compile();

        app = module.createNestApplication();
        await app.init();

        db = module.get<PostgresService>('PostgresService');
      });

      it('should verify RLS policies are enabled on tenant-scoped tables', async () => {
        // TEN-01: RLS policies defined and enforced
        // Query: SELECT relrowsecurity FROM pg_class WHERE relname = 'users'
        const result = await db.$executeRaw`
          SELECT relrowsecurity FROM pg_class WHERE relname = 'users'
        `;
        // Expect: relrowsecurity = true (1)
        // RED: Write test that asserts RLS enabled
      });

      afterAll(async () => {
        await app.close();
      });
    });
    ```

    Similarly create stubs for the other 6 integration tests with basic describe/it blocks referencing their requirement IDs.

    Verify: All 7 integration test files exist with describe blocks and correct requirement references.
  </action>
  <verify>
    <automated>
      ls tests/integration/*.spec.ts 2>/dev/null | wc -l | grep -q 7 &&
      echo "All 7 integration test files created"
    </automated>
  </verify>
  <done>Integration test scaffolds created (7 files)</done>
</task>

</tasks>

<verification>
Wave 0d - Integration test scaffolds and env template complete

**Automated checks:**
1. .env.example exists and contains all required keys (grep for DATABASE_URL, JWT_SECRET, OPENAI_API_KEY, ANTHROPIC_API_KEY, REDIS_URL, QDRANT_URL, ENCRYPTION_KEY)
2. All 7 integration test files exist in tests/integration/
3. Each integration test file has basic structure (beforeAll, it block, afterAll) and references requirement IDs
4. Tests discoverable by Jest: `npx jest --listTests` includes integration tests

**Coverage:** Integration tests cover TEN-01, TEN-02, TEN-03, DOC-05, DOC-08, CHAT-10, and full auth flow (AUTH-01-04).

**Note:** These are scaffolding files; actual test implementation will happen during execution phase when corresponding modules are built.

</verification>

<success_criteria>
Wave 0 complete when:
- [ ] Plan 01a: jest.config.js and tsconfig.json configured
- [ ] Plan 01b: conftest.ts and 3 document fixtures created
- [ ] Plan 01c: 18 unit test files created with basic structure
- [ ] Plan 01d: .env.example complete and 7 integration test scaffolds created
- [ ] Total test files: 20 unit + 7 integration + conftest + jest.config + .env = 30 files
- [ ] All files compile without TypeScript errors (initial check: `npx tsc --noEmit`)
- [ ] `npm test -- --listTests` discovers all expected test files

**Phase 1 Test Infrastructure Complete**

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-01d-PLAN-01d-summary.md`
</output>
