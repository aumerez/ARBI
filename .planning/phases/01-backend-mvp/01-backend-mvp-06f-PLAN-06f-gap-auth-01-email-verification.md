---
phase: 01-backend-mvp
plan: 06f
subsystem: gap-auth-01-email-verification
tags:
  - gap-closure
  - auth
  - email-verification
depends_on:
  - 06e
files_modified:
  - src/auth/auth.service.ts
  - src/auth/auth.controller.ts
  - src/shared/infrastructure/email.service.ts
  - src/auth/dto/verify-email.dto.ts
  - prisma/migrations/003-add-email-verification-tokens.sql
autonomous: true
requirements:
  - AUTH-01
user_setup: []
must_haves:
  truths:
    - "Registration creates user with email_verified=false and sends verification email"
    - "Verification endpoint accepts token, validates, marks email_verified=true"
    - "Verified status required for protected actions (enforced by guard)"
  artifacts:
    - path: "src/shared/infrastructure/email.service.ts"
      provides: "Email service abstraction (SMTP/mocked for MVP)"
      contains:
        - "sendVerificationEmail(to, token) method"
        - "Configuration via environment variables (MAIL_HOST, MAIL_PORT, etc.)"
        - "Mock implementation for development"
      min_lines: 40
    - path: "src/auth/dto/verify-email.dto.ts"
      provides: "DTO for email verification request (token field)"
      min_lines: 10
    - path: "src/auth/auth.service.ts"
      provides: "Registration and verification business logic"
      contains:
        - "register(): creates user with email_verified=false, generates verification token, sends email"
        - "verifyEmail(token): validates token, sets email_verified=true, deletes token"
      min_lines: 50
    - path: "src/auth/auth.controller.ts"
      provides: "Auth endpoints"
      contains:
        - "POST /auth/register (creates user, sends verification email)"
        - "GET /auth/verify/:token (marks email verified)"
      min_lines: 40
    - path: "prisma/migrations/003-add-email-verification-tokens.sql"
      provides: "VerificationToken model migration"
      contains:
        - "CREATE TABLE VerificationToken with token (unique), userId (FK), expiresAt"
        - "RLS policy for tenant isolation"
      min_lines: 30
  key_links:
    - from: "Registration endpoint"
      to: "Email service"
      pattern: "emailService.sendVerificationEmail"
    - from: "Verification endpoint"
      to: "VerificationToken model"
      pattern: "prisma.verificationToken"
    - from: "Auth guard"
      to: "email_verified check"
      pattern: "email_verified"
---

<objective>
Implement email verification flow for user registration (AUTH-01)

Purpose: Users must verify email before full account access. Prevents fake accounts, ensures communication channel.

