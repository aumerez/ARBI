---
phase: 01-backend-mvp
plan: 06c
type: execute
wave: 20
depends_on:
  - 06b
files_modified:
  - src/shared/infrastructure/rate-limiter.service.ts
  - src/shared/guards/rate-limit.guard.ts
  - src/shared/middleware/rate-limit.middleware.ts
autonomous: true
requirements:
  - QUAL-04
user_setup: []
must_haves:
  truths:
    - "System implements per-user rate limiting to prevent API abuse"
    - "RateLimitGuard can be applied to protected controllers (Auth, Documents, Chat)"
    - "Rate limits are configurable: default 60 requests per 60 seconds per user"
    - "When limit exceeded, returns 429 with Retry-After header"
  artifacts:
    - path: "src/shared/services/rate-limiter.service.ts"
      provides: "Rate limiting service using rate-limiter-flexible with Redis"
      contains:
        - "class RateLimiterService { checkLimit(userId: number, points: number, duration: number): Promise<boolean> }"
        - "Uses Redis sliding window algorithm"
        - "Returns { remaining, reset, limit }"
      min_lines: 40
    - path: "src/shared/guards/rate-limit.guard.ts"
      provides: "NestJS guard enforcing rate limits"
      contains:
        - "implements CanActivate"
        - "injects RateLimiterService"
        - "calls checkLimit(req.user.userId)"
        - "throws 429 if limit exceeded"
      min_lines: 30
    - path: "src/shared/middleware/rate-limit.middleware.ts"
      provides: "Optional middleware for route-based rate limiting"
      contains:
        - "Middleware that can apply different limits per route"
      min_lines: 20
  key_links:
    - from: "src/shared/guards/rate-limit.guard.ts"
      to: "src/shared/infrastructure/redis.service.ts"
      via: "RateLimiterService uses Redis"
      pattern: "Redis"
    - from: "src/shared/guards/rate-limit.guard.ts"
      to: "protected controllers"
      via: "@UseGuards(RateLimitGuard)"
      pattern: "RateLimitGuard"
    - from: "src/shared/middleware/rate-limit.middleware.ts"
      to: "RateLimiterService"
      via: "limiter.check()"

---

<objective>
Implement rate limiting to prevent API abuse

Purpose: Protect backend from excessive requests per user. Enforce fair usage and prevent DoS.

Output: RateLimiterService, RateLimitGuard, and middleware configuration
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
  <name>Task 1: Implement RateLimiterService</name>
  <files>
    src/shared/infrastructure/rate-limiter.service.ts
  </files>
  <behavior>
    - Test 1: Service tracks request counts correctly using Redis sliding window
    - Test 2: checkLimit returns false when limit exceeded
    - Test 3: Returns true and decrements remaining count within limit
    - Test 4: Handles Redis errors gracefully (fail open: allow request)
  </behavior>
  <action>
    Create RateLimiterService:
    - Use `rate-limiter-flexible` library with Redis client
    - Configuration: DEFAULT_WINDOW = 60 seconds, DEFAULT_POINTS = 60 requests
    - Method: async checkLimit(userId: number, points: number = 60, duration: number = 60): Promise<boolean>
      * Use Redis key: `rate-limit:${userId}`
      * Use `this.limiter.consume(key, points)` which returns { remaining, reset }
    - Provide getRemaining(userId) for monitoring
    - Error handling: if Redis down, return true (allow) and log warning
  </action>
  <verify>
    <automated>grep -q "RateLimiter" src/shared/infrastructure/rate-limiter.service.ts && grep -q "consume" src/shared/infrastructure/rate-limiter.service.ts && echo "RateLimiterService structure defined"</automated>
  </verify>
  <done>RateLimiterService implemented</done>
</task>

<task type="auto">
  <name>Task 2: Create RateLimitGuard</name>
  <files>
    src/shared/guards/rate-limit.guard.ts
  </files>
  <action>
    Create NestJS guard:
    - Implements CanActivate interface
    - Injects RateLimiterService and optionally ConfigService (for per-route limits)
    - In canActivate(context: ExecutionContext):
      * Extract user_id from request.user (set by JWT auth guard)
      * Determine limit: from route metadata (e.g., @RateLimit(100, 60)) or default
      * Call rateLimiterService.checkLimit(userId, points)
      * If false: throw new UnauthorizedException('Rate limit exceeded') with 429 status and Retry-After header
      * If true: return true
    - Add helper decorator: @UseGuards(RateLimitGuard) for easy application
  </action>
  <verify>
    <automated>grep -q "implements CanActivate" src/shared/guards/rate-limit.guard.ts && grep -q "RateLimiterService" src/shared/guards/rate-limit.guard.ts && echo "RateLimitGuard defined"</automated>
  </verify>
  <done>RateLimitGuard ready for controller protection</done>
</task>

<task type="auto">
  <name>Task 3: Document rate limit configuration</name>
  <files>
    README.md
  </files>
  <action>
    Update README with rate limiting configuration:
    - Environment variable: RATE_LIMIT_WINDOW=60, RATE_LIMIT_MAX=60
    - Explain per-user limits and how to customize per-route
    - Note: Rate limit applies to authenticated endpoints via RateLimitGuard
  </action>
  <verify>
    <automated>grep -q "RATE_LIMIT" README.md && echo "Rate limiting documented"</automated>
  </verify>
  <done>Rate limiting configuration documented</done>
</task>

</tasks>

<verification>
Wave 5c completes rate limiting.
Verify:
1. Unit test for RateLimiterService with mock Redis: simulate 61 requests → 61st returns false
2. Guard test: simulate request with user_id, verify 429 thrown after limit
3. Integration: Apply guard to AuthController, send 61 requests, verify 429 on 61st with Retry-After header
4. Check Redis keys: `KEYS "rate-limit:*"` show per-user counters
</verification>

<success_criteria>
Rate limiting functional when:
- [ ] RateLimiterService.checkLimit returns false after threshold crossed
- [ ] RateLimitGuard throws 429 with Retry-After header when limit exceeded
- [ ] Guard can be applied to Auth, Documents, Chat controllers
- [ ] Configuration via env vars works (RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)
- [ ] Unit and integration tests pass
</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-06c-summary.md`