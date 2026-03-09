---
phase: 01-backend-mvp
plan: 02a
type: execute
wave: 4
depends_on:
  - 01d
files_modified:
  - prisma/schema.prisma
  - src/shared/types/providers.interface.ts
autonomous: true
requirements:
  - TEN-01
  - TEN-02
  - TEN-03
user_setup: []
must_haves:
  truths:
    - "Prisma schema includes Tenant model with id, name, plan, timestamps"
    - "All tenant-scoped tables have tenant_id integer foreign key to tenants.id with onDelete Cascade"
    - "Indexes on tenant_id exist for all tenant-scoped tables"
    - "Abstract EmbeddingProvider and LLMProvider interfaces defined"
    - "Provider selection configuration (EMBEDDING_PROVIDER, LLM_PROVIDER) documented"
    - "Schema validates successfully with `prisma validate`"
  artifacts:
    - path: "prisma/schema.prisma"
      provides: "Complete database schema with Tenant model and tenant-aware tables"
      contains:
        - "model Tenant { id Int @id @default(autoincrement) name String plan String? created_at DateTime @default(now()) updated_at DateTime @updatedAt }"
        - "model User { tenant_id Int @relation(fields: [tenant_id], references: [id], onDelete: Cascade) }"
        - "model Document { tenant_id Int @relation(fields: [tenant_id], references: [id], onDelete: Cascade) }"
        - "model Chat { tenant_id Int @relation(fields: [tenant_id], references: [id], onDelete: Cascade) }"
        - "model ChatMessage { tenant_id Int @relation(fields: [tenant_id], references: [id], onDelete: Cascade) }"
        - "model DocumentChunk { tenant_id Int @relation(fields: [tenant_id], references: [id], onDelete: Cascade) }"
        - "model RefreshToken { tenant_id Int @relation(fields: [tenant_id], references: [id], onDelete: Cascade) }"
        - "model PasswordResetToken { tenant_id Int @relation(fields: [tenant_id], references: [id], onDelete: Cascade) }"
        - "model AuditLog { tenant_id Int @relation(fields: [tenant_id], references: [id], onDelete: Cascade) }"
      min_lines: 100
    - path: "src/shared/types/providers.interface.ts"
      provides: "Abstract interfaces for embedding and LLM providers"
      contains:
        - "export interface EmbeddingProvider { generateEmbeddings(texts: string[]): Promise<number[][]> }"
        - "export interface LLMProvider { streamChat(messages, context): AsyncIterable<StreamChunk> }"
  key_links:
    - from: "prisma/schema.prisma"
      to: "migrations/001-init-schema.sql"
      via: "prisma migrate dev --create-only"
      pattern: "prisma migrate dev"
    - from: "prisma/schema.prisma"
      to: "all dependent services"
      via: "PrismaClient generates typed models"
      pattern: "prisma generate"
    - from: "src/shared/types/providers.interface.ts"
      to: "infrastructure providers (OpenAI, Local, Claude, LocalLLM)"
      via: "implements EmbeddingProvider/LLMProvider"
      pattern: "implements.*EmbeddingProvider"

---

<objective>
Design database schema with Tenant model and create provider abstraction interfaces

Purpose: Establish multi-tenancy foundation with proper foreign key constraints and cascading deletes. Define abstract provider interfaces to support both cloud (OpenAI/Anthropic) and local (Ollama) model backends.

Output: Validated Prisma schema with Tenant table, FK constraints, indexes, and provider interfaces

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

# Tenant table architecture (from revision requirements):
- Tenant model: id (Int, PK), name (String), plan (String?), created_at, updated_at
- All tenant-scoped tables must have tenant_id integer FK to tenants.id with onDelete Cascade
- This allows cascade delete when tenant is removed
- Tables: User, Document, DocumentChunk, Chat, ChatMessage, RefreshToken, PasswordResetToken, AuditLog

# Provider abstraction (from revision requirements):
- Need to support both cloud and local providers
- EmbeddingProvider interface: generateEmbeddings(texts: string[]): Promise<number[][]>
- LLMProvider interface: streamChat(messages, context): AsyncIterable<StreamChunk>
- Config vars: EMBEDDING_PROVIDER (openai|local), LLM_PROVIDER (anthropic|local)
- Local embedding: Ollama nomic-embed-text (or sentence-transformers via API)
- Local LLM: Ollama llama2/codellama
- Default to local for MVP but allow override via env

