---
phase: 01-backend-mvp
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/shared/database/database.module.ts
  - src/shared/database/database.service.ts
  - src/shared/infrastructure/redis.service.ts
  - src/shared/infrastructure/qdrant.service.ts
  - src/shared/infrastructure/openai.service.ts
  - migrations/001-init-schema.sql
  - prisma/schema.prisma
  - src/app/app.module.ts
autonomous: true
requirements:
  - TEN-01
  - TEN-02
  - TEN-03
  - QUAL-04
  - QUAL-05
user_setup: []
must_haves:
  truths:
    - "PostgreSQL database is accessible with connection pooling configured"
    - "RLS policies are defined and enforced on all tenant-scoped tables"
    - "Qdrant collections are created with tenant_id payload indexing"
    - "Redis is configured for BullMQ job queue"
    - "OpenAI and Anthropic clients are configured with API keys"
    - "Infrastructure services are injectable across NestJS modules"
  artifacts:
    - path: "prisma/schema.prisma"
      provides: "Database schema with tenant-aware tables"
      contains:
        - "model User"
        - "model Document"
        - "model Chat"
        - "model ChatMessage"
        - "model DocumentChunk"
        - "tenant_id integer"
    - path: "migrations/001-init-schema.sql"
      provides: "SQL migration with RLS policies and tenant isolation"
      contains:
        - "CREATE POLICY tenant_isolation"
        - "CREATE ROLE app"
        - "GRANT SELECT ON documents TO app"
    - path: "src/shared/database/database.module.ts"
      provides: "NestJS module exporting TypeORM/Prisma connection"
    - path: "src/shared/database/database.service.ts"
      provides: "Database service with RLS context management (SET app.current_tenant)"
    - path: "src/shared/infrastructure/redis.service.ts"
      provides: "Redis connection provider for BullMQ"
    - path: "src/shared/infrastructure/qdrant.service.ts"
      provides: "Qdrant client with collection creation and tenant-scoped operations"
    - path: "src/shared/infrastructure/openai.service.ts"
      provides: "OpenAI client wrapper for embedding generation"
  key_links:
    - from: "src/shared/database/database.service.ts"
      to: "PostgreSQL RLS"
      via: "query: SET app.current_tenant = $1"
      pattern: "SET app.current_tenant"
    - from: "prisma/schema.prisma"
      to: "migrations/001-init-schema.sql"
      via: "schema export"
      pattern: "prisma migrate dev"
    - from: "src/shared/infrastructure/qdrant.service.ts"
      to: "Qdrant collections"
      via: "createCollection(tenantId)"
      pattern: "createCollection.*tenantId"
    - from: "src/shared/infrastructure/redis.service.ts"
      to: "BullMQ workers"
      via: "Redis connection injection"
      pattern: "new Worker.*redisService.getConnection"

---

<objective>
Set up core infrastructure: database with RLS, Redis, Qdrant, and OpenAI/Anthropic clients

Purpose: Establish foundational services that all other modules depend on. Multi-tenancy enforced at database level via RLS. All external service clients configured with proper credentials.

Output: Working database connection, RLS policies, Redis service, Qdrant client, OpenAI & Anthropic SDKs configured

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
- PostgreSQL RLS: Set app.current_tenant from JWT, policies filter automatically
- Qdrant: tenant-scoped collections (tenant_123), payload filtering on tenant_id
- BullMQ: Redis connection required for job queue
- OpenAI: text-embedding-3-large (3072 dim)
- Anthropic: Claude API with streaming support
- Project structure: src/shared/infrastructure/ for external services, src/shared/database/ for DB layer

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Define database schema with Prisma</name>
  <files>
    prisma/schema.prisma
  </files>
  <behavior>
    - Test 1: Schema can be validated without errors: `prisma validate`
    - Test 2: Schema includes all required models: User, Document, DocumentChunk, Chat, ChatMessage
    - Test 3: Each tenant-scoped table has tenant_id integer field (not null)
    - Test 4: Relationships defined: User.hasMany(Document), Document.hasMany(DocumentChunk), etc.
    - Test 5: Timestamps createdAt, updatedAt present on all models
  </behavior>
  <action>
    Create prisma/schema.prisma with tenant-aware models:

    - User: id, email (unique), password_hash, tenant_id (integer), email_verified, created_at, updated_at
    - Document: id, tenant_id, user_id (uploader), filename, mimetype, size, status (enum: queued,processing,indexed,error), error_message nullable, created_at, updated_at
    - DocumentChunk: id, document_id, chunk_index, content (text), embedding (DoubleArray? or store in Qdrant only), token_count, created_at
      Note: embeddings stored in Qdrant, not PostgreSQL; keep metadata only
    - Chat: id, tenant_id, user_id, title, created_at, updated_at
    - ChatMessage: id, chat_id, role (enum: user,assistant), content, citations (JSON? or separate table), retrieved_chunk_ids (JSON array), created_at
    - RefreshToken: id, user_id, token (hashed), expires_at, revoked, created_at
    - PasswordResetToken: id, user_id, token (hashed), expires_at, used, created_at

    Define @@index on tenant_id for all tenant-scoped tables.
    Define @@unique on email in User.

    Enable PostgreSQL extensions: pgcrypto for gen_random_uuid() if needed.

    Run `prisma validate` to ensure schema syntax correct.
  </action>
  <verify>
    <automated>npx prisma validate && echo "Schema valid"</automated>
  </verify>
  <done>Prisma schema defined with all Phase 1 models and tenant_id fields</done>
