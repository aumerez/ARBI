---
phase: 01-backend-mvp
plan: 06
type: execute
wave: 5
depends_on:
  - 02
  - 03
  - 04
  - 05
files_modified:
  - src/shared/infrastructure/logging.service.ts
  - src/shared/infrastructure/encryption.service.ts
  - src/shared/middleware/rate-limit.middleware.ts
  - src/shared/middleware/audit.middleware.ts
  - src/shared/middleware/tenant-validation.middleware.ts
  - src/shared/interceptors/logging.interceptor.ts
  - src/shared/filters/http-exception.filter.ts
  - src/shared/services/rate-limiter.service.ts
  - src/shared/guards/rate-limit.guard.ts
  - prisma/migrations/002-add-audit-tables.sql
  - src/main.ts
  - src/app/app.module.ts
autonomous: true
requirements: []
user_setup: []
must_haves:
  truths:
    - "System implements per-user rate limiting to prevent API abuse"
    - "System logs all queries and responses to tenant-scoped audit trail"
    - "Sensitive data (API keys, JWT secrets) encrypted at rest"
    - "System provides structured logging with request context"
    - "System applies tenant validation guard to all protected endpoints"
    - "HTTP exceptions are transformed into user-friendly error responses"
  artifacts:
    - path: "src/shared/infrastructure/encryption.service.ts"
      provides: "Encryption service for sensitive data at rest using AES-256-GCM"
      contains:
        - "encrypt(plaintext: string): Promise<string>"
        - "decrypt(ciphertext: string): Promise<string>"
        - "key derivation from ENCRYPTION_KEY env var"
    - path: "src/shared/services/rate-limiter.service.ts"
      provides: "Rate limiting service using rate-limiter-flexible with Redis"
      features:
        - "Tracks requests by user_id from JWT"
        - "Window: 60s, max: 60 requests (configurable)"
        - "Returns 429 with Retry-After header when exceeded"
    - path: "src/shared/guards/rate-limit.guard.ts"
      provides: "Guard enforcing rate limits on protected routes"
    - path: "src/shared/middleware/audit.middleware.ts"
      provides: "Audit logging middleware capturing query/response details"
      logs:
        - "tenant_id, user_id, endpoint, method, status, duration"
        - "For chat: query, retrieved chunks, response length"
        - "For document upload: file metadata, status"
    - path: "src/shared/middleware/tenant-validation.middleware.ts"
      provides: "Middleware validating tenant membership (optional if RLS sufficient)"
    - path: "src/shared/interceptors/logging.interceptor.ts"
      provides: "Logging interceptor for structured logs (Winston)"
    - path: "src/shared/filters/http-exception.filter.ts"
      provides: "Global exception filter formatting errors as JSON"
    - path: "prisma/migrations/002-add-audit-tables.sql"
      provides: "SQL migration adding audit_log table with tenant partitioning"
      contains:
        - "model AuditLog { id, tenant_id, user_id, event_type, payload, created_at }"
  key_links:
    - from: "src/shared/services/rate-limiter.service.ts"
      to: "src/shared/infrastructure/redis.service.ts"
      via: "Redis connection for sliding window counters"
      pattern: "getConnection()"
    - from: "src/shared/middleware/audit.middleware.ts"
      to: "src/shared/database/database.service.ts"
      via: "db.prisma.auditLog.create()"
      pattern: "auditLog.create"
    - from: "src/shared/infrastructure/encryption.service.ts"
      to: "environment variables"
      via: "ENCRYPTION_KEY derivation"
      pattern: "crypto.scrypt"
    - from: "prisma/migrations/002-add-audit-tables.sql"
      to: "prisma/schema.prisma"
      via: "model AuditLog"
      pattern: "model AuditLog"
    - from: "src/shared/guards/rate-limit.guard.ts"
      to: "Protected controllers"
      via: "@UseGuards(RateLimitGuard)"
      pattern: "RateLimitGuard"
    - from: "src/app/app.module.ts"
      to: "All feature modules"
      via: "module imports and global middleware"
      pattern: "useGlobalInterceptors"