Output: Email service, verification endpoint, token model, integration with registration
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
  <name>Task 1: Create EmailService and VerificationToken model</name>
  <files>
    src/shared/infrastructure/email.service.ts
    prisma/migrations/003-add-email-verification-tokens.sql
  </files>
  <behavior>
    - Test 1: EmailService.sendVerificationEmail(to, token) sends email via SMTP (or mock)
    - Test 2: VerificationToken model stores token, userId, expiresAt with unique constraint
    - Test 3: RLS policy enforces tenant_id isolation on VerificationToken
  </behavior>
  <action>
    Create EmailService with sendVerificationEmail(to, token). Use nodemailer for SMTP or mock for dev. Create Prisma migration adding VerificationToken model (token VARCHAR(255) UNIQUE, userId FK User, tenant_id FK Tenant, expiresAt DateTime). Apply migration with `npx prisma migrate dev`.
  </action>
  <verify>
    <automated>
      grep -q "sendVerificationEmail" src/shared/infrastructure/email.service.ts &&
      grep -q "VerificationToken" prisma/schema.prisma &&
      echo "Email service and token model defined"
    </automated>
  </verify>
  <done>EmailService and VerificationToken model added</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement registration with verification email</name>
  <files>
    src/auth/auth.service.ts
    src/auth/auth.controller.ts
  </files>
  <behavior>
    - Test 1: register(dto) creates user with email_verified=false, hashes password
    - Test 2: Generates secure random token (crypto.randomUUID), stores in VerificationToken with 24h expiry
    - Test 3: Calls emailService.sendVerificationEmail(user.email, token)
    - Test 4: Returns user without sensitive fields, includes message "Check your email to verify"
  </behavior>
  <action>
    Update AuthService.register(): create user (email_verified=false), generate verification token, send email, return user DTO. Update AuthController to expose POST /auth/register. Add verify-email.dto.ts for token input (if needed for resend).
  </action>
  <verify>
    <automated>
      grep -q "email_verified.*false" src/auth/auth.service.ts &&
      grep -q "VerificationToken" src/auth/auth.service.ts &&
      grep -q "POST.*register" src/auth/auth.controller.ts &&
      echo "Registration with verification implemented"
    </automated>
  </verify>
  <done>Registration endpoint sends verification email</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Implement email verification endpoint</name>
  <files>
    src/auth/auth.service.ts
    src/auth/auth.controller.ts
  </files>
  <behavior>
    - Test 1: verifyEmail(token) finds valid unexpired token, marks user.email_verified=true, deletes token
    - Test 2: Returns 200 with success message or redirects to frontend
    - Test 3: Invalid/expired token returns 404 with error message
    - Test 4: Already verified user returns 200 with message "Already verified"
  </behavior>
  <action>
    Add AuthService.verifyEmail(token): lookup VerificationToken, validate expiry, find user, set email_verified=true, delete token, return result. Add GET /auth/verify/:token endpoint in AuthController that calls service and returns JSON or redirects.
  </action>
  <verify>
    <automated>
      grep -q "verifyEmail" src/auth/auth.service.ts &&
      grep -q "GET.*verify.*:token" src/auth/auth.controller.ts &&
      grep -q "email_verified.*true" src/auth/auth.service.ts &&
      echo "Verification endpoint implemented"
    </automated>
  </verify>
  <done>Email verification endpoint works</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Enforce verified email for protected actions</name>
  <files>
    src/auth/guards/verified.guard.ts
    src/auth/auth.guard.ts (if enhanced)
  </files>
  <behavior>
    - Test 1: Guard allows request if req.user.email_verified=true
    - Test 2: Guard blocks with 403 if email_verified=false
    - Test 3: Guard skips for public routes (configurable)
  </behavior>
  <action>
    Create VerifiedGuard implementing CanActivate. Check req.user.email_verified from JwtAuthGuard. Apply to protected endpoints or integrate into JwtAuthGuard. Update any protected routes to use @UseGuards(JwtAuthGuard, VerifiedGuard).
  </action>
  <verify>
    <automated>
      grep -q "email_verified" src/auth/guards/verified.guard.ts &&
      grep -q "CanActivate" src/auth/guards/verified.guard.ts &&
      echo "Verified guard enforces email confirmation"
    </automated>
  </verify>
  <done>Verified guard blocks unverified users</done>
</task>

</tasks>

<verification>
Wave 6f closes AUTH-01 email verification gap.
Verify:
1. Unit tests: registration sends email, verification marks user, guard blocks unverified
2. Integration: register → receive email (mocked) → verify token → user.email_verified === true
3. API contract: endpoints return expected status codes and messages
4. RLS: VerificationToken queries scoped by tenant_id
5. TypeScript compiles: `npx tsc --noEmit`
</verification>

<success_criteria>
AUTH-01 complete when:
- [ ] User can register and receives verification email (mocked or real)
- [ ] Verification endpoint validates token and marks email_verified
- [ ] Unverified users blocked from protected actions (403)
- [ ] All tests pass
- [ ] TypeScript compiles
</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-06f-summary.md`

</output>