</task>

<task type="auto">
  <name>Task 2: Create SQL migration with RLS policies</name>
  <files>
    migrations/001-init-schema.sql
  </files>
  <action>
    Generate SQL from Prisma schema and add RLS policies. Steps:

    1. Run: `npx prisma migrate dev --name init --create-only` generates migration file
    2. Edit generated migration to add RLS setup BEFORE data changes:
       - Enable RLS: ALTER TABLE users ENABLE ROW LEVEL SECURITY;
       - Create policy: CREATE POLICY tenant_isolation_users ON users USING (tenant_id = current_setting('app.current_tenant')::integer);
       - Repeat for documents, chats, chat_messages, document_chunks, refresh_tokens, password_reset_tokens
    3. Also create application role: CREATE ROLE app; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app;
    4. Ensure SET app.current_tenant = ... is executed by middleware after JWT validation

    Manual migration content (if prisma generate insufficient):
    ```sql
    -- Enable RLS on all tenant-scoped tables
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
    ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
    ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
    ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
    ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
    ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

    -- Create policy: filter by tenant_id from session context
    CREATE POLICY tenant_isolation_users ON users
      USING (tenant_id = current_setting('app.current_tenant')::integer);
    CREATE POLICY tenant_isolation_documents ON documents
      USING (tenant_id = current_setting('app.current_tenant')::integer);
    CREATE POLICY tenant_isolation_chats ON chats
      USING (tenant_id = current_setting('app.current_tenant')::integer);
    CREATE POLICY tenant_isolation_chat_messages ON chat_messages
      USING (tenant_id = current_setting('app.current_tenant')::integer);
    CREATE POLICY tenant_isolation_document_chunks ON document_chunks
      USING (tenant_id = current_setting('app.current_tenant')::integer);
    CREATE POLICY tenant_isolation_refresh_tokens ON refresh_tokens
      USING (tenant_id = current_setting('app.current_tenant')::integer);
    CREATE POLICY tenant_isolation_password_reset_tokens ON password_reset_tokens
      USING (tenant_id = current_setting('app.current_tenant')::integer);

    -- Optional: Ensure app role can SET the session variable
    GRANT USAGE ON SCHEMA public TO app;
    ```

    Verify: Migration SQL syntax validated, all tables have RLS enabled.
  </action>
  <verify>
    <automated>cat migrations/001-init-schema.sql | grep -q "ENABLE ROW LEVEL SECURITY" && echo "RLS policies present"</automated>
  </verify>
  <done>SQL migration created with RLS policies on all tenant-scoped tables</done>
</task>

<task type="auto">
  <name>Task 3: Create Database module and service</name>
 <files>
    src/shared/database/database.module.ts
    src/shared/database/database.service.ts
  </files>
  <action>
    Create NestJS module and service:

    1. database.module.ts:
       - Imports PrismaModule (from @prisma/nestjs) or TypeOrmModule
       - Provides DatabaseService as singleton
       - Exports DatabaseService

    2. database.service.ts:
       - Injects PrismaService (extends PrismaService) or TypeORM connection
       - Method: `setTenantContext(tenantId: number): Promise<void>` executes `SET app.current_tenant = $1`
       - Method: `clearTenantContext(): Promise<void>` executes `RESET app.current_tenant`
       - Use raw query: `this.prisma.$executeRaw` or `this.connection.query()`
       - Add logging: logger.debug(`Tenant context set: ${tenantId}`)

    The tenant context middleware (to be created in auth module) will call setTenantContext after JWT validation.

    Verify: Service can connect to database and execute raw query without errors.
  </action>
  <verify>
    <automated>grep -q "setTenantContext" src/shared/database/database.service.ts && grep -q "SET app.current_tenant" src/shared/database/database.service.ts && echo "Database service methods defined"</automated>
  </verify>
  <done>Database module with tenant context management ready for injection</done>
