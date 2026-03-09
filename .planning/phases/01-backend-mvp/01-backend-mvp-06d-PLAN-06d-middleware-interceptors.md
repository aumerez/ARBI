---
phase: 01-backend-mvp
plan: 06d
type: execute
wave: 21
depends_on:
  - 06c
files_modified:
  - src/shared/middleware/tenant-validation.middleware.ts
  - src/shared/interceptors/logging.interceptor.ts
  - src/shared/filters/http-exception.filter.ts
  - src/main.ts
autonomous: true
requirements: []
user_setup: []
must_haves:
  truths:
    - "System applies tenant validation guard to all protected endpoints"
    - "System provides structured logging with request context via interceptor"
    - "HTTP exceptions are transformed into user-friendly error responses via global filter"
  artifacts:
    - path: "src/shared/middleware/tenant-validation.middleware.ts"
      provides: "Middleware that validates tenant exists and is active (defense-in-depth)"
      contains:
        - "Uses DatabaseService to check tenant exists"
        - "Rejects requests with 404 if tenant not found"
      min_lines: 30
    - path: "src/shared/interceptors/logging.interceptor.ts"
      provides: "NestJS interceptor for structured logging (Winston/Pino)"
      contains:
        - "Logs request method, URL, status, duration, user_id, tenant_id"
        - "Runs after response completes"
      min_lines: 40
    - path: "src/shared/filters/http-exception.filter.ts"
      provides: "Global exception filter converting errors to user-friendly JSON"
      contains:
        - "Catches HttpException and other exceptions"
        - " Returns standardized error format: { statusCode, message, error }"
        - "Excludes stack traces in production"
      min_lines: 30
  key_links:
    - from: "src/shared/middleware/tenant-validation.middleware.ts"
      to: "src/shared/database/database.service.ts"
      via: "db.tenant.findUnique()"
      pattern: "prisma\\.tenant"
    - from: "src/shared/interceptors/logging.interceptor.ts"
      to: "AppModule"
      via: "useGlobalInterceptors"
      pattern: "useGlobalInterceptors"
    - from: "src/shared/filters/http-exception.filter.ts"
      to: "AppModule"
      via: "useGlobalFilters"
      pattern: "useGlobalFilters"
    - from: "src/main.ts"
      to: "AppModule"
      via: "app.useGlobalFilters"
      pattern: "app\\.useGlobalFilters"

---

<objective>
Add cross-cutting middleware, interceptors, and filters

Purpose: Provide tenant validation, structured logging, and user-friendly error handling across the application.

Output: Tenant validation middleware, logging interceptor, HTTP exception filter, global registration
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
  <name>Task 1: Tenant validation middleware</name>
  <files>
    src/shared/middleware/tenant-validation.middleware.ts
  </files>
  <behavior>
    - Test 1: Middleware extracts tenant_id from request (JWT payload or subdomain)
    - Test 2: Queries DatabaseService to verify tenant exists and is active
    - Test 3: If tenant invalid, returns 404 Unauthorized
    - Test 4: If valid, calls next() and attaches tenant to request
  </behavior>
  <action>
    Create TenantValidationMiddleware:
    - Implements NestMiddleware
    - Inject DatabaseService
    - In use(req, res, next): extract tenantId from request (JWT payload set by JwtAuthGuard)
    - Query: db.tenant.findUnique({ where: { id: tenantId } })
    - If not found or error: return res.status(404).json({ statusCode: 404, message: 'Tenant not found' })
    - If valid: req.tenant = tenant; next()
    - Apply globally after JWT guard (or use guard instead)
  </action>
  <verify>
    <automated>grep -q "TenantValidationMiddleware" src/shared/middleware/tenant-validation.middleware.ts && grep -q "db\\.tenant" src/shared/middleware/tenant-validation.middleware.ts && echo "Tenant validation middleware defined"</automated>
  </verify>
  <done>TenantValidationMiddleware added</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Logging interceptor</name>
  <files>
    src/shared/interceptors/logging.interceptor.ts
  </files>
  <behavior>
    - Test 1: Interceptor logs request start with method and URL
    - Test 2: After response, logs status, duration, response size
    - Test 3: Logs include tenant_id and user_id from request context
    - Test 4: Uses structured logger (Winston/Pino) with consistent format
  </behavior>
  <action>
    Create LoggingInterceptor:
    - Implements NestInterceptor
    - In intercept(context, next):
      * Record start time
      * Wait for response: response = await next.handle()
      * On response finish event: log { method, url, status, duration_ms, content_length, user_id, tenant_id }
      * Use logger.info with structured JSON output
    - Register globally in AppModule
  </action>
  <verify>
    <automated>grep -q "LoggingInterceptor" src/shared/interceptors/logging.interceptor.ts && grep -q "next\\.handle" src/shared/interceptors/logging.interceptor.ts && echo "Logging interceptor structured"</automated>
  </verify>
  <done>LoggingInterceptor implemented</done>
</task>

<task type="auto">
  <name>Task 3: Global HTTP exception filter</name>
  <files>
    src/shared/filters/http-exception.filter.ts
    src/main.ts
  </files>
  <behavior>
    - Test 1: Filter catches HttpException and returns JSON with statusCode, message, error (if dev)
    - Test 2: Unknown exceptions return 500 with generic message (no stack in prod)
    - Test 3: Filter applied globally to all routes
  </behavior>
  <action>
    Create HttpExceptionFilter:
    - Implements ExceptionFilter (`catch(exception: any, host: ArgumentsHost)`)
    - Determine statusCode: exception.response?.status || exception.getStatus ? exception.getStatus() : 500
    - Message: exception.message || 'Internal server error'
    - Response: return json({ statusCode, message, ...(env.NODE_ENV !== 'production' && { error: exception.stack }) })
    - In main.ts: `app.useGlobalFilters(new HttpExceptionFilter())`
  </action>
  <verify>
    <automated>grep -q "implements ExceptionFilter" src/shared/filters/http-exception.filter.ts && grep -q "useGlobalFilters" src/main.ts && grep -q "HttpExceptionFilter" src/main.ts && echo "Global exception filter installed"</automated>
  </verify>
  <done>Global exception filter configured</done>
</task>

</tasks>

<verification>
Wave 5d completes middleware/interceptors.
Verify:
1. Middleware test: simulate request without tenant → 404; with valid tenant → passes
2. Interceptor test: mock response, verify log called with expected fields
3. Filter test: throw HttpException(400, 'bad'), verify JSON response has statusCode 400
4. Compile: `npm run build` ensures no circular dependencies
</verification>

<success_criteria>
Cross-cutting middleware ready when:
- [ ] TenantValidationMiddleware rejects invalid tenants
- [ ] LoggingInterceptor produces structured logs with request context
- [ ] HttpExceptionFilter globally applied and returns consistent JSON error format
- [ ] All three integrate into AppModule/main.ts without errors
- [ ] Tests pass
</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-06d-summary.md`