# Schema considerations:
- Tenant FK must be NOT NULL on all tenant-scoped tables
- Add @@index([tenant_id]) on each table for query performance
- Existing models from Plan 01 (original) need to be updated with proper FK relations
- Migration order: create tenants table FIRST, then other tables to satisfy FK dependencies

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Update schema with Tenant model and FK constraints</name>
  <files>
    prisma/schema.prisma
  </files>
  <behavior>
    - Test 1: Schema includes model Tenant with required fields
    - Test 2: All tenant-scoped tables have tenant_id field (Int, not null)
    - Test 3: All tenant_id fields have @relation to tenants.id with onDelete Cascade
    - Test 4: Tenant-scoped tables: User, Document, DocumentChunk, Chat, ChatMessage, RefreshToken, PasswordResetToken, AuditLog
    - Test 5: @@index on tenant_id exists for each tenant-scoped table
    - Test 6: Unique constraint on User.email remains
    - Test 7: Schema validates without errors
  </behavior>
  <action>
    Create prisma/schema.prisma with complete model definitions:

    ```prisma
    generator client {
      provider = "prisma-client-js"
    }

    datasource db {
      provider = "postgresql"
      url      = env("DATABASE_URL")
    }

    model Tenant {
      id           Int            @id @default(autoincrement())
      name         String
      plan         String?        // e.g., "basic", "enterprise"
      created_at   DateTime       @default(now())
      updated_at   DateTime       @updatedAt

      users        User[]
      documents    Document[]
      chats        Chat[]
      chatMessages ChatMessage[]
      documentChunks DocumentChunk[]
      refreshTokens RefreshToken[]
      passwordResetTokens PasswordResetToken[]
      auditLogs    AuditLog[]
    }

    model User {
      id               Int            @id @default(autoincrement())
      email            String         @unique
      password_hash    String
      tenant_id        Int
      email_verified   Boolean        @default(false)
      created_at       DateTime       @default(now())
      updated_at       DateTime       @updatedAt

      tenant           Tenant         @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
      documents        Document[]
      chats            Chat[]
      refreshTokens    RefreshToken[]
    }

    model Document {
      id               Int            @id @default(autoincrement())
      tenant_id        Int
      user_id          Int            // uploader
      filename         String
      mimetype         String
      size             Int            // bytes
      status           DocumentStatus @default(queued)
      error_message    String?
      created_at       DateTime       @default(now())
      updated_at       DateTime       @updatedAt

      tenant           Tenant         @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
      user             User           @relation(fields: [user_id], references: [id])
      chunks           DocumentChunk[]

      @@index([tenant_id])
      @@index([user_id])
      @@index([status])
    }

    enum DocumentStatus {
      queued
      processing
      indexed
      error
    }

    model DocumentChunk {
      id               Int            @id @default(autoincrement())
      tenant_id        Int
      document_id      Int
      chunk_index      Int
      content          String         // max 65535 chars? adjust
      token_count      Int
      created_at       DateTime       @default(now())

      tenant           Tenant         @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
      document         Document       @relation(fields: [document_id], references: [id], onDelete: Cascade)

      @@index([tenant_id])
      @@index([document_id])
    }

    model Chat {
      id               Int            @id @default(autoincrement())
      tenant_id        Int
      user_id          Int
      title            String?
      created_at       DateTime       @default(now())
      updated_at       DateTime       @updatedAt

      tenant           Tenant         @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
      user             User           @relation(fields: [user_id], references: [id])
      messages         ChatMessage[]

      @@index([tenant_id])
      @@index([user_id])
    }

    model ChatMessage {
      id                Int            @id @default(autoincrement())
      tenant_id         Int
      chat_id           Int
      role              ChatRole
      content           String         // @db.Text? for long text
      citations         Json?          // array of { number, documentId, page? }
      retrieved_chunk_ids Json?       // array of chunk IDs
      created_at        DateTime       @default(now())

      tenant            Tenant         @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
      chat              Chat           @relation(fields: [chat_id], references: [id], onDelete: Cascade)

      @@index([tenant_id])
      @@index([chat_id])
    }

    enum ChatRole {
      user
      assistant
    }

    model RefreshToken {
      id               Int            @id @default(autoincrement())
      tenant_id        Int
      user_id          Int
      token_hash       String         @unique
      expires_at       DateTime
      revoked          Boolean        @default(false)
      created_at       DateTime       @default(now())

      tenant           Tenant         @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
      user             User           @relation(fields: [user_id], references: [id], onDelete: Cascade)

      @@index([tenant_id])
      @@index([user_id])
      @@index([token_hash])
    }

    model PasswordResetToken {
      id               Int            @id @default(autoincrement())
      tenant_id        Int
      user_id          Int
      token_hash       String
      expires_at       DateTime
      used             Boolean        @default(false)
      created_at       DateTime       @default(now())

      tenant           Tenant         @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
      user             User           @relation(fields: [user_id], references: [id], onDelete: Cascade)

      @@index([tenant_id])
      @@index([user_id])
      @@index([token_hash])
    }

    model AuditLog {
      id               BigInt         @id @default(autoincrement())
      tenant_id        Int
      user_id          Int?
      event_type       String
      payload          Json
      ip_address       String?
      user_agent       String?
      created_at       DateTime       @default(now())

      tenant           Tenant         @relation(fields: [tenant_id], references: [id], onDelete: Cascade)

      @@index([tenant_id])
      @@index([user_id])
      @@index([created_at])
    }
    ```

    Important: Ensure all `tenant_id` fields are NOT NULL (no optional) because every record must belong to a tenant.

    Verify: Run `npx prisma validate` to confirm schema correctness.
  </action>
  <verify>
    <automated>npx prisma validate && echo "Prisma schema valid"</automated>
  </verify>
  <done>Prisma schema with Tenant model and FK constraints defined</done>
