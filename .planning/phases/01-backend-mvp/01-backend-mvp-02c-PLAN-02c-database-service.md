---
phase: 01-backend-mvp
plan: 02c
type: execute
wave: 6
depends_on:
  - 02b
files_modified:
  - src/shared/database/database.module.ts
  - src/shared/database/database.service.ts
autonomous: true
requirements:
  - TEN-01
  - TEN-02
  - TEN-03
user_setup: []
must_haves:
  truths:
    - "DatabaseModule provides PrismaService (or DatabaseService) as singleton"
    - "DatabaseService has method setTenantContext(tenantId: number): Promise<void>"
    - "DatabaseService has method clearTenantContext(): Promise<void>"
    - "setTenantContext executes `SET app.current_tenant = $1` via raw query"
    - "DatabaseService is injectable across NestJS modules"
    - "Module exports DatabaseService for use by feature modules"
  artifacts:
    - path: "src/shared/database/database.module.ts"
      provides: "NestJS module configuring database provider"
      min_lines: 10
    - path: "src/shared/database/database.service.ts"
      provides: "Database service with tenant context management"
      min_lines: 30
      exports:
        - "setTenantContext(tenantId: number): Promise<void>"
        - "clearTenantContext(): Promise<void>"
        - "prisma: PrismaClient instance"
  key_links:
    - from: "src/shared/database/database.service.ts"
      to: "PostgreSQL RLS"
      via: "SET app.current_tenant"
      pattern: "SET app.current_tenant"
    - from: "src/auth/middleware/tenant-context.middleware.ts"
      to: "DatabaseService.setTenantContext"
      via: "middleware calls setTenantContext after JWT validation"
      pattern: "setTenantContext"
    - from: "src/shared/database/database.module.ts"
      to: "PrismaModule (or PrismaService)"
      via: "imports PrismaModule or extends PrismaService"
      pattern: "PrismaModule"

---

<objective>
Create DatabaseModule and DatabaseService for tenant context management

Purpose: Provide NestJS module that exposes database connection and methods to set PostgreSQL session context (`SET app.current_tenant`) for RLS enforcement. This service is critical for TEN-02 (automatic tenant filtering).

Output: Working database module/service with setTenantContext() and clearTenantContext() methods

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

# Database service requirements:
- Set tenant context from tenant_id extracted from JWT
- Use raw query: `SET app.current_tenant = $1` to configure PostgreSQL session variable
- Execute this BEFORE any DB query in request lifecycle (via middleware after JWT validation)
- Provide PrismaClient instance for type-safe queries
- Support clearTenantContext to reset session after request (optional but good practice)
- Provider type: DATABASE_URL from env (managed by ConfigModule)

# NestJS integration patterns:
Option A: Extend PrismaService from @prisma/nestjs
Option B: Create wrapper service that injects PrismaClient directly
Both acceptable as long as setTenantContext method exists.

# Middleware order:
JwtAuthGuard → TenantContextGuard → DatabaseService.setTenantContext() → allow request to proceed

