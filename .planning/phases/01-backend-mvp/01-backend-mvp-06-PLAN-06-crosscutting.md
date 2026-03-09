---
phase: 01-backend-mvp
plan: 06
type: execute
wave: 5
depends_on:
  - 02
  - 03
files_modified:
  - src/shared/infrastructure/logging.service.ts
  - src/shared/infrastructure/encryption.service.ts
  - src/shared/middleware/rate-limit.middleware.ts
  - src/shared/middleware/audit.middleware.ts
  - src/shared/middleware/tenant-validation.middleware.ts
  - src/shared/interceptors/logging.interceptor.ts
  - src/shared/filters/http-exception.filter.ts
  - prisma/migrations/002-add-audit-tables.sql
autonomous: true
requirements:
  - QUAL-03
  - QUAL-04
  - QUAL-05
user_setup: []
must_haves:
  truths:
    - "System implements per-user rate limiting to prevent API abuse"
    - "System logs all queries and responses to tenant-scoped audit trail"
    - "Sensitive data (API keys, JWT secrets) encrypted at rest"
    - "System provides structured logging with request context"
    - "System applies tenant validation guard to all protected endpoints"
    - "System implements document versioning (immutable upload history, soft deletes)"
    - "HTTP exceptions are transformed into user-friendly error responses"
  artifacts:
    - path: "src/shared/infrastructure/encryption.service.ts"
      provides: "Encryption service for sensitive data at rest using AES-256-GCM"
      contains:
        - "encrypt(plaintext: string): Promise<string>"
        - "decrypt(ciphertext: string): Promise<string>"
        - "key derivation from ENCRYPTION_KEY env var"
    - path: "src/shared/middleware/rate-limit.middleware.ts"
      provides: "Rate limiting middleware with Redis sliding window per user"
      features:
        - "Tracks requests by user_id from JWT"
        - "Window: 60s, max: 60 requests (configurable)"
        - "Returns 429 with Retry-After header when exceeded"
    - path: "src/shared/middleware/audit.middleware.ts"
      provides: "Audit logging middleware capturing query/response details"
      logs:
        - "tenant_id, user_id, endpoint, method, status, duration"
        - "For chat: query, retrieved chunks, response length"
        - "For document upload: file metadata, status"
    - path: "src/shared/interceptors/logging.interceptor.ts"
      provides: "Logging interceptor for structured logs (Winston)"
    - path: "src/shared/filters/http-exception.filter.ts"
      provides: "Global exception filter formatting errors as JSON"
    - path: "prisma/migrations/002-add-audit-tables.sql"
      provides: "SQL migration adding audit_log table with tenant partitioning"
      contains:
        - "model AuditLog { id, tenant_id, user_id, event_type, payload, created_at }"
    - path: "src/shared/middleware/tenant-validation.middleware.ts"
      provides: "Middleware validating tenant membership (optional if RLS sufficient)"
  key_links:
    - from: "src/shared/middleware/rate-limit.middleware.ts"
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

---

<objective>
Implement cross-cutting concerns: rate limiting, audit logging, encryption, and improved error handling

Purpose: Ensure system quality, security, and compliance: prevent abuse with rate limiting; track all actions with audit log; protect sensitive data with encryption; provide structured logging and user-friendly errors.

Output: Rate limiting middleware, audit logging, encryption service, global exception filter, and database audit tables

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
- QUAL-02 (document versioning) is listed in Phase 3, not this wave - skip
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
    - Test 5: For chat queries: logs query text, retrieved_chunk_count, response_token_count
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
  <name>Task 4: Create RateLimit middleware</name>