</task>

<task type="auto">
  <name>Task 2: Create provider abstraction interfaces</name>
  <files>
    src/shared/types/providers.interface.ts
  </files>
  <action>
    Create src/shared/types/providers.interface.ts:

    ```typescript
    export interface EmbeddingProvider {
      /**
       * Generate embeddings for multiple text inputs
       * @param texts Array of text strings to embed
       * @returns Promise resolving to array of embedding vectors (number[])
       */
      generateEmbeddings(texts: string[]): Promise<number[][]>;
    }

    export interface LLMProvider {
      /**
       * Stream chat completions from LLM
       * @param messages Chat history with role and content
       * @param context Retrieved document chunks for grounding
       * @returns AsyncIterable yielding StreamChunk events
       */
      streamChat(
        messages: { role: 'user' | 'assistant'; content: string }[],
        context: RetrievedChunk[]
      ): AsyncIterable<StreamChunk>;
    }

    export interface StreamChunk {
      type: 'text' | 'done' | 'error';
      text?: string;
      citations?: Citation[];
      error?: string;
    }

    export interface RetrievedChunk {
      id: string;
      content: string;
      documentName: string;
      pageNumber?: number;
      score: number;
    }

    export interface Citation {
      number: number;
      documentId: number;
      page?: number;
    }

    // Configuration types
    export interface ProviderConfig {
      embeddingProvider: 'openai' | 'local';
      llmProvider: 'anthropic' | 'local';
    }
    ```

    Verify: Interface file compiles without errors; exports defined.
  </action>
  <verify>
    <automated>npx tsc --noEmit src/shared/types/providers.interface.ts 2>&1 | grep -q "error" && echo "TypeScript errors" || echo "Provider interfaces valid"</automated>
  </verify>
  <done>EmbeddingProvider and LLMProvider interfaces defined</done>
</task>

</tasks>

<verification>
Wave 1a - Schema and abstraction complete

**Automated verification:**
1. Schema validation: `npx prisma validate` succeeds with no errors
2. Schema contains Tenant model with FKs to all tenant-scoped tables
3. All tenant-scoped tables have `tenant_id Int` field with `@relation` to tenants.id and `onDelete: Cascade`
4. All tenant-scoped tables have `@@index([tenant_id])`
5. Provider interfaces file exists and compiles: `npx tsc --noEmit src/shared/types/providers.interface.ts`

**Requirements coverage:**
- TEN-01: RLS policies will be created in migration (next plan 02b)
- TEN-02: tenant_id FKs with cascade ensure automatic filtering at DB level
- TEN-03: Tenant isolation enforced via FKs and RLS (policy creation in 02b)

**Critical checks:**
- Tenant table created FIRST (migration order matters for FK references)
- All FKs use `onDelete: Cascade` so deleting tenant cleans up all data
- No nullable tenant_id fields (every record must belong to a tenant)
- Provider abstraction supports both cloud and local backends as required

</verification>

<success_criteria>
Schema design complete when:
- [ ] prisma/schema.prisma includes Tenant model
- [ ] All 8 tenant-scoped tables (User, Document, DocumentChunk, Chat, ChatMessage, RefreshToken, PasswordResetToken, AuditLog) have tenant_id with FK to tenants.id
- [ ] All FKs specify `onDelete: Cascade`
- [ ] All tenant-scoped tables have `@@index([tenant_id])`
- [ ] Schema passes `npx prisma validate`
- [ ] src/shared/types/providers.interface.ts exists with EmbeddingProvider, LLMProvider, StreamChunk, RetrievedChunk interfaces
- [ ] Provider config type defines embeddingProvider and llmProvider options

**Note:** Migration SQL with RLS policies will be created in Plan 02b.

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-02a-PLAN-02a-summary.md`
</output>