---

<objective>
Implement cross-cutting concerns: rate limiting, audit logging, encryption, and improved error handling

Purpose: Ensure system quality, security, and compliance: prevent abuse with rate limiting; track all actions with audit log; protect sensitive data with encryption; provide structured logging and user-friendly errors.

Output: Rate limiting guard, audit logging, encryption service, global exception filter, and database audit tables

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
- Rate limiting: Redis-based sliding window per user (rate-limiter-flexible library)
- Audit logging: All queries/responses logged to tenant-scoped AuditLog table with JSON payload
- Encryption: AES-256-GCM for sensitive fields (API keys stored in DB? Phase 1: only in env; Phase 2+ need encryption)
- Pre-built patterns: Use winston for logging, helmet for security headers, class-validator already used
- QUAL-01: Audit logging for all queries/responses
- QUAL-04: Rate limiting per user to prevent abuse
- QUAL-05: Encryption at rest (database-level, key management via infra; for code: encrypt secrets before DB storage)

# Implementation order:
1. EncryptionService (simple, standalone)
2. AuditLog table and middleware
3. Rate limiting middleware
4. Logging interceptor and exception filter
5. Apply globally via app.module

# Notes:
- QUAL-02 (document versioning) is listed in Phase 3, not this wave - skip (already handled in DocumentsModule)
- Quality infrastructure sets stage for Phase 3 compliance
- Middleware order: TenantContext (sets RLS) → Rate Limit → Audit Log (captures after response)

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create EncryptionService for sensitive data</name>
<files>
    src/shared/infrastructure/encryption.service.ts
  </files>
  <behavior>
    - Test 1: encrypt(plaintext) returns base64 ciphertext with IV authenticated
    - Test 2: decrypt(ciphertext) returns original plaintext
    - Test 3: Uses AES-256-GCM algorithm (crypto.createCipheriv 'aes-256-gcm')
    - Test 4: Key derived from ENCRYPTION_KEY env var using crypto.scryptSync (256-bit key)
    - Test 5: Different encrypt() calls produce different ciphertexts (random IV)
    - Test 6: Throws error if ENCRYPTION_KEY not set
  </behavior>
  <action>
    Implement EncryptionService:

    ```typescript
    import { Injectable } from '@nestjs/common';
    import * as crypto from 'crypto';

    @Injectable()
    export class EncryptionService {
      private readonly key: Buffer;
      private readonly algorithm = 'aes-256-gcm';
      private readonly ivLength = 16; // 96 bits for GCM recommended

      constructor(private readonly config: ConfigService) {
        const secret = config.get<string>('ENCRYPTION_KEY');
        if (!secret) {
          throw new Error('ENCRYPTION_KEY environment variable is required');
        }
        // Derive 32-byte key from secret using scrypt
        this.key = crypto.scryptSync(secret, 'salt', 32); // salt can be fixed; for prod use per-tenant keys
      }

      encrypt(plaintext: string): string {
        const iv = crypto.randomBytes(this.ivLength);
        const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        const authTag = cipher.getAuthTag();
        // Format: iv:authTag:encrypted (base64 each)
        return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
      }

      decrypt(ciphertext: string): string {
        const [ivB64, authTagB64, encrypted] = ciphertext.split(':');
        if (!ivB64 || !authTagB64 || !encrypted) {
          throw new Error('Invalid ciphertext format');
        }
        const iv = Buffer.from(ivB64, 'base64');
        const authTag = Buffer.from(authTagB64, 'base64');
        const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }
    }
    ```

    Verify: Service uses AES-256-GCM with key derivation; encrypt/decrypt round-trip works.
  </action>
  <verify>
    <automated>grep -q "createCipheriv.*aes-256-gcm" src/shared/infrastructure/encryption.service.ts && grep -q "scryptSync" src/shared/infrastructure/encryption.service.ts && echo "Encryption service implemented"</automated>
  </verify>
  <done>EncryptionService ready for sensitive data (API keys in Phase 2+)</done>