</task>

<task type="auto">
  <name>Task 4: Create Redis service for BullMQ</name>
  <files>
    src/shared/infrastructure/redis.service.ts
  </files>
  <action>
    Create RedisService that provides ioredis connection:

    - Use IORedis client from 'ioredis'
    - Read REDIS_URL from config (ConfigService or env)
    - Method: `getConnection(): Redis` returns configured Redis instance
    - Handle connection events: on('error'), on('connect'), on('close')
    - Implement retry logic with exponential backoff
    - Add health check: `PING` command returns PONG
    - Graceful shutdown: `await this.redis.quit()`

    Example structure:
    ```typescript
    @Injectable()
    export class RedisService implements OnModuleDestroy {
      private readonly client: Redis;

      constructor(private readonly config: ConfigService) {
        this.client = new Redis({
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD', undefined),
          retryStrategy: (times) => Math.min(times * 50, 2000),
        });
      }

      getConnection(): Redis {
        return this.client;
      }

      async onModuleDestroy() {
        await this.client.quit();
      }
    }
    ```

    Verify: Service connects to Redis and responds to PING.
  </action>
  <verify>
    <automated>grep -q "getConnection" src/shared/infrastructure/redis.service.ts && grep -q "IORedis" src/shared/infrastructure/redis.service.ts && echo "Redis service structure defined"</automated>
  </verify>
  <done>Redis service ready for BullMQ injection</done>
</task>

<task type="auto">
  <name>Task 5: Create Qdrant service with collection management</name>
  <files>
    src/shared/infrastructure/qdrant.service.ts
  </files>
  <action>
    Create QdrantService with:

    - Client: QdrantClient from '@qdrant/js-client-rest'
    - Config: QDRANT_URL and QDRANT_API_KEY from env
    - Method: `createCollection(tenantId: number): Promise<void>`
      * Collection name: `tenant_${tenantId}`
      * Parameters: vectors.size=3072, distance=Cosine, hnsw_config.m=32, hnsw_config.ef_construct=200
      * Payload fields: tenant_id (integer), document_id (integer), chunk_index (integer), indexed_at (datetime)
    - Method: `upsertVectors(tenantId, documentId, chunks, embeddings)` - as per RESEARCH example
    - Method: `search(tenantId, vector, k, filter?)` - returns SearchResult[] with payload
    - Method: `deleteCollection(tenantId)` - for cleanup
    - Error handling: catch QdrantHTTPError, log with context

    Verify: Methods defined with correct signatures per RESEARCH examples.
  </action>
  <verify>
    <automated>grep -q "createCollection" src/shared/infrastructure/qdrant.service.ts && grep -q "upsertVectors" src/shared/infrastructure/qdrant.service.ts && grep -q "tenant_\${tenantId}" src/shared/infrastructure/qdrant.service.ts && echo "Qdrant service methods defined"</automated>
  </verify>
  <done>Qdrant service with tenant-scoped collection management ready</done>
</task>

<task type="auto">
  <name>Task 6: Create OpenAI service for embeddings</name>
<files>
    src/shared/infrastructure/openai.service.ts
  </files>
  <action>
    Create OpenAIService:

    - Client: OpenAI from 'openai' package, configured with OPENAI_API_KEY
    - Encoding: use js-tiktoken `encoding_for_model('text-embedding-3-large')`
    - Constants: BATCH_SIZE = 100, MAX_TOKENS = 8192
    - Method: `generateEmbeddings(texts: string[]): Promise<number[][]>`
      * Truncate each text to MAX_TOKENS using encoding
      * Batch into BATCH_SIZE chunks
      * Call `this.client.embeddings.create({ model: 'text-embedding-3-large', input: batch })`
      * Add delay between batches to respect rate limits (100ms)
      * Return array of embeddings (3072-dimensional)
    - Error handling: catch OpenAIError (429 rate limit → retry with backoff, per RESEARCH pitfall 6)
    - Log: `logger.debug('Generated ${embeddings.length} embeddings')`

    Verify: Method signature matches RESEARCH example.
  </action>
  <verify>
    <automated>grep -q "generateEmbeddings" src/shared/infrastructure/openai.service.ts && grep -q "text-embedding-3-large" src/shared/infrastructure/openai.service.ts && grep -q "MAX_TOKENS.*8192" src/shared/infrastructure/openai.service.ts && echo "OpenAI service defined"</automated>
  </verify>
  <done>OpenAI service with batching and rate limiting ready</done>
