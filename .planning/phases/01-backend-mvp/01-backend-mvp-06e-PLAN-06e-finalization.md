---
phase: 01-backend-mvp
plan: 06e
type: execute
wave: 22
depends_on:
  - 06d
files_modified:
  - src/main.ts
  - src/app/app.module.ts
  - prisma/schema.prisma
  - package.json
autonomous: true
requirements: []
user_setup: []
must_haves:
  truths:
    - "All cross-cutting services registered in AppModule"
    - "Global middleware, guards, filters applied correctly"
    - "Application compiles without errors or circular dependencies"
    - "All services (encryption, audit, rate-limit, logging) are injectable and functional"
  artifacts:
    - path: "src/main.ts"
      provides: "Application bootstrap with global error handling and middleware registration"
      contains:
        - "NestFactory.create(AppModule)"
        - "app.useGlobalFilters(new HttpExceptionFilter())"
        - "app.useGlobalInterceptors(new LoggingInterceptor())"
        - "app.useGlobalPipes(new ValidationPipe())"
        - "await app.listen(PORT)"
      min_lines: 20
    - path: "src/app/app.module.ts"
      provides: "Root module imports all feature modules and registers global services"
      contains:
        - "imports: [ConfigModule, DatabaseModule, RedisModule, QdrantModule, AuthModule, DocumentsModule, ChatModule, …]"
        - "providers: [EncryptionService, AuditLoggingService, RateLimiterService, …]"
      min_lines: 30
  key_links:
    - from: "src/main.ts"
      to: "AppModule"
      via: "NestFactory.create(AppModule)"
      pattern: "NestFactory"
    - from: "src/app/app.module.ts"
      to: "all feature modules"
      via: "imports array"
      pattern: "imports:"
    - from: "AppModule"
      to: "cross-cutting services"
      via: "providers array"
      pattern: "providers:"

---

<objective>
Finalize application wiring and compilation

Purpose: Integrate all modules and services into the main NestJS application, ensuring proper dependency injection, global middleware registration, and successful compilation.

Output: Fully bootable NestJS application with all modules wired together
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
<task type="auto" tdd="false">
  <name>Task 1: Integrate modules and bootstrap application</name>
  <files>
    src/app/app.module.ts
    src/main.ts
  </files>
  <behavior>
    - AppModule imports all shared and feature modules
    - Global pipes, filters, interceptors configured
    - main.ts creates app with CORS, listens on PORT
  </behavior>
  <action>
    Create/update src/app/app.module.ts to import ConfigModule, DatabaseModule, RedisModule, QdrantModule, AuthModule, DocumentsModule, ChatModule, and provide EncryptionService, AuditLoggingService, RateLimiterService. Create src/main.ts with NestFactory bootstrap, global ValidationPipe, HttpExceptionFilter, LoggingInterceptor, CORS, and app.listen.
  </action>
  <verify>
    <automated>
      grep -q "AuthModule" src/app/app.module.ts &&
      grep -q "DocumentsModule" src/app/app.module.ts &&
      grep -q "ChatModule" src/app/app.module.ts &&
      grep -q "HttpExceptionFilter" src/main.ts &&
      grep -q "LoggingInterceptor" src/main.ts &&
      grep -q "app.listen" src/main.ts &&
      echo "Bootstrap complete"
    </automated>
  </verify>
  <done>AppModule and main.ts configured</done>
</task>

<task type="auto">
  <name>Task 2: Ensure Prisma schema includes all models</name>
  <files>
    prisma/schema.prisma
  </files>
  <action>
    Verify schema includes Tenant, User, Document, DocumentChunk, Chat, ChatMessage, RefreshToken, PasswordResetToken, AuditLog with proper tenant_id relations and cascades. Run npx prisma validate. Generate client if needed.
  </action>
  <verify>
    <automated>npx prisma validate && echo "Prisma schema valid"</automated>
  </verify>
  <done>Prisma schema complete</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Compile the entire project</name>
  <files>
    tsconfig.json
    package.json
  </files>
  <action>
    Run npm run build. Fix any compilation errors.
  </action>
  <verify>
    <automated>npm run build 2>&1 | grep -q "error" && echo "Build FAILED" || echo "Build successful"</automated>
  </verify>
  <done>Project builds successfully</done>
</task>
</tasks>

<verification>
Wave 5e finalizes the application.
Verify:
1. `npm run build` completes without errors
2. `npx prisma generate` generates Prisma client without errors
3. All required environment variables documented in .env.example (should exist from prior waves)
4. Application starts: `npm run start:dev` boots NestJS app on PORT without runtime exceptions
5. Health check endpoint (if added) returns 200 OK
</verification>

<success_criteria>
Phase 1 backend fully assembled when:
- [ ] All modules imported in AppModule
- [ ] Global error filters and logging configured
- [ ] Application compiles successfully (`npm run build`)
- [ ] Prisma schema complete and client generated
- [ ] Server starts without exceptions (`npm run start:dev`)
- [ ] All test files exist and tests pass (from Wave 0)
</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-06e-summary.md`