</task>

<task type="auto">
  <name>Task 2: Create AuditLog model and migration</name>
<files>
    prisma/schema.prisma
    prisma/migrations/002-add-audit-tables.sql
  </files>
  <behavior>
    - Test 1: Schema includes model AuditLog with required fields
    - Test 2: Migration adds table with RLS enabled and tenant_isolation policy
    - Test 3: AuditLog has: tenant_id, user_id (nullable), event_type (string), payload (Json), ip_address (String?), user_agent (String?), created_at
    - Test 4: Indexes on tenant_id, user_id, created_at for query performance
    - Test 5: Table uses row-level security (ENABLE ROW LEVEL SECURITY)
    - Test 6: Policy: CREATE POLICY tenant_isolation_audit ON AuditLog USING (tenant_id = current_setting('app.current_tenant')::integer)
  </behavior>
  <action>
    Update prisma/schema.prisma to add:

    ```prisma
    model AuditLog {
      id            BigInt   @id @default(autoincrement())
      tenant_id     Int
      user_id       Int?
      event_type    String   // e.g., 'query', 'response', 'document_upload', 'auth_login', 'password_reset'
      payload       Json     // rich details
      ip_address    String?
      user_agent    String?
      created_at    DateTime @default(now())

      @@index([tenant_id])
      @@index([user_id])
      @@index([created_at])
    }
    ```

    Generate migration: `npx prisma migrate dev --name add-audit-tables` then edit to add RLS policy as in Plan 02.

    Migration SQL adds:
    - CREATE TABLE "AuditLog" (...)
    - ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
    - CREATE POLICY tenant_isolation_audit ON "AuditLog" USING (tenant_id = current_setting('app.current_tenant')::integer);

    Verify: Migration SQL contains RLS enable and policy.
  </action>
  <verify>
    <automated>grep -q "model AuditLog" prisma/schema.prisma && grep -q "ENABLE ROW LEVEL SECURITY" prisma/migrations/002-add-audit-tables.sql && grep -q "tenant_isolation_audit" prisma/migrations/002-add-audit-tables.sql && echo "AuditLog table with RLS added"</automated>
  </verify>
  <done>AuditLog model and RLS migration created</done>
</task>

<task type="auto">
  <name>Task 3: Create AuditLoggingService and middleware</name>
