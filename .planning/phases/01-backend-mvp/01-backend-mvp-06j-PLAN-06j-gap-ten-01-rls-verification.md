---
phase: 01-backend-mvp
plan: 06j
subsystem: gap-ten-01-rls-verification
tags:
  - gap-closure
  - multi-tenancy
  - rls
  - security
depends_on:
  - 06e
files_modified:
  - prisma/migrations/002-add-fulltext-documentchunk.sql (if needed)
  - src/shared/database/database.service.ts
  - scripts/verify-rls.sql
autonomous: true
requirements:
  - TEN-01
user_setup: []
must_haves:
  truths:
    - "RLS policies enabled on all 8 tenant-scoped tables (User, Document, DocumentChunk, Chat, ChatMessage, RefreshToken, PasswordResetToken, AuditLog)"
    - "Each table has ROW SECURITY POLICY that restricts access to tenant_id = current_setting('app.current_tenant')"
    - "Databaseconnection sets app.current_tenant on every query (via DatabaseService)"
    - "Migration 001 shows RLS enablement; database actually has RLS active"
  artifacts:
    - path: "prisma/migrations/001-init-schema.sql"
      provides: "Initial schema with RLS policies"
      contains:
        - "ALTER TABLE ... ENABLE ROW LEVEL SECURITY on all 8 tenant-scoped tables"
        - "CREATE POLICY tenant_isolation_policy ON ... USING (tenant_id = current_setting('app.current_tenant')::UUID)"
      min_lines: 50 (verify existing)
    - path: "src/shared/database/database.service.ts"
      provides: "Tenant context management"
      contains:
        - "setTenantContext(tenantId): executes SET app.current_tenant = $1"
        - "getCurrentTenant(): returns current_setting('app.current_tenant')"
      min_lines: 20 (verify existing)
    - path: "scripts/verify-rls.sql"
      provides: "Verification script to check RLS status"
      contains:
        - "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename IN ('User', 'Document', ...)"
        - "SELECT * FROM pg_policies WHERE policyname LIKE '%tenant%'"
      min_lines: 30
  key_links:
    - from: "DatabaseService"
      to: "RLS enforcement"
      via: "SET app.current_tenant"
      pattern: "setTenantContext"
    - from: "Prisma migration"
      to: "RLS policies"
      pattern: "ROW LEVEL SECURITY"
    - from: "Verification script"
      to: "pg_policies"
      pattern: "pg_policies"
---

<objective>
Verify and ensure RLS policies are applied to all tenant-scoped tables (TEN-01)

Purpose: Guarantee database-level multi-tenancy isolation; defense-in-depth security.

Output: Confirmed RLS enabled on all 8 tables, policies active, tenant context set correctly
</objective>

<execution_context>
@/Users/franciscoegloff/.claude/get-shit-done/workflows/execute-plan.md
@/Users/franciscoegloff/.claude/get-shit-done/templates/summary.md
</execution_context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-backend-mvp/01-CONTEXT.md
@.planning/phases/01-backend-mvp/01-RESEARCH.md

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Verify RLS is enabled on all tenant-scoped tables</name>
  <files>
    scripts/verify-rls.sql
    prisma/migrations/001-init-schema.sql
  </files>
  <behavior>
    - Output: List of 8 tables with rowsecurity = true
    - Policy count: at least 8 tenant_isolation policies visible
  </behavior>
  <action>
    Create verification script: SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename IN ('User', 'Document', 'DocumentChunk', 'Chat', 'ChatMessage', 'RefreshToken', 'PasswordResetToken', 'AuditLog'); SELECT * FROM pg_policies WHERE polname LIKE '%tenant%'. Document results. If any table missing RLS, write migration fix or manual SQL to enable.
  </action>
  <verify>
    <automated>
      test -f scripts/verify-rls.sql && grep -q "rowsecurity" scripts/verify-rls.sql &&
      echo "RLS verification script exists"
    </automated>
  </verify>
  <done>RLS verification script created</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Ensure DatabaseService sets tenant context on every request</name>
  <files>
    src/shared/database/database.service.ts
  </files>
  <behavior>
    - Test 1: setTenantContext(tenantId) executes "SET app.current_tenant = $1"
    - Test 2: getCurrentTenant() returns current_setting('app.current_tenant')
    - Test 3: Context cleared on connection release/reset
  </behavior>
  <action>
    Verify DatabaseService has setTenantContext and getCurrentTenant methods. Check they use $queryRaw to execute SET. Confirm TenantValidationMiddleware calls setTenantContext on valid tenant. If missing, implement.
  </action>
  <verify>
    <automated>
      grep -q "setTenantContext" src/shared/database/database.service.ts &&
      grep -q "current_setting" src/shared/database/database.service.ts &&
      echo "Tenant context management present"
    </automated>
  </verify>
  <done>DatabaseService tenant context confirmed</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Fix any missing RLS policies via migration if needed</name>
  <files>
    prisma/migrations/003-fix-rls-policies.sql (if needed)
  </files>
  <behavior>
    - If verification (Task 1) shows missing RLS: create migration that runs ALTER TABLE ... ENABLE ROW LEVEL SECURITY and CREATE POLICY for each missing table.
  </behavior>
  <action>
    If any table lacks RLS, create a new Prisma migration `003-fix-rls-policies` that adds missing RLS enablement and policies. Apply with `npx prisma migrate dev`. If all present, skip.
  </action>
  <verify>
    <automated>
      if [ -f "prisma/migrations/003-fix-rls-policies.sql" ]; then echo "RLS fix migration created"; else echo "No fix needed"; fi
    </automated>
  </verify>
  <done>RLS policies verified and fixed if needed</done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Document RLS verification procedure</name>
  <files>
    .planning/phases/01-backend-mvp/01-backend-mvp-06j-summary.md
  </files>
  <behavior>
    - Summary documents: tables with RLS status, policy definitions, tenant context flow
  </behavior>
  <action>
    In summary, record: which tables have RLS, policies content, verification steps, and confirmation that all 8 tables are secured. Include manual verification instructions: `psql -c "\d+ User"` to check RLS, `SELECT * FROM pg_policies` to see policies.
  </action>
  <verify>
    <automated>
      grep -q "RLS" .planning/phases/01-backend-mvp/01-backend-mvp-06j-summary.md &&
      echo "RLS status documented"
    </automated>
  </verify>
  <done>RLS verification documented in summary</done>
</task>

</tasks>

<verification>
Wave 6j closes TEN-01 RLS gap.
Verify:
1. Script output confirms rowsecurity=TRUE on all 8 tenant-scoped tables
2. pg_policies shows at least 8 policies with USING (tenant_id = current_setting('app.current_tenant'))
3. DatabaseService.setTenantContext() is called on each request (via middleware)
4. Documentation of verification steps complete
</verification>

<success_criteria>
TEN-01 complete when:
- [ ] All 8 tables have RLS enabled
- [ ] All have tenant isolation policies active
- [ ] DatabaseService manages tenant context setting
- [ ] Verification procedure documented
- [ ] No schema drift (if any, fixed via migration)
</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-06j-summary.md`

</output>
