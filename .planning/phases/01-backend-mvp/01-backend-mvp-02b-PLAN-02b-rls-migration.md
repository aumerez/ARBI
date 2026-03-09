---
phase: 01-backend-mvp
plan: 02b
type: execute
wave: 5
depends_on:
  - 02a
files_modified:
  - migrations/001-init-schema.sql
autonomous: true
requirements:
  - TEN-01
  - TEN-02
  - TEN-03
user_setup: []
must_haves:
  truths:
    - "SQL migration creates Tenant table BEFORE all other tables to satisfy FK dependencies"
    - "RLS is ENABLEd on all tenant-scoped tables (8 tables)"
    - "CREATE POLICY tenant_isolation exists for each tenant-scoped table"
    - "Policies filter by tenant_id from current_setting('app.current_tenant')"
    - "Application role 'app' created with appropriate privileges"
    - "Migration can be applied with `prisma db push` or `psql` without errors"
  artifacts:
    - path: "migrations/001-init-schema.sql"
      provides: "Complete database setup with schema creation and RLS policies"
      contains:
        - "CREATE TABLE tenants"
        - "CREATE TABLE users"
        - "CREATE TABLE documents"
        - "CREATE TABLE document_chunks"
        - "CREATE TABLE chats"
        - "CREATE TABLE chat_messages"
        - "CREATE TABLE refresh_tokens"
        - "CREATE TABLE password_reset_tokens"
        - "CREATE TABLE audit_logs"
        - "ALTER TABLE ... ENABLE ROW LEVEL SECURITY" (for all 8 tables)
        - "CREATE POLICY tenant_isolation_* ON ... USING (tenant_id = current_setting('app.current_tenant')::integer)"
        - "CREATE ROLE app; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app"
  key_links:
    - from: "migrations/001-init-schema.sql"
      to: "prisma/schema.prisma"
      via: "prisma migrate dev generates this from schema"
      pattern: "prisma migrate dev"
    - from: "migrations/001-init-schema.sql"
      to: "PostgreSQL"
      via: "applies schema and RLS policies"
      pattern: "psql -f migrations/001-init-schema.sql"

---

<objective>
Generate SQL migration with RLS policies and execute against database

Purpose: Create production-ready database schema with proper table creation order (tenants first), row-level security policies on all tenant-scoped tables, and application role with privileges. This migration implements TEN-01 (RLS enforcement).

Output: Applied database schema with RLS active and verified

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

# RLS policy pattern from RESEARCH:
1. Enable RLS: ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
2. Create policy: CREATE POLICY tenant_isolation_table ON table_name USING (tenant_id = current_setting('app.current_tenant')::integer);
3. Apply to all tenant-scoped tables: users, documents, document_chunks, chats, chat_messages, refresh_tokens, password_reset_tokens, audit_logs

# Migration order critical:
- tenants table must exist BEFORE other tables (FK dependency)
- All tables created with FKs referencing tenants.id
- RLS policies created AFTER table creation (cannot create policy on non-existent table)
- App role created with GRANTs