<files>
    src/shared/middleware/audit.middleware.ts
    src/shared/services/audit-logging.service.ts
  </files>
  <behavior>
    - Test 1: AuditMiddleware extracts request context (tenantId, userId from JWT)
    - Test 2: Middleware captures response status, duration, endpoint, method
    - Test 3: Calls AuditLoggingService.log(eventType, payload, userAgent, ip)
    - Test 4: AuditLoggingService creates AuditLog record with tenant_id, user_id, event_type, payload, ip_address, user_agent, created_at
    - Test 5: For chat queries: logs query, retrieved chunks, response length
    - Test 6: For document uploads: logs filename, size, status
    - Test 7: All logs use async write (fire-and-forget) to avoid blocking response
  </behavior>
  <action>
    Create audit infrastructure:

    1. audit-logging.service.ts:
       - Inject PrismaService
       - async log(eventType: string, payload: object, req?: Request): Promise<void>
         * Extract tenantId, userId from req?.user?.tenant_id / .sub if available
         * Get IP: req?.ip || req?.connection?.remoteAddress
         * Get userAgent: req?.headers['user-agent']
         * Create: this.db.prisma.auditLog.create({ data: { tenant_id, user_id, event_type, payload: payload, ip_address, user_agent } })
         * Use try/catch to ensure failures don't break main flow

    2. audit.middleware.ts (implements NestMiddleware):
       - use(req: Request, res: Response, next: NextFunction)
       - const start = Date.now()
       - res.on('finish', async () => {
           const duration = Date.now() - start
           const eventType = determineEventType(req.method, req.route?.path)
           const payload = { status: res.statusCode, duration, path: req.path, method: req.method }
           await auditLoggingService.log(eventType, payload, req)
         })
       - next()

    Determine eventType heuristics:
    - POST /auth/* → 'auth_*'
    - POST /documents/upload → 'document_upload'
    - GET/POST /chats/* → 'chat_query' or 'chat_response'

    Verify: Middleware and service compile; Prisma AuditLog model exists.
  </action>
  <verify>
    <automated>grep -q "auditLog.create" src/shared/services/audit-logging.service.ts && grep -q "res.on('finish'" src/shared/middleware/audit.middleware.ts && echo "Audit middleware and service defined"</automated>
  </verify>
  <done>Audit logging infrastructure ready</done>
</task>

<task type="auto">
  <name>Task 4: Create RateLimiter service and guard</name>
<files>
    src/shared/services/rate-limiter.service.ts
    src/shared/guards/rate-limit.guard.ts
  </files>
  <behavior>
    - Test 1: RateLimiterService wraps RateLimiterRedis with getConnection from RedisService
    - Test 2: Service exposes async consume(key: string, points: number = 1): Promise<void> that throws on limit exceeded
    - Test 3: RateLimitGuard extracts user from request (JwtPayload), constructs key `rate-limit:{tenant_id}:{user_id}` and calls service.consume()
    - Test 4: Guard throws BadRequestException with Retry-After when rate limit exceeded
    - Test 5: Guard allows unauthenticated requests to pass through (skip rate limiting)
  </behavior>
  <action>
    Create rate limiting infrastructure as guard:

    1. src/shared/services/rate-limiter.service.ts:
       - Inject RedisService
       - Create RateLimiterRedis instance in constructor using redisService.getConnection()
       - Configure points = config.get('RATE_LIMIT_MAX_REQUESTS', 60), duration = config.get('RATE_LIMIT_WINDOW_MS', 60000)/1000
       - Method: async consume(key: string, points = 1): Promise<void> that delegates to rateLimiter.consume()
       - On error (rate limit exceeded), throws an error with msBeforeNext property

    2. src/shared/guards/rate-limit.guard.ts (implements CanActivate):
       - Inject RateLimiterService
       - async canActivate(context: ExecutionContext): Promise<boolean>
         * const request = context.switchToHttp().getRequest();
         * const user = request.user as JwtPayload | undefined;
         * if (!user) return true; // skip unauthenticated
         * const key = `rate-limit:${user.tenant_id}:${user.sub}`;
         * try { await this.rateLimiter.consume(key); return true; }
         * catch (error: any) { throw new BadRequestException(`Too many requests. Try again in ${Math.round(error.msBeforeNext/1000)} seconds`); }

    Apply to all protected controllers: Add @UseGuards(JwtAuthGuard, TenantContextGuard, RateLimitGuard)

    Verify: Guard compiles and uses correct user extraction.
  </action>
  <verify>
    <automated>grep -q "RateLimiterService" src/shared/services/rate-limiter.service.ts && grep -q "implements CanActivate" src/shared/guards/rate-limit.guard.ts && echo "Rate limiting service and guard defined"</automated>
  </verify>
  <done>Rate limiting as guard ready for application</done>
</task>

<task type="auto">
  <name>Task 5: Create global HTTP exception filter</name>
<files>
    src/shared/filters/http-exception.filter.ts
  </files>
  <action>
    Create HttpExceptionFilter extending BaseExceptionFilter:

    ```typescript
    import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
    import { Request, Response } from 'express';

    @Catch(HttpException)
    export class HttpExceptionFilter implements ExceptionFilter {
      catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const status = exception.getStatus();
        const message = exception.getResponse();

        // Log error with context
        logger.error({
          message: exception.message,
          stack: exception.stack,
          url: request.url,
          method: request.method,
          tenant_id: (request.user as JwtPayload)?.tenant_id,
          user_id: (request.user as JwtPayload)?.sub,
        });

        // For security: don't expose internal errors in production
        const isDevelopment = process.env.NODE_ENV !== 'production';
        const errorResponse = isDevelopment
          ? { error: message, path: request.url, method: request.method, timestamp: new Date().toISOString() }
          : { error: HttpStatus[status] || 'Internal server error' };

        response.status(status).json({
          success: false,
          ...errorResponse,
        });
      }
    }
    ```

    Register globally in main.ts: `app.useGlobalFilters(new HttpExceptionFilter());`

    Verify: Filter catches HttpException and formats consistent JSON response.
  </action>
  <verify>
    <automated>grep -q "implements ExceptionFilter" src/shared/filters/http-exception.filter.ts && grep -q "useGlobalFilters" src/main.ts && echo "HTTP exception filter created and registered"</automated>
  </verify>
  <done>Global exception filter for user-friendly errors configured</done>
</task>

<task type="auto">
  <name="Task 6: Create logging interceptor for structured logs">
<files>
    src/shared/interceptors/logging.interceptor.ts
  </files>
  <action>
    Create LoggingInterceptor using winston:

    ```typescript
    import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
    import { Observable } from 'rxjs';
    import { tap, map } from 'rxjs/operators';
    import * as winston from 'winston';

    @Injectable()
    export class LoggingInterceptor implements NestInterceptor {
      intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const now = Date.now();
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();
        const method = request.method;
        const url = request.url;
        const user = request.user as JwtPayload;

        return next.handle().pipe(
          tap(() => {
            const latency = Date.now() - now;
            const status = response.statusCode;
            const log = winston.createLogger({
              level: 'info',
              format: winston.format.json(),
              transports: [new winston.transports.Console()],
            });
            log.info('Request completed', {
              method,
              url,
              status,
              latency,
              tenant_id: user?.tenant_id,
              user_id: user?.sub,
            });
          }),
        );
      }
    }
    ```

    Apply globally in main.ts: `app.useGlobalInterceptors(new LoggingInterceptor());`

    Verify: Interceptor uses winston JSON format for structured logs; captures latency, status, user context.
  </action>
  <verify>
    <automated>grep -q "implements NestInterceptor" src/shared/interceptors/logging.interceptor.ts && grep -q "useGlobalInterceptors" src/main.ts && echo "Logging interceptor created and registered"</automated>
  </verify>
  <done>Structured logging interceptor configured globally</done>
</task>

<task type="auto">
  <name="Task 7: Apply rate limiting to protected routes">
<files>
    src/auth/auth.module.ts
    src/documents/documents.module.ts
    src/chat/chat.module.ts
  </files>
  <action>
    Apply RateLimitGuard to all module routes that require authentication:

    Update AuthController, DocumentsController, ChatController:
    Add `@UseGuards(JwtAuthGuard, TenantContextGuard, RateLimitGuard)` at class level (above @Controller) to all protected controllers.

    Verify: Guard applied consistently to all authenticated endpoints.
  </action>
  <verify>
    <automated>grep -q "RateLimitGuard" src/auth/auth.controller.ts && grep -q "RateLimitGuard" src/documents/documents.controller.ts && grep -q "RateLimitGuard" src/chat/chat.controller.ts && echo "Rate limit guard applied to all protected controllers"</automated>
  </verify>
  <done>Rate limiting guard applied to all protected endpoints</done>
</task>

<task type="auto">
  <name="Task 8: Finalize all imports and compile check</name>
<files>
    src/app/app.module.ts
    src/main.ts
  </files>
  <action>
    Final review: Ensure all modules imported correctly in AppModule in right order:

    ```typescript
    @Module({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
        DatabaseModule,
        RedisModule,
        QdrantModule,
        AuthModule,
        DocumentsModule,
        ChatModule,
      ],
      controllers: [AppController],
      providers: [],
    })
    export class AppModule {}
    ```

    Also verify that main.ts has applied all global middleware:
    - ValidationPipe
    - Helmet
    - LoggingInterceptor
    - HttpExceptionFilter
    - AuditMiddleware (global via APP_MIDDLEWARE or in app.module)

    Run TypeScript compile: `npm run build` should succeed without errors. Fix any import/export issues.

    Verify: Application compiles successfully; all modules resolved.
  </action>
  <verify>
    <automated>npm run build 2>&1 | grep -q "error" && echo "Build failed" || echo "Build successful"</automated>
  </verify>
  <done>All modules wired; application compiles without errors</done>
</task>

</tasks>

<verification>
Wave 5 - Cross-Cutting Quality Complete

**Automated verification:**
1. Run full test suite: `npm test -- --runInBand --coverage`
   - All unit, integration tests from Plan 01 should pass
   - Coverage target ≥80% for all Phase 1 modules
2. Audit logging functional test:
   - Perform authenticated request → verify AuditLog record created in DB with tenant_id, user_id, event_type
3. Rate limiting functional test:
   - Send >60 requests from same user within 60s → receive 429 on 61st
   - Verify Redis key `rate-limit:tenantId:userId` exists and TTL resets
4. Encryption service test:
   - encrypt('secret') → decrypt(ciphertext) === 'secret'
   - Verify AES-256-GCM used
5. Integration test for streaming chat + audit logging:
   - Chat query → audited with event_type='chat_query' and payload includes query, retrieved_chunk_count

**Requirements mapping:**
Since this plan is cross-cutting infrastructure, it supports multiple requirements:
- QUAL-03: Citation validation already implemented in Plan 05 (not here)
- Quality infrastructure: Rate limiting, audit logging, encryption, structured logging, error handling

**Additional quality:**
- Audit logging (QUAL-01) addressed via AuditLog table and middleware
- Document versioning (QUAL-02) already handled in DocumentsModule (soft delete)
- Structured logging with winston and interceptor
- Global exception filter for consistent error responses
- Security headers via helmet

**Critical checks:**
- RateLimitGuard runs AFTER JwtAuthGuard and TenantContextGuard (order in @UseGuards matters)
- AuditLog must respect RLS tenant isolation (tenant_id field present)
- Encryption key: ENCRYPTION_KEY must be long random string (32+ bytes). Recommend generating: `openssl rand -base64 32`
- Middleware order: RateLimitGuard on each controller; AuditMiddleware global (runs after response); LoggingInterceptor global (logs request start/complete)

**Performance:**
- Rate limiting uses Redis → O(1) operations, negligible overhead
- Audit logging fire-and-forget: async, doesn't block response; but ensure connection pool has capacity

**Security:**
- Rate limit keys per tenant + user prevents DoS
- Audit log includes IP and user agent for traceability
- Encryption key stored securely (env var, not in code)
- Helmet sets security headers (HSTS, CSP, etc.)

</verification>

<success_criteria>
Cross-cutting quality features complete when:
- [ ] EncryptionService implements encrypt/decrypt with AES-256-GCM; key derived from ENCRYPTION_KEY
- [ ] AuditLog table exists with RLS; AuditLoggingService logs events asynchronously
- [ ] RateLimitGuard enforces 60 requests/min per user; returns 429 with Retry-After
- [ ] HttpExceptionFilter formats errors as JSON; logs stack traces
- [ ] LoggingInterceptor emits structured winston JSON logs with latency, status, user context
- [ ] Soft delete already implemented in DocumentsModule (covered by DOC-01-08)
- [ ] All protected controllers (Auth, Documents, Chat) include `@UseGuards(JwtAuthGuard, TenantContextGuard, RateLimitGuard)`
- [ ] Global middleware order: ValidationPipe → LoggingInterceptor → HttpExceptionFilter → RateLimitGuard → AuditMiddleware
- [ ] Helmet enabled for security headers
- [ ] Full test suite passes: `npm test` with ≥80% coverage

**Deployment readiness:**
- [ ] ENCRYPTION_KEY, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS documented in .env.example
- [ ] PostgreSQL connection supports RLS (migrations 001, 002 applied)
- [ ] Redis connected for rate limiting
- [ ] Winston logs structured for aggregation (JSON fields: timestamp, level, message, additional)

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-06-PLAN-06-summary.md`
</output>
