---
phase: 01-backend-mvp
plan: 06g
subsystem: gap-auth-02-refresh-token
tags:
  - gap-closure
  - auth
  - refresh-token
depends_on:
  - 06e
files_modified:
  - src/auth/auth.service.ts
  - src/auth/auth.controller.ts
  - src/auth/strategies/jwt.strategy.ts (if needed)
autonomous: true
requirements:
  - AUTH-02
user_setup: []
must_haves:
  truths:
    - "User receives access token (15min) and refresh token (7d) on login"
    - "Refresh endpoint validates refresh token, rotates both tokens (new access + refresh)"
    - "Old refresh token invalidated; new refresh token stored hashed in DB"
    - "Refresh endpoint returns new tokens or 401 on invalid"
  artifacts:
    - path: "src/auth/auth.service.ts"
      provides: "Refresh token rotation logic"
      contains:
        - "refreshTokens(userId, oldRefreshTokenHash): validate old token, generate new access and refresh tokens, store new refresh hash, delete old"
      min_lines: 30
    - path: "src/auth/auth.controller.ts"
      provides: "POST /auth/refresh endpoint"
      contains:
        - "Extract refresh token from Authorization header or body"
        - "Call authService.refreshTokens()"
        - "Return { accessToken, refreshToken }"
      min_lines: 25
    - path: "src/auth/strategies/jwt.strategy.ts"
      provides: "JWT validation for refresh tokens (same strategy)"
      contains:
        - "Passport strategy that validates refresh token as JWT"
      min_lines: 20
  key_links:
    - from: "refresh endpoint"
      to: "authService.refreshTokens"
      pattern: "refreshTokens"
    - from: "refreshTokens"
      to: "RefreshToken model"
      pattern: "prisma.refreshToken"
    - from: "Refresh token storage"
      to: "bcrypt hashing"
      pattern: "bcrypt.compare"
---

<objective>
Complete refresh token rotation endpoint (AUTH-02)

Purpose: Users can maintain long-lived sessions (7 days) without re-login via secure refresh token rotation.

Output: Working /auth/refresh endpoint with token rotation and invalidation
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

<task type="auto" tdd="true">
  <name>Task 1: Implement refreshTokens service method</name>
  <files>
    src/auth/auth.service.ts
  </files>
  <behavior>
    - Test 1: Method accepts userId and oldRefreshTokenHash (plain text from header)
    - Test 2: Finds matching RefreshToken record by userId, compares bcrypt hash
    - Test 3: If valid: generates new access token (15min) and new refresh token (7d), stores new refresh hash, deletes old record, returns tokens
    - Test 4: If invalid: throws UnauthorizedException
  </behavior>
  <action>
    Implement AuthService.refreshTokens(userId, plainRefreshToken): find RefreshToken for userId, bcrypt.compare(plain, hash), if valid generate new tokens via providerFactory, store new refresh hash, delete old, return tokens.
  </action>
  <verify>
    <automated>
      grep -q "refreshTokens" src/auth/auth.service.ts &&
      grep -q "bcrypt.compare" src/auth/auth.service.ts &&
      echo "Refresh token rotation logic implemented"
    </automated>
  </verify>
  <done>Refresh token rotation in AuthService</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement POST /auth/refresh endpoint</name>
  <files>
    src/auth/auth.controller.ts
  </files>
  <behavior>
    - Test 1: Endpoint extracts refresh token from Authorization: Bearer <token> or body
    - Test 2: Extracts userId from JWT payload (from JwtAuthGuard)
    - Test 3: Calls authService.refreshTokens() and returns { accessToken, refreshToken }
    - Test 4: Unauthorized → 401, success → 200
  </behavior>
  <action>
    Add POST /auth/refresh in AuthController. Use @UseGuards(JwtAuthGuard) to ensure JWT valid. Extract user from req.user. Get refresh token from header. Call authService.refreshTokens(user.id, refreshToken). Return tokens.
  </action>
  <verify>
    <automated>
      grep -q "POST.*refresh" src/auth/auth.controller.ts &&
      grep -q "authService.refreshTokens" src/auth/auth.controller.ts &&
      echo "Refresh endpoint wired"
    </automated>
  </verify>
  <done>Refresh endpoint implemented</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Fix logout to delete refresh token</name>
  <files>
    src/auth/auth.service.ts
  </files>
  <behavior>
    - Test: logout(userId) deletes RefreshToken record(s) for that user (bcrypt.hash check not needed as we store token; we should delete by hash)
  </behavior>
  <action>
    Ensure AuthService.logout() properly deletes RefreshToken for user (currently might use bcrypt loop; simplify: delete all refresh tokens for user). Confirm implementation matches existing test expectations.
  </action>
  <verify>
    <automated>
      grep -q "logout" src/auth/auth.service.ts &&
      grep -q "prisma.refreshToken" src/auth/auth.service.ts &&
      echo "Logout deletes refresh token"
    </automated>
  </verify>
  <done>Logout cleans up refresh token</done>
</task>

</tasks>

<verification>
Wave 6g closes AUTH-02 refresh token gap.
Verify:
1. Unit tests: refreshTokens validates bcrypt hash, returns tokens, deletes old; invalid → 401
2. Integration: login → get refresh token → call /auth/refresh with it → new tokens returned, old invalidated
3. Token lifetimes: access 15min, refresh 7d (check expiry dates)
4. Compilation: `npx tsc --noEmit`
</verification>

<success_criteria>
AUTH-02 complete when:
- [ ] Refresh endpoint returns new access + refresh tokens
- [ ] Old refresh token invalidated (rotation)
- [ ] Invalid refresh → 401
- [ ] Tests pass
- [ ] TypeScript compiles
</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-06g-summary.md`

</output>