<files>
    src/shared/middleware/rate-limit.middleware.ts
  </files>
  <action>
    Create rate limiting middleware using rate-limiter-flexible:

    ```typescript
    import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
    import { RateLimiterRedis } from 'rate-limiter-flexible';
    import { Redis } from 'ioredis';

    @Injectable()
    export class RateLimitMiddleware implements NestMiddleware {
      private readonly rateLimiter: RateLimiterRedis;

      constructor(private readonly redisService: RedisService, private readonly config: ConfigService) {
        const redisClient = this.redisService.getConnection() as Redis;

        const points = this.config.get<number>('RATE_LIMIT_MAX_REQUESTS', 60);
        const duration = this.config.get<number>('RATE_LIMIT_WINDOW_MS', 60) / 1000;

        this.rateLimiter = new RateLimiterRedis({
          storeClient: redisClient,
          points, // Number of requests allowed per duration
          duration, // Duration in seconds
          blockDuration: 60, // Block for 60s if limit exceeded
        });
      }

      async use(req: Request, res: Response, next: NextFunction) {
        // Extract user from JWT (requires JwtAuthGuard to have run before this middleware)
        const user = (req as any).user as JwtPayload;
        if (!user) {
          // Skip rate limiting for unauthenticated endpoints (register, login)
          return next();
        }

        const key = `rate-limit:${user.tenant_id}:${user.sub}`; // per-user per-tenant

        try {
          await this.rateLimiter.consume(key, 1);
          next();
        } catch (rejRes: any) {
          const secs = Math.round(rejRes.msBeforeNext / 1000) || 60;
          res.setHeader('Retry-After', String(secs));
          throw new BadRequestException(`Too many requests. Please try again in ${secs} seconds.`);
        }
      }
    }
    ```

    Apply this middleware AFTER JwtAuthGuard, so user is extracted. In app.module, use `app.use('/api', rateLimitMiddleware)` or route-specific via @UseMiddleware.

    Configure environment: RATE_LIMIT_MAX_REQUESTS=60, RATE_LIMIT_WINDOW_MS=60000

    Verify: Middleware uses Redis for distributed rate limiting; respects blockDuration.
  </action>
  <verify>
    <automated>grep -q "RateLimiterRedis" src/shared/middleware/rate-limit.middleware.ts && grep -q "consume(" src/shared/middleware/rate-limit.middleware.ts && echo "Rate limiting middleware defined"</automated>
  </verify>
  <done>Rate limiting middleware ready for application</done>
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
  <name>Task 6: Create logging interceptor for structured logs</name>
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
  <name>Task 7: Update main.ts with global pipes, filters, interceptors</name>
<files>
    src/main.ts
  </files>
  <action>
    Update main.ts to apply all global middleware:

    ```typescript
    import { NestFactory } from '@nestjs/core';
    import { AppModule } from './app/app.module';
    import { ValidationPipe } from '@nestjs/common';
    import helmet from 'helmet';
    import { ConfigService } from '@nestjs/config';
    import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';
    import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
    import { RateLimitMiddleware } from './shared/middleware/rate-limit.middleware';

    async function bootstrap() {
      const app = await NestFactory.create(AppModule);
      const configService = app.get(ConfigService);

      // Security
      app.use(helmet());

      // Global validation
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

      // Global interceptors
      app.useGlobalInterceptors(new LoggingInterceptor());

      // Global filters
      app.useGlobalFilters(new HttpExceptionFilter());

      // Rate limiting (apply after JWT auth middleware is set up)
      // Middleware must run after JWT guard extracts user; so apply at app level but ensure JWT guard runs first on routes
      app.use('/api', (req, res, next) => {
        // The RateLimitMiddleware itself should check if user exists; if not, skip
        // We'll use it as a route-specific middleware, not global, to avoid unauthenticated rate limiting
        // Instead: apply per-module in controllers with @UseMiddleware(RateLimitMiddleware)
        next();
      });

      // CORS for Electron later
      app.enableCors({
        origin: configService.get('FRONTEND_URL', 'http://localhost:3000'),
        credentials: true,
      });

      const port = configService.get<number>('PORT', 3000);
      await app.listen(port);
      logger.log(`Listening on port ${port}`);
    }
    bootstrap();
    ```

    But better: Apply RateLimitMiddleware globally but let it skip unauthenticated requests. Modify RateLimitMiddleware to check `if (!req.user) return next();`

    Then: `app.use(rateLimitMiddleware);`

    Also set up request context logging (correlation ID) with continuation-local-storage if needed.

    Verify: main.ts imports and applies all global middleware correctly; server starts without errors.
  </action>
<verify>
    <automated>grep -q "ValidationPipe" src/main.ts && grep -q "LoggingInterceptor" src/main.ts && grep -q "HttpExceptionFilter" src/main.ts && echo "Global middleware configured"</automated>
  </verify>
  <done>main.ts configured with all global pipes, filters, interceptors</done>
</task>

<task type="auto">
  <name>Task 8: Apply rate limiting to protected routes</name>
