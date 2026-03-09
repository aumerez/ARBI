---
phase: 01-backend-mvp
plan: 06b
type: execute
wave: 19
depends_on:
  - 06a
files_modified:
  - src/shared/database/models/audit-log.model.ts (if using Prisma)
  - src/shared/services/audit-logging.service.ts
  - src/shared/middleware/audit.middleware.ts
  - prisma/schema.prisma
autonomous: true
requirements:
  - QUAL-01
user_setup: []
must_haves:
  truths:
    - "System logs all queries and responses to tenant-scoped audit trail with query details, retrieved sources, response text, timestamps"
    - "AuditLoggingService provides log(eventType, payload) method"
    - "Audit middleware automatically captures incoming requests and outgoing responses (if body size permits)"
  artifacts:
    - path: "prisma/schema.prisma"
      provides: "AuditLog model definition"
      contains:
        - "model AuditLog { id Int @id @default(autoincrement) tenant_id Int @relation(fields: [tenant_id], references: [id], onDelete: Cascade) user_id Int? event_type String payload Jsonb created_at DateTime @default(now()) }"
      min_lines: 10
    - path: "src/shared/services/audit-logging.service.ts"
      provides: "AuditLoggingService for explicit audit events"
      contains:
        - "log(eventType: string, payload: object, userId?: number): Promise<void>"
        - "inject db.prisma.auditLog.create()"
      min_lines: 30
    - path: "src/shared/middleware/audit.middleware.ts"
      provides: "NestJS middleware capturing HTTP request/response audit trails"
      contains:
        - "use(req, res, next): logs { method, path, query, tenant_id from context, user_id from JWT, status, duration, response_size }"
        - "Optionally capture request/response bodies for chat queries (configurable)"
      min_lines: 50
  key_links:
    - from: "src/shared/middleware/audit.middleware.ts"
      to: "src/shared/services/audit-logging.service.ts"
      via: "auditService.log()"
      pattern: "auditService\\.log"
    - from: "src/shared/services/audit-logging.service.ts"
      to: "src/shared/database/database.service.ts"
      via: "db.prisma.auditLog.create()"
      pattern: "auditLog\\.create"
    - from: "prisma/schema.prisma"
      to: "database"
      via: "prisma migrate dev"
      pattern: "model AuditLog"

---

<objective>
Implement audit logging service and middleware

Purpose: Provide immutable, tenant-scoped audit trail for compliance and debugging.

Output: AuditLog model in Prisma, AuditLoggingService, and HTTP middleware that logs all API activity
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
  <name>Task 1: Add AuditLog model to Prisma schema</name>
  <files>
    prisma/schema.prisma
  </files>
  <behavior>
    - Test 1: Model includes required fields: id, tenant_id, user_id?, event_type, payload, created_at
    - Test 2: Relations: tenant_id references Tenant.id with onDelete Cascade
    - Test 3: Index on (tenant_id, created_at) for query performance
    - Test 4: Schema validates with `prisma validate`
  </behavior>
  <action>
    Add to prisma/schema.prisma after Tenant model:
    model AuditLog {
      id        Int      @id @default(autoincrement)
      tenant_id  Int
      user_id   Int?
      event_type String
      payload   Json
      created_at DateTime @default(now())

      tenant Tenant @relation(fields: [tenant_id], references: [id], onDelete: Cascade)

      @@index([tenant_id, created_at], name: "idx_audit_log_tenant_created")
      @@index([event_type], name: "idx_audit_log_event")
    }
    Run `prisma validate` to check syntax.
  </action>
  <verify>
    <automated>grep -q "model AuditLog" prisma/schema.prisma && grep -q "tenant_id" prisma/schema.prisma && echo "AuditLog model added"</automated>
  </verify>
  <done>AuditLog model defined in Prisma schema</done>
</task>

<task type="auto">
  <name>Task 2: Implement AuditLoggingService</name>
  <files>
    src/shared/services/audit-logging.service.ts
  </files>
  <action>
    Create AuditLoggingService that wraps database access:
    - Inject DatabaseService (or PrismaService)
    - Method: async log(event_type: string, payload: object, userId?: number): Promise<void>
      * Get current tenant from DatabaseService.getCurrentTenant() or similar context
      * Create record: { tenant_id: currentTenantId, user_id: userId, event_type, payload, created_at: new Date() }
    - Error handling: if audit fails, log to console but don't throw (audit should never break main flow)
    - Logger: debug logging
    Example:
    ```typescript
    @Injectable()
    export class AuditLoggingService {
      constructor(private readonly db: DatabaseService) {}
      async log(event_type: string, payload: Record<string, any>, userId?: number) {
        const tenantId = await this.db.getCurrentTenant(); // or from TenantContextService
        await this.db.prisma.auditLog.create({
          data: { tenant_id: tenantId, user_id, event_type, payload: payload as any, created_at: new Date() }
        });
      }
    }
    ```
  </action>
  <verify>
    <automated>grep -q "log.*event_type" src/shared/services/audit-logging.service.ts && grep -q "prisma.*auditLog" src/shared/services/audit-logging.service.ts && echo "AuditLoggingService implemented"</automated>
  </verify>
  <done>AuditLoggingService ready</done>
</task>

<task type="auto">
  <name>Task 3: Create audit middleware</name>
  <files>
    src/shared/middleware/audit.middleware.ts
  </files>
  <action>
    Create NestJS middleware (or interceptor) to automatically log HTTP requests/responses:
    - Implement `NestMiddleware` or `Interceptor` (interceptor can access response body)
    - Capture: request method, path, query; user_id from JWT (if authenticated); tenant_id from context; response status; duration; response size
    - For chat endpoints (configurable), capture request body query and response snippets (up to 1KB) for traceability
    - Use AuditLoggingService.log('http.request', payload) on response finish
    - Handle errors: try/catch so audit failures don't propagate
    - Register as global middleware in AppModule after this plan
  </action>
  <verify>
    <automated>grep -q "class AuditMiddleware" src/shared/middleware/audit.middleware.ts && grep -q "res\\.on('finish'" src/shared/middleware/audit.middleware.ts && echo "Audit middleware implemented"</automated>
  </verify>
  <done>Audit middleware logs HTTP traffic</done>
</task>

</tasks>

<verification>
Wave 5b implements audit logging.
Verify:
1. Migration applied: `npx prisma migrate dev` adds AuditLog table
2. Service unit test: mock AuditLoggingService.log() and verify it calls db.prisma.auditLog.create()
3. Middleware test: simulate HTTP request, verify log called with correct event_type='http.request' and payload contains method, path, status
4. RLS policy on audit_log ensures tenant isolation: `SELECT * FROM audit_log WHERE tenant_id = 1` returns only that tenant's rows
</verification>

<success_criteria>
Audit logging operational when:
- [ ] AuditLog model in Prisma schema and migrated to DB
- [ ] AuditLoggingService.log() method works without errors
- [ ] Audit middleware captures HTTP requests and writes audit records
- [ ] RLS policy enforces tenant isolation on audit_log
- [ ] Unit tests for service and middleware pass
</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-06b-summary.md`