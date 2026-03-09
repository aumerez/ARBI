---
phase: 01-backend-mvp
plan: 06a
type: execute
wave: 18
depends_on:
  - 04e
  - 05e
files_modified:
  - src/shared/infrastructure/encryption.service.ts
  - prisma/migrations/002-add-audit-tables.sql
autonomous: true
requirements:
  - QUAL-05
user_setup: []
must_haves:
  truths:
    - "Sensitive data (API keys, JWT secrets) encrypted at rest using AES-256-GCM"
    - "Encryption service provides encrypt/decrypt methods with key derivation from ENCRYPTION_KEY"
    - "Audit_log table exists with tenant_id, user_id, event_type, payload, created_at"
  artifacts:
    - path: "src/shared/infrastructure/encryption.service.ts"
      provides: "Encryption service for sensitive data at rest"
      contains:
        - "encrypt(plaintext: string): Promise<string>"
        - "decrypt(ciphertext: string): Promise<string>"
        - "key derivation from ENCRYPTION_KEY env var using crypto.scrypt"
      min_lines: 40
    - path: "prisma/migrations/002-add-audit-tables.sql"
      provides: "SQL migration adding audit_log table with tenant partitioning"
      contains:
        - "CREATE TABLE audit_log (id, tenant_id, user_id, event_type, payload JSONB, created_at)"
        - "CREATE INDEX audit_log_tenant_idx ON audit_log(tenant_id)"
        - "ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY"
        - "CREATE POLICY audit_log_tenant_isolation ON audit_log USING (tenant_id = current_setting('app.current_tenant')::integer)"
      min_lines: 30
  key_links:
    - from: "encryption.service.ts"
      to: "environment variables"
      via: "ENCRYPTION_KEY derivation"
      pattern: "crypto.scrypt"
    - from: "migrations/002-add-audit-tables.sql"
      to: "prisma/schema.prisma"
      via: "model AuditLog will be added to schema after this migration"
      pattern: "model AuditLog"

---

<objective>
Create encryption service and database audit tables

Purpose: Protect sensitive data at rest and establish audit logging foundation for compliance.

Output: Encryption service with AES-256-GCM, database migration for audit_log table with RLS
</objective>

<execution_context>
@/Users/franciscoegloff/.claude/get-shit-done/workflows/execute-plan.md
@/Users/franciscoegloff/.claude/get-shit-done/templates/summary.md
</context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-backend-mvp/01-CONTEXT.md
@.planning/phases/01-backend-mvp/01-RESEARCH.md

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement EncryptionService</name>
  <files>
    src/shared/infrastructure/encryption.service.ts
  </files>
  <behavior>
    - Test 1: Service encrypts and decrypts correctly: round-trip returns original
    - Test 2: Different plaintexts produce different ciphertexts (IV randomization)
    - Test 3: Decrypting with wrong key throws error
    - Test 4: Key derivation from ENCRYPTION_KEY env var works (test with dummy key)
  </behavior>
  <action>
    Create EncryptionService using Node's crypto module:
    - Use AES-256-GCM algorithm
    - Generate random 96-bit IV for each encryption
    - Derive encryption key from ENCRYPTION_KEY env var using crypto.scryptSync (or async version)
    - Methods: encrypt(plaintext: string): Promise<string> returns base64 encoded {iv, authTag, ciphertext}
                   decrypt(ciphertext: string): Promise<string> validates auth tag
    - Handle errors: invalid key, corrupted data
    - Logger: log encryption operations at debug level
  </action>
  <verify>
    <automated>grep -q "createDecipheriv" src/shared/infrastructure/encryption.service.ts && grep -q "scrypt" src/shared/infrastructure/encryption.service.ts && echo "Encryption service structure present"</automated>
  </verify>
  <done>EncryptionService implemented with AES-256-GCM and key derivation</done>
</task>

<task type="auto">
  <name>Task 2: Create audit_log table migration</name>
  <files>
    prisma/migrations/002-add-audit-tables.sql
  </files>
  <action>
    Write SQL migration to add audit_log table:
    - Table columns: id (bigserial PK), tenant_id (integer, not null), user_id (integer, maybe null for system events), event_type (varchar(100)), payload (jsonb), created_at (timestamptz)
    - Enable RLS: ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
    - Create policy: tenant isolation using tenant_id = current_setting('app.current_tenant')::integer
    - Indexes: idx_audit_log_tenant_created on (tenant_id, created_at DESC), idx_audit_log_event on (event_type)
    - Migration should be idempotent: check if table exists before creating
    - Also add AuditLog model to Prisma schema later (in separate task or same)
  </action>
  <verify>
    <automated>grep -q "CREATE TABLE audit_log" prisma/migrations/002-add-audit-tables.sql && grep -q "ENABLE ROW LEVEL SECURITY" prisma/migrations/002-add-audit-tables.sql && echo "Audit log migration defined"</automated>
  </verify>
  <done>Migration creates audit_log table with RLS</done>
</task>

</tasks>

<verification>
Wave 5a completes encryption foundation and audit table creation.
Verification:
1. `npx prisma db execute --stdin < prisma/migrations/002-add-audit-tables.sql` runs without error
2. Table exists: `\dt audit_log` in psql shows table with RLS enabled
3. EncryptionService unit tests pass (created in Task 1)
4. Migration includes tenant_id foreign key to tenants table (ensure tenant exists)

Note: Prisma model for AuditLog will be added in a later wave (maybe 06b) to keep schema changes atomic.
</verification>

<success_criteria>
Encryption and audit infrastructure ready when:
- [ ] EncryptionService implemented with encrypt/decrypt methods
- [ ] Audit log table created in database with RLS policy
- [ ] Migration file validated and executable via prisma migrate
- [ ] Unit tests for EncryptionService pass (round-trip, key derivation)
- [ ] `SELECT relrowsecurity FROM pg_class WHERE relname='audit_log'` returns true
</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-06a-summary.md`
</output>