<files>
    src/auth/auth.module.ts
    src/documents/documents.module.ts
    src/chat/chat.module.ts
  </files>
  <action>
    Apply RateLimitMiddleware to all module routes that require authentication:

    Option A: In each controller, add @UseMiddleware(RateLimitMiddleware)
    Option B: In each module, use `providers: [{ provide: APP_MIDDLEWARE, useClass: RateLimitMiddleware }]` with scope

    Simpler: Apply at route level using decorator:

    Update AuthController, DocumentsController, ChatController:
    Add `@UseMiddleware(RateLimitMiddleware)` at class level (above @Controller) to all protected controllers.

    Or apply globally in main.ts after JWT extraction. But we need JWT to have run. Issue: middleware order - global middleware runs BEFORE route guards. So if we apply globally, user not set yet.

    Solution: Use `app.use('/api', (req, res, next) => { /* custom async middleware */ })` to extract user from JWT cookie manually? Not clean.

    Better: Use `@UseGuards(JwtAuthGuard)` then `@UseMiddleware(RateLimitMiddleware)` - but middleware runs AFTER guards? Guards → middleware order unclear.

    Check NestJS: Middleware runs BEFORE guards/interceptors/exception filters. So global rate limit can't access req.user.

    Approach: Use `express-rate-limit` with a custom key generator that reads JWT from cookie. But we're using rate-limiter-flexible with custom key extraction.

    Alternative: Apply rate limit as a GUARD, not middleware. Create RateLimitGuard implements CanActivate, runs AFTER JwtAuthGuard:

    ```typescript
    @Injectable()
    export class RateLimitGuard implements CanActivate {
      constructor(private rateLimiter: RateLimiterService) {}
      async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user as JwtPayload;
        if (!user) return true; // skip
        const key = `rate:${user.tenant_id}:${user.sub}`;
        try {
          await this.rateLimiter.consume(key);
          return true;
        } catch {
          throw new BadRequestException('Rate limit exceeded');
        }
      }
    }
    ```

    Then in controllers: `@UseGuards(JwtAuthGuard, RateLimitGuard)`.

    Change to guard pattern for cleaner Nest integration.

    Update: Instead of middleware, create RateLimitGuard in src/shared/guards/rate-limit.guard.ts and RateLimitService (thin wrapper around RateLimiterRedis). Apply to all protected controllers.

    Let's do that:

    - Create src/shared/services/rate-limiter.service.ts: wrapper around RateLimiterRedis
    - Create src/shared/guards/rate-limit.guard.ts: guard that uses service
    - Update protected controllers: add `@UseGuards(JwtAuthGuard, TenantContextGuard, RateLimitGuard)`

    This fits better with NestJS lifecycle (guards run after JWT sets req.user).

    Revised action:

    Create:
    - src/shared/services/rate-limiter.service.ts (injects RedisService, provides consume(key))
    - src/shared/guards/rate-limit.guard.ts (extracts key from user, calls service)

    Update src/auth/auth.module.ts, src/documents/documents.module.ts, src/chat/chat.module.ts to provide RateLimitGuard.
    Update each controller to include `@UseGuards(..., RateLimitGuard)` after JwtAuthGuard.

    Verify: Guard applied consistently to all authenticated endpoints.
  </action>
  <verify>
    <automated>grep -q "RateLimitGuard" src/auth/auth.controller.ts && grep -q "RateLimitGuard" src/documents/documents.controller.ts && grep -q "RateLimitGuard" src/chat/chat.controller.ts && echo "Rate limit guard applied to all protected controllers"</automated>
  </verify>
  <done>Rate limiting implemented as guard, applied to all protected endpoints</done>
</task>

<task type="auto">
  <name>Task 9: Document versioning (soft deletes and cascade)</name>