</task>

<task type="auto">
  <name>Task 7: Configure app.module.ts to bootstrap shared modules</name>
  <files>
    src/app/app.module.ts
  </files>
  <action>
    Create main AppModule that imports and configures all shared infrastructure:

    - ConfigModule (from @nestjs/config) with isGlobal: true, envFilePath: '.env'
    - DatabaseModule (for DatabaseService)
    - RedisModule (provides Redis connection)
    - QdrantModule (future: might need token export, but for now just use service)
    - No feature modules yet (AuthModule, DocumentsModule, ChatModule come later)

    AppModule should be minimal: infrastructure bootstrapping only.
    Also create main.ts to bootstrap Nest app: `NestFactory.create(AppModule)` and listen on PORT.

    Verify: AppModule imports all shared modules without circular dependencies.
  </action>
  <verify>
    <automated>grep -q "ConfigModule" src/app/app.module.ts && grep -q "DatabaseModule" src/app/app.module.ts && grep -q "RedisModule" src/app/app.module.ts && grep -q "QdrantModule" src/app/app.module.ts && echo "AppModule exports configured"</automated>
  </verify>
  <done>AppModule sets up global configuration and infrastructure modules</done>
</task>

</tasks>

<verification>
Wave 1 completes infrastructure foundation. Verification flow:

1. **Database readiness**: `npx prisma db push` connects to DATABASE_URL and applies schema; executes RLS policies; verify no errors
2. **RLS enforcement**: Integration test `tests/integration/rls.integration.spec.ts` (created in Plan 01) confirms policies active - verify manually with `psql` query: `SELECT relrowsecurity FROM pg_class WHERE relname = 'users'` returns true
3. **Redis connection**: Simple health check: `node -e "const redis=new (require('ioredis'))(process.env.REDIS_URL); redis.ping().then(console.log)"` responds with PONG
4. **Qdrant collection creation**: Manual test: call `qdrantService.createCollection(1)` succeeds; verify collection exists: `curl http://localhost:6333/collections/tenant_1` returns 200
5. **OpenAI client**: `npx ts-node -e "import { OpenAIService } from './src/shared/infrastructure/openai.service'; new OpenAIService().generateEmbeddings(['test']).then(console.log)"` returns array of 3072-dim vectors (mock OPENAI_API_KEY if needed for test)
6. **AppModule bootstrap**: `npm run start:dev` starts without module resolution errors

**Requirements mapping:**
- TEN-01: RLS policies in migration ✓
- TEN-02: DatabaseService.setTenantContext ensures automatic filtering ✓
- TEN-03: Tenant isolation enforced by RLS and payload filtering in Qdrant ✓
- QUAL-04: Rate limiting service not yet implemented (in Wave 5) - TODO deferred
- QUAL-05: Secrets (API keys, JWT_SECRET) loaded from env, encrypted at rest handled by infra provider (PostgreSQL encryption) - foundation set

**Note:** QUAL-04 (rate limiting) not in Wave 1 - will be implemented in final wave (cross-cutting). QUAL-05 encryption at rest is infrastructure-dependent (PostgreSQL disk encryption), not code - we ensure secrets not in code via env vars.

</verification>

<success_criteria>
Infrastructure ready when:
- [ ] prisma/schema.prisma validated with all models (User, Document, DocumentChunk, Chat, ChatMessage, RefreshToken, PasswordResetToken)
- [ ] Migration SQL contains ENABLE ROW LEVEL SECURITY for 7 tenant-scoped tables
- [ ] DatabaseService.setTenantContext method executes `SET app.current_tenant`
- [ ] RedisService.getConnection() returns connected IORedis instance
- [ ] QdrantService.createCollection creates collection with hnsw_config.m=32 and payload indexes
- [ ] OpenAIService.generateEmbeddings returns number[][] with 3072 dimensions per vector
- [ ] AppModule imports ConfigModule, DatabaseModule, RedisModule, QdrantModule without errors
- [ ] `npx prisma db push` apply schema to database without conflicts
- [ ] RLS policies verified in database: `SELECT relrowsecurity FROM pg_class WHERE relname='users'` → true

**Critical dependencies created:**
- DatabaseModule → required by AuthModule, DocumentsModule, ChatModule
- RedisService → required by BullMQ workers (Plan 04)
- QdrantService → required by DocumentsModule (indexing) and ChatModule (retrieval)
- OpenAIService → required by DocumentsModule (embedding generation)

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-02-PLAN-02-summary.md`
</output>
