---
phase: 01-backend-mvp
plan: 03b
subsystem: authentication
tags: [passport, jwt, bcrypt, multi-tenant]
depends_on:
  - 03a
provides:
  - LocalStrategy (passport-local)
  - JwtStrategy (passport-jwt)
  - AuthService stub methods
requires:
  - AuthService full implementation (03c)
  - JwtAuthGuard (03d)
  - AuthController (03e)
tech_stack_added:
  - @nestjs/passport
  - passport
  - passport-local
  - passport-jwt
  - bcrypt
tech_stack_patterns:
  - Passport strategy pattern
  - Token extraction from cookies and headers
  - Tenant-aware JWT validation
key_files:
  created:
    - src/auth/strategies/local.strategy.ts
    - src/auth/strategies/jwt.strategy.ts
    - src/auth/strategies/local.strategy.spec.ts
    - src/auth/strategies/jwt.strategy.spec.ts
    - src/auth/auth.service.ts (stub)
  modified:
    - src/auth/types/user.entity.ts (added password_hash)
decisions:
  - Added password_hash to User interface for internal authentication use, despite being excluded from API responses
  - Used bcrypt via AuthService.validatePassword to keep hashing logic centralized in 03c
  - JWT secret sourced from environment variable `JWT_SECRET`
  - Token extraction supports both httpOnly cookies and Authorization header for flexibility
deviations:
  - None from the plan's core objectives; User interface adjustment was necessary for correctness
metrics:
  tasks_completed: 2
  files_created: 5
  duration: ~25 minutes
  commit_count: 2
  tests_added: 9
  tests_passed: 9
---

# Phase 1 Backend MVP: Plan 03b - Authentication Strategies

## One-liner

Implemented Passport Local and JWT strategies with tenant context validation, supporting both cookie and header token extraction.

## Tasks Completed

### Task 1: Implement LocalStrategy (TDD: 4 passing tests)

Created `src/auth/strategies/local.strategy.ts`:
- Extends `PassportStrategy(Strategy)` from `@nestjs/passport`
- Configures `usernameField: 'email'`, `passwordField: 'password'`
- Injects `AuthService` for user validation
- `validate()` method:
  - Calls `authService.validateUserByEmail(email)`
  - Throws `UnauthorizedException` if user not found
  - Calls `authService.validatePassword(password, user.password_hash)`
  - Throws `UnauthorizedException` on password mismatch
  - Returns user object excluding `password_hash`

### Task 2: Implement JwtStrategy (TDD: 5 passing tests)

Created `src/auth/strategies/jwt.strategy.ts`:
- Extends `PassportStrategy(Strategy)` from `passport-jwt`
- Configures `jwtFromRequest` using `ExtractJwt.fromExtractors`:
  - Extracts token from `req.cookies.access_token` (httpOnly cookie) OR `Authorization: Bearer <token>` header
- `ignoreExpiration: false` (enforces token expiry)
- `secretOrKey: process.env.JWT_SECRET`
- `passReqToCallback: true`
- `validate(req, payload)` method:
  - Throws `UnauthorizedException` if `payload.tenant_id` missing
  - Calls `authService.validateUser(payload.sub)`
  - Throws if user not found or user.tenant_id mismatch
  - Returns `{ userId, email, tenantId }`

## Auto-Fixes Applied

### Rule 1 - Bug Fixed
- **Issue**: `User` interface lacked `password_hash` field, preventing strategy from accessing it for validation
- **Fix**: Added optional `password_hash?: string` to `src/auth/types/user.entity.ts`
- **Reason**: Internal authentication logic needs access to hashed password; the field is still excluded from API responses via serialization

### Rule 3 - Blocking Issue Resolved
- **Issue**: `AuthService` not implemented yet (plan 03c dependency)
- **Fix**: Created minimal `AuthService` stub with required methods: `validateUserByEmail`, `validateUser`, `validatePassword`
- **Impact**: Allows strategies to compile and tests to run; full implementation will be added in 03c

## Verification

- ✅ Both strategy files compile without TypeScript errors: `npx tsc --noEmit src/auth/strategies/*.ts`
- ✅ All 9 tests pass (4 LocalStrategy + 5 JwtStrategy)
- ✅ Strategies implement `PassportStrategy` interface correctly
- ✅ Token extraction configured for both cookie and header
- ✅ Tenant context validated in JwtStrategy

## Security Considerations

- **JWT SECRET**: Must be a strong (≥256-bit) random string stored in environment variable; rotate periodically
- **Cookie security**: httpOnly cookies recommended for web clients to prevent XSS theft
- **Tenant isolation**: JwtStrategy validates that user's tenant_id matches payload to prevent tenant impersonation
- **Password handling**: `password_hash` is never returned to clients (stripped via object destructuring)

## Dependencies and Next Steps

- **Depends on**: Plan 03a (types, DTOs, decorators) ✓
- **Provides**: Strategies ready for use with guards
- **Next plans**:
  - 03c: Implement full `AuthService` with register, login, logout, password reset
  - 03d: Create `JwtAuthGuard` and integrate with controllers
  - 03e: Implement `AuthController` using LocalStrategy and JwtStrategy

## Quality Gates

- ✅ TypeScript strict mode: all strategies type-check
- ✅ Test coverage: 9 tests covering success and failure scenarios
- ✅ Error handling: proper `UnauthorizedException` on all invalid conditions
- ✅ Logging: debug logs for JWT validation and info for credential checks

**No manual intervention required** — plan executed fully with TDD and all verifications passed.