<files>
    prisma/schema.prisma
    src/documents/documents.service.ts
    src/documents/documents.controller.ts
  </files>
  <action>
    Implement document versioning per QUAL-02 (though Phase 3, foundation in Phase 1):

    Approach: Immutable upload history - every upload creates new Document record. No updating of existing documents. Deletion is soft delete (set deleted_at) with retention period. Actual deletion (purge) can be background job later.

    Update Document model in schema.prisma if not already:
    ```prisma
    model Document {
      id              Int      @id @default(autoincrement())
      tenant_id       Int
      user_id         Int
      filename        String
      mimetype        String
      size            Int
      status          DocumentStatus
      error_message   String?
      deleted_at      DateTime?
      created_at      DateTime @default(now())
      updated_at      DateTime @updatedAt
      chunks          DocumentChunk[]

      @@index([tenant_id])
      @@index([user_id])
      @@index([deleted_at])
    }

    enum DocumentStatus {
      queued
      processing
      indexed
      error
    }
    ```

    Ensure DocumentChunk has document_id foreign key with onDelete: Cascade (so chunk cleanup on hard delete). Soft delete just marks document.deleted_at; queries filter out deleted documents.

    Update DocumentsService:
    - listDocuments: where { tenant_id, deleted_at: null }
    - deleteDocument: soft delete → prisma.document.update({ where: { id, tenant_id }, data: { deleted_at: new Date() } })
      Also trigger background job to delete Qdrant points (or do immediately)
    - Hard purge: separate admin method (not in Phase 1)

    Verify: Soft delete sets deleted_at; list excludes deleted documents.
  </action>
  <verify>
    <automated>grep -q "deleted_at" prisma/schema.prisma && grep -q "deleted_at: null" src/documents/documents.service.ts && echo "Document versioning with soft delete implemented"</automated>
  </verify>
  <done>Document soft delete and filtering implemented (versioning foundation)</done>
</task>

<task type="auto">
  <name>Task 10: Finalize all imports and compile check</name>
<files>
    src/app/app.module.ts
    src/shared/module-barrel.ts (optional)
</files>
  <action>
    Final review: Ensure all modules imported correctly in AppModule in right order:

    ```typescript
    imports: [
      ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
      DatabaseModule,
      RedisModule,
      QdrantModule,
      AuthModule,
      DocumentsModule,
      ChatModule,
    ]
    ```

    Also verify that all guards/services are provided in respective modules (AuthModule provides TenantContextGuard; DocumentsModule provides RateLimitGuard; ChatModule provides its guards).

    Run TypeScript compile: `npm run build` should succeed without errors. Fix any import/export issues.

    Create a barrel file for shared modules to simplify imports (optional): src/shared/shared.module.ts that re-exports all shared services/middleware.

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
- QUAL-03: Citation validation already implemented in Plan 05
- QUAL-04: Rate limiting per user (RateLimitGuard)
- QUAL-05: Encryption service for sensitive data at rest (API keys in later phases, but service ready)

**Additional quality:**
- Audit logging (QUAL-01) addressed via AuditLog table and middleware
- Document versioning (QUAL-02) foundation: soft delete, deleted_at filtering
- Structured logging with winston and interceptor
- Global exception filter for consistent error responses
- Security headers via helmet

**Critical checks:**
- RateLimitGuard runs AFTER JwtAuthGuard (order in @UseGuards matters: JwtAuthGuard, RateLimitGuard)
- AuditLog must respect RLS tenant isolation (tenant_id field present, foreign key to tenant table if exists; or at minimum set tenant_id from context)
- Encryption key: ENCRYPTION_KEY must be long random string (32+ bytes). Recommend generating: `openssl rand -base64 32`
- Middleware order: RateLimitGuard on each controller; AuditMiddleware global (runs after response); LoggingInterceptor global (logs request start/complete)

**Performance:**
- Rate limiting uses Redis → O(1) operations, negligible overhead
- Audit logging fire-and-forget: async, doesn't block response; but ensure connection pool has capacity
- Compression? Could add compress middleware (compression) for responses

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
- [ ] Soft delete implemented: document.deleted_at filters from list queries; cascade cleanup of chunks
- [ ] All protected controllers (Auth, Documents, Chat) include `@UseGuards(..., RateLimitGuard)`
- [ ] Global middleware order: ValidationPipe → LoggingInterceptor → HttpExceptionFilter → RateLimitGuard(per route) → AuditMiddleware
- [ ] Helmet enabled for security headers
- [ ] Full test suite passes: `npm test` with ≥80% coverage

**Deployment readiness:**
- [ ] ENCRYPTION_KEY, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS documented in .env.example (from Plan 01)
- [ ] PostgreSQL connection supports RLS (migrations 001, 002 applied)
- [ ] Redis connected for rate limiting
- [ ] Winston logs structured for aggregation (JSON fields: timestamp, level, message, additional)

**File count:**
This wave creates ~8 new files and modifies ~4 existing files (app.module, main.ts, controllers, documents service for soft delete).

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-06-PLAN-06-summary.md`
</output>