DatabaseService.setTenantContext will be called in TenantContextMiddleware (Plan 03).

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create DatabaseModule</name>
  <files>
    src/shared/database/database.module.ts
  </files>
  <behavior>
    - Test 1: DatabaseModule imports PrismaModule (if using @prisma/nestjs) OR provides DatabaseService
    - Test 2: DatabaseService is provided as singleton
    - Test 3: Module exports DatabaseService for injection by feature modules
    - Test 4: No circular dependencies with other modules
  </behavior>
  <action>
    Create src/shared/database/database.module.ts:

    Option A (using @prisma/nestjs):
    ```typescript
    import { Global, Module } from '@nestjs/common';
    import { PrismaModule } from '@prisma/nestjs';

    @Global()
    @Module({
      imports: [PrismaModule],
      exports: [PrismaModule],
    })
    export class DatabaseModule {}
    ```

    Option B (custom DatabaseService):
    ```typescript
    import { Global, Module } from '@nestjs/common';
    import { DatabaseService } from './database.service';

    @Global()
    @Module({
      providers: [DatabaseService],
      exports: [DatabaseService],
    })
    export class DatabaseModule {}
    ```

    For Phase 1, using PrismaModule from @prisma/nestjs is simplest. It provides PrismaService as global singleton that can be injected directly.

    However, we need setTenantContext method. We can extend PrismaService:

    In database.service.ts we'll create a wrapper that extends PrismaService.

    DatabaseModule can just export PrismaModule globally, OR provide custom DatabaseService.

    Let's go with custom DatabaseService that extends PrismaService for clarity.

    Actually simpler: DatabaseModule imports PrismaModule, and we create a separate DatabaseService that injects PrismaService and adds setTenantContext method.

    Verify: Module structure follows NestJS best practices; DatabaseService (or PrismaService) can be injected elsewhere.
  </action>
  <verify>
    <automated>grep -q "@Global" src/shared/database/database.module.ts && grep -q "exports:" src/shared/database/database.module.ts && echo "DatabaseModule defined as global"</automated>
  </verify>
  <done>DatabaseModule created with global export</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement DatabaseService with tenant context</name>
  <files>
    src/shared/database/database.service.ts
  </files>
  <behavior>
    - Test 1: DatabaseService has method setTenantContext(tenantId: number): Promise<void>
    - Test 2: setTenantContext executes raw SQL `SET app.current_tenant = $1` with tenantId parameter
    - Test 3: DatabaseService has method clearTenantContext(): Promise<void> executing `RESET app.current_tenant`
    - Test 4: Service provides access to PrismaClient (this.prisma)
    - Test 5: Service is injectable ( Injectable decorator)
    - Test 6: Uses logger for debugging (log tenant context set/clear)
  </behavior>
  <action>
    Implement DatabaseService:

    If using PrismaService from @prisma/nestjs:

    ```typescript
    import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
    import { PrismaService } from '@prisma/nestjs';

    @Injectable()
    export class DatabaseService extends PrismaService implements OnModuleInit {
      private readonly logger = new Logger(DatabaseService.name);

      async setTenantContext(tenantId: number): Promise<void> {
        this.logger.debug(`Setting tenant context: ${tenantId}`);
        await this.$executeRaw`SET app.current_tenant = ${tenantId}`;
      }

      async clearTenantContext(): Promise<void> {
        this.logger.debug('Clearing tenant context');
        await this.$executeRaw`RESET app.current_tenant`;
      }

      onModuleInit() {
        this.logger.log('DatabaseService initialized');
      }
    }
    ```

    If not using @prisma/nestjs, inject PrismaClient:

    ```typescript
    import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
    import { PrismaClient } from '@prisma/client';

    @Injectable()
    export class DatabaseService implements OnModuleInit {
      private readonly prisma: PrismaClient;
      private readonly logger = new Logger(DatabaseService.name);

      constructor() {
        this.prisma = new PrismaClient();
      }

      async setTenantContext(tenantId: number): Promise<void> {
        this.logger.debug(`Setting tenant context: ${tenantId}`);
        await this.prisma.$executeRaw`SET app.current_tenant = ${tenantId}`;
      }

      async clearTenantContext(): Promise<void> {
        this.logger.debug('Clearing tenant context');
        await this.prisma.$executeRaw`RESET app.current_tenant`;
      }

      onModuleInit() {
        this.logger.log('DatabaseService initialized');
        this.prisma.$connect().catch(err => this.logger.error('DB connection failed', err));
      }

      onModuleDestroy() {
        this.prisma.$disconnect();
      }
    }
    ```

    Choose approach based on whether @prisma/nestjs is installed. The latter is more explicit.

    Verify: Service compiles; methods are defined; raw SQL query syntax is correct.
  </action>
  <verify>
    <automated>
      grep -q "setTenantContext" src/shared/database/database.service.ts &&
      grep -q "SET app.current_tenant" src/shared/database/database.service.ts &&
      grep -q "clearTenantContext" src/shared/database/database.service.ts &&
      echo "DatabaseService methods defined"
    </automated>
  </verify>
  <done>DatabaseService with tenant context management implemented</done>
</task>

</tasks>

<verification>
Wave 1c - Database service complete

**Automated checks:**
1. DatabaseModule provides/exports DatabaseService (or PrismaModule globally)
2. DatabaseService.setTenantContext executes `SET app.current_tenant = $1` via raw query
3. DatabaseService.clearTenantContext executes `RESET app.current_tenant`
4. Service injects PrismaClient or extends PrismaService for database access
5. TypeScript compiles: `npx tsc --noEmit src/shared/database/*.ts`

**Integration with auth (Plan 03):**
TenantContextMiddleware (to be created) will call `databaseService.setTenantContext(tenantId)` after validating JWT. This ensures RLS policies apply to all subsequent DB queries in request.

**Requirements coverage:**
- TEN-01: RLS policies active (Plan 02b)
- TEN-02: DatabaseService.setTenantContext sets session variable → automatic filtering
- TEN-03: Tenant isolation enforced by combination of RLS + context setting

**Security:** Never allow database queries without setting tenant context first. DatabaseService should optionally throw error if `current_setting('app.current_tenant')` is null? But that's enforced by RLS itself (queries will fail if tenant_id column constraint not satisfied). Good.

**Performance:** Raw SET/RESET queries are cheap; one per request.

</verification>

<success_criteria>
Database service ready when:
- [ ] src/shared/database/database.module.ts exists with @Global() and exports DatabaseService (or PrismaModule)
- [ ] src/shared/database/database.service.ts exists with setTenantContext(tenantId: number) and clearTenantContext() methods
- [ ] Both methods execute raw SQL using PrismaClient.$executeRaw
- [ ] Service connects to database on init and logs initialization
- [ ] Service can be injected in other modules: `constructor(private db: DatabaseService) {}`
- [ ] `npx tsc --noEmit` passes for database module files

**Next:** DatabaseService will be used by TenantContextMiddleware (Plan 03) and all feature modules.

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-02c-PLAN-02c-summary.md`
</output>