# Tooling:
- Preferred: `npx prisma migrate dev --name init --create-only` generates migration from schema
- Then: Edit generated migration to add RLS policies (Prisma migrations don't auto-generate RLS)
- Manual: Write raw SQL if Prisma migration format insufficient
- Apply: `npx prisma db push` (dev) or `npx prisma migrate deploy` (prod)

</context>

<tasks>

<task type="auto">
  <name>Task 1: Generate initial migration from Prisma schema</name>
  <files>
    migrations/001-init-schema.sql
  </files>
  <action>
    Step 1: Generate migration using Prisma CLI:

    ```bash
    npx prisma migrate dev --name init --create-only
    ```

    This creates a new migration file (timestamped) under prisma/migrations/. The migration contains the basic CREATE TABLE statements derived from schema.prisma with proper FK ordering.

    Step 2: Verify the migration includes Tenant table first (check order of CREATE TABLE statements). If not, manually reorder SQL to ensure tenants created before other tables referencing it.

    Step 3: Edit the migration file to add RLS setup BEFORE data changes (or after, but must be in same transaction):

    ```sql
    -- Enable RLS on all tenant-scoped tables
    ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "DocumentChunk" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "Chat" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "RefreshToken" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "PasswordResetToken" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

    -- Create policies: filter by tenant_id from session context
    CREATE POLICY tenant_isolation_users ON "User"
      USING ("tenant_id" = current_setting('app.current_tenant')::integer);
    CREATE POLICY tenant_isolation_documents ON "Document"
      USING ("tenant_id" = current_setting('app.current_tenant')::integer);
    CREATE POLICY tenant_isolation_document_chunks ON "DocumentChunk"
      USING ("tenant_id" = current_setting('app.current_tenant')::integer);
    CREATE POLICY tenant_isolation_chats ON "Chat"
      USING ("tenant_id" = current_setting('app.current_tenant')::integer);
    CREATE POLICY tenant_isolation_chat_messages ON "ChatMessage"
      USING ("tenant_id" = current_setting('app.current_tenant')::integer);
    CREATE POLICY tenant_isolation_refresh_tokens ON "RefreshToken"
      USING ("tenant_id" = current_setting('app.current_tenant')::integer);
    CREATE POLICY tenant_isolation_password_reset_tokens ON "PasswordResetToken"
      USING ("tenant_id" = current_setting('app.current_tenant')::integer);
    CREATE POLICY tenant_isolation_audit_logs ON "AuditLog"
      USING ("tenant_id" = current_setting('app.current_tenant')::integer);

    -- Create application role (optional but good practice)
    CREATE ROLE IF NOT EXISTS app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app;
    ```

    Note: Table names may be quoted or camelCase depends on Prisma naming strategy. Adjust policy table names to match generated schema. Use exact table names from migration.

    Step 4: Rename migration to `001-init-schema.sql` (if generated name is timestamped, move/rename for consistency). Place in `migrations/` directory at project root.

    Verify: Migration SQL is syntactically valid (can be dry-run with `psql --dry-run` if available) and contains all required RLS statements.
  </action>
  <verify>
    <automated>
      grep -q "CREATE TABLE.*Tenant" migrations/001-init-schema.sql &&
      grep -q "ENABLE ROW LEVEL SECURITY" migrations/001-init-schema.sql &&
      grep -q "CREATE POLICY tenant_isolation_users" migrations/001-init-schema.sql &&
      echo "Migration SQL contains required elements"
    </automated>
  </verify>
  <done>SQL migration generated and enhanced with RLS policies</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Apply migration to test database</name>
  <files>
    (No code files - database operation)
  </files>
  <behavior>
    - Test 1: Migration applies successfully with `npx prisma db push` (no errors)
    - Test 2: Tenant table exists after migration
    - Test 3: RLS policies enabled on all 8 tenant-scoped tables
    - Test 4: Foreign key constraints satisfy: all tables reference tenants.id
  </behavior>
  <action>
    Apply migration to local test database:

    ```bash
    # Ensure DATABASE_URL in .env points to test database
    cp .env.example .env  # if .env doesn't exist
    # Edit .env to set DATABASE_URL to actual test DB (or use default localhost)

    # Apply schema
    npx prisma db push

    # Or use migration if prisma migrate dev (records in _prisma_migrations)
    npx prisma migrate dev --name init
    ```

    After migration, verify RLS policies:

    ```sql
    -- Connect to database with psql
    \c opsai  -- or your DB name

    -- Check RLS enabled on users table
    SELECT relrowsecurity FROM pg_class WHERE relname = 'users';

    -- Should return t (true). Repeat for other tables:
    -- documents, document_chunks, chats, chat_messages, refresh_tokens, password_reset_tokens, audit_logs

    -- List policies
    \dp users
    -- Should show "tenant_isolation_users" policy

    -- Verify Tenant table exists
    \d+ tenants
    -- Should show columns: id, name, plan, created_at, updated_at
    ```

    If RLS not enabled, manually apply:

    ```sql
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    -- repeat for each table
    ```

    However, migration should include all ALTER TABLE statements.

    Verify: Database schema is ready; tables exist; RLS policies present.
  </action>
  <verify>
    <automated>
      node -e "const { PrismaClient } = require('@prisma/client'); const db = new PrismaClient(); db.\$queryRaw\`SELECT relrowsecurity FROM pg_class WHERE relname = 'users'\`.then(r => console.log('RLS on users:', r[0].relrowsecurity)).catch(e => console.error(e))" 2>&1 | grep -q "true" &&
      echo "Database RLS verified on users table"
    </automated>
  </verify>
  <done>Migration applied and RLS verified in database</done>
</task>

</tasks>

<verification>
Wave 1b - RLS migration complete

**Automated verification:**
1. Migration file exists: `migrations/001-init-schema.sql` with CREATE TABLE and RLS statements
2. Migration applies successfully: `npx prisma db push` completes without errors
3. RLS check: SQL query `SELECT relrowsecurity FROM pg_class WHERE relname = 'users'` returns `true`
4. Verify other tables: repeat for documents, chats, etc. (optional but recommended)

**Requirements mapping:**
- TEN-01: RLS policies created and enabled on all 8 tenant-scoped tables ✓
- TEN-02: Database-level tenant filtering enforced via RLS + will be set via middleware (Plan 02c)
- TEN-03: Tenant isolation guaranteed by RLS + FK cascade

**Critical checks:**
- Migration order: tenants table created BEFORE all other tables (satisfies FK)
- All policies reference `current_setting('app.current_tenant')` exactly (case-sensitive)
- Policies created for EACH tenant-scoped table; missing policy = security hole
- OnDelete Cascade on FKs ensures clean tenant deletion

**Rollback:** If migration fails, drop database and recreate: `npx prisma migrate reset` (WARNING: destroys all data)

</verification>

<success_criteria>
RLS migration complete when:
- [ ] migration SQL creates Tenant table first (before tables with FK to it)
- [ ] All 8 tenant-scoped tables have `ENABLE ROW LEVEL SECURITY` statement
- [ ] All 8 tables have `CREATE POLICY tenant_isolation_<table> USING (tenant_id = current_setting('app.current_tenant')::integer)`
- [ ] Migration executes: `npx prisma db push` or `npx prisma migrate dev` succeeds
- [ ] RLS verified: `SELECT relrowsecurity FROM pg_class WHERE relname='users'` returns true
- [ ] Fks with onDelete Cascade present: `SELECT tc.constraint_name FROM information_schema.referential_constraints rc JOIN information_schema.key_column_usage kcu ...` shows cascade

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-02b-PLAN-02b-summary.md`
</output>
