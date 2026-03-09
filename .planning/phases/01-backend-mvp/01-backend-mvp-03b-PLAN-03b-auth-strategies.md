---
phase: 01-backend-mvp
plan: 03b
type: execute
wave: 11
depends_on:
  - 03a
files_modified:
  - src/auth/strategies/local.strategy.ts
  - src/auth/strategies/jwt.strategy.ts
autonomous: true
requirements:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04
user_setup: []
must_haves:
  truths:
    - "LocalStrategy validates email/password against database using bcrypt"
    - "LocalStrategy throws UnauthorizedException for invalid credentials"
    - "JwtStrategy validates JWT signature with JWT_SECRET"
    - "JwtStrategy extracts tenant_id from payload and returns validated user object"
    - "JwtStrategy rejects expired tokens"
    - "Both strategies implement Passport Strategy interface correctly"
  artifacts:
    - path: "src/auth/strategies/local.strategy.ts"
      provides: "Passport LocalStrategy for email/password authentication"
      min_lines: 30
      contains:
        - "extends PassportStrategy(Strategy)"
        - "validate(email, password) returns user object or throws UnauthorizedException"
        - "bcrypt.compare used for password verification"
    - path: "src/auth/strategies/jwt.strategy.ts"
      provides: "Passport JWT strategy for token validation"
      min_lines: 30
      contains:
        - "extends PassportStrategy(Strategy)"
        - "jwtFromRequest extracts token from cookie OR Authorization header"
        - "validate(req, payload) calls AuthService.validateUser and checks tenant_id"
        - "Throws UnauthorizedException if user not found or tenant_id missing"
  key_links:
    - from: "src/auth/strategies/local.strategy.ts"
      to: "AuthService.validateUserByEmail"
      via: "validate method calls authService.validateUserByEmail"
      pattern: "validateUserByEmail"
    - from: "src/auth/strategies/jwt.strategy.ts"
      to: "JwtPayload and AuthService"
      via: "validate returns { userId, email, tenantId }"
      pattern: "validate\\(.*payload.*\\)"
    - from: "AuthController login endpoint"
      to: "LocalStrategy"
      via: "@UseGuards(LocalStrategy)"
      pattern: "LocalStrategy"

---

<objective>
Implement Passport authentication strategies (Local and JWT)

Purpose: Create Local strategy for credential validation during login and JWT strategy for token validation on subsequent requests. Both strategies integrate with AuthService and validate tenant context.

Output: Working Passport strategies ready for use in guards and controllers

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

# Strategy implementation details:
- LocalStrategy: extends PassportStrategy(Strategy) from '@nestjs/passport' using passport-local
  * validate(email: string, password: string): Promise<User>
  * Find user by email + tenant_id? Note: tenant_id not in local strategy during login; tenant context comes from request body or subdomain? Actually RegisterDto includes tenant_id. For login, we need to know tenant. Options: include tenant_id in login body, or derive from email (unique across tenants? no). Requirement: Multi-tenant, so login must specify tenant. Simplify: add tenant_id to LoginDto. But DTO currently has only email/password. In original Plan 03 they may have used email to identify tenant. That requires email unique per tenant? Actually email unique globally? Could be. Simpler: require tenant_id in login request (e.g., header or body). For MVP, we can assume tenant_id is provided via separate header or query param? Better: include tenant_id in LoginDto as optional? But DTO defined earlier only has email,password. Let's check that DTO: LoginDto has email and password. No tenant_id. So how does LocalStrategy know tenant? It could extract from request (e.g., header X-Tenant-ID) or use a tenant lookup by email (assuming email unique per tenant). If email is globally unique, we can get user by email only and read tenant_id from user record. That works: user.email is unique (per schema). Then we can verify password and return user which includes tenant_id. That's acceptable: findUnique on email (unique constraint) returns user with tenant_id. So LocalStrategy can simply validate by email without tenant context. Good.

So LocalStrategy: validate(email, password) -> find user by email, bcrypt.compare, return user object (without password_hash). Use AuthService method like validateUserByEmail.

- JwtStrategy: extends PassportStrategy(Strategy) from 'passport-jwt'
  * Uses ExtractJwt.fromExtractors to get token from cookie OR Authorization header
  * validate(req, payload): payload should contain sub, email, tenant_id. Verify user exists by userId. Ensure payload.tenant_id exists. Return user object (or minimal {userId, tenantId, email}).
  * Must throw UnauthorizedException if any check fails.

# Dependencies:
- AuthService will have methods: validateUserByEmail(email) for LocalStrategy, validateUser(userId) for JwtStrategy.
- Need @nestjs/passport, passport, passport-local, passport-jwt packages (should be in package.json from research)

# Files: local.strategy.ts, jwt.strategy.ts in src/auth/strategies/

</context>

<tasks>

<task type="auto" tdd="true">
  <name="Task 1: Implement LocalStrategy</name>
  <files>
    src/auth/strategies/local.strategy.ts
  </files>
  <behavior>
    - Test 1: LocalStrategy extends PassportStrategy(Strategy) from '@nestjs/passport'
    - Test 2: Constructor injects AuthService and calls super with options: usernameField: 'email', passwordField: 'password'
    - Test 3: validate(email: string, password: string) calls authService.validateUserByEmail(email)
    - Test 4: If user not found, throws UnauthorizedException('Invalid credentials')
    - Test 5: Compares password with bcrypt.compare against user.password_hash
    - Test 6: If password mismatch, throws UnauthorizedException
    - Test 7: Returns user object without password_hash
  </behavior>
  <action>
    Create src/auth/strategies/local.strategy.ts:

    ```typescript
    import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
    import { PassportStrategy } from '@nestjs/passport';
    import { Strategy } from 'passport-local';
    import { AuthService } from '../auth.service';
    import { User } from '../types/user.entity';

    @Injectable()
    export class LocalStrategy extends PassportStrategy(Strategy) {
      private readonly logger = new Logger(LocalStrategy.name);

      constructor(private readonly authService: AuthService) {
        super({
          usernameField: 'email',
          passwordField: 'password',
          passReqToCallback: false,
        });
      }

      async validate(email: string, password: string): Promise<User> {
        this.logger.log(`Validating credentials for user: ${email}`);

        const user = await this.authService.validateUserByEmail(email);
        if (!user) {
          throw new UnauthorizedException('Invalid credentials');
        }

        const passwordValid = await this.authService.validatePassword(password, user.password_hash);
        if (!passwordValid) {
          throw new UnauthorizedException('Invalid credentials');
        }

        // Return user object (without password_hash) to be attached to req.user
        const { password_hash, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }
    }
    ```

    Note: AuthService needs method validateUserByEmail(email) returning User | null, and validatePassword(plain, hash) returning boolean.

    Verify: Strategy implements correct interface; uses bcrypt compare via AuthService.
  </action>
  <verify>
    <automated>
      grep -q "extends PassportStrategy" src/auth/strategies/local.strategy.ts &&
      grep -q "usernameField: 'email'" src/auth/strategies/local.strategy.ts &&
      grep -q "validateUserByEmail" src/auth/strategies/local.strategy.ts &&
      echo "LocalStrategy defined"
    </automated>
  </verify>
  <done>LocalStrategy with credential validation implemented</done>
</task>

<task type="auto" tdd="true">
  <name="Task 2: Implement JwtStrategy</name>
  <files>
    src/auth/strategies/jwt.strategy.ts
  </files>
  <behavior>
    - Test 1: JwtStrategy extends PassportStrategy(Strategy) from 'passport-jwt'
    - Test 2: Constructor calls super with options:
      * jwtFromRequest: ExtractJwt.fromExtractors([ (req) => req.cookies?.access_token || (req.headers.authorization?.split(' ')[1]) ])
      * ignoreExpiration: false
      * secretOrKey: process.env.JWT_SECRET
      * passReqToCallback: true
    - Test 3: validate(req, payload) extracts tenant_id from payload
    - Test 4: Calls authService.validateUser(payload.sub) to ensure user exists
    - Test 5: Throws UnauthorizedException if user not found
    - Test 6: Throws UnauthorizedException if payload.tenant_id missing
    - Test 7: Returns { userId, email, tenantId } (or full User) without password
  </behavior>
  <action>
    Create src/auth/strategies/jwt.strategy.ts:

    ```typescript
    import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
    import { PassportStrategy } from '@nestjs/passport';
    { Strategy, ExtractJwt } from 'passport-jwt';
    import { Request } from 'express';
    import { AuthService } from '../auth.service';
    import { JwtPayload } from '../types/jwt-payload.interface';

    @Injectable()
    export class JwtStrategy extends PassportStrategy(Strategy) {
      private readonly logger = new Logger(JwtStrategy.name);

      constructor(private readonly authService: AuthService) {
        super({
          jwtFromRequest: ExtractJwt.fromExtractors([
            (req: Request) => {
              // Extract from httpOnly cookie or Authorization header
              return req?.cookies?.access_token ??
                (req?.headers?.authorization?.split(' ')[1] ?? null);
            },
          ]),
          ignoreExpiration: false,
          secretOrKey: process.env.JWT_SECRET,
          passReqToCallback: true,
        });
      }

      async validate(req: Request, payload: any): Promise<{ userId: number; email: string; tenantId: number }> {
        this.logger.debug('Validating JWT token', { sub: payload.sub });

        // Ensure payload has tenant_id
        if (!payload.tenant_id) {
          throw new UnauthorizedException('Missing tenant context in token');
        }

        // Verify user exists (active)
        const user = await this.authService.validateUser(payload.sub);
        if (!user) {
          throw new UnauthorizedException('User not found');
        }

        // Additional check: ensure user.tenant_id matches payload.tenant_id (tampering check)
        if (user.tenant_id !== payload.tenant_id) {
          throw new UnauthorizedException('Tenant mismatch');
        }

        return {
          userId: user.id,
          email: user.email,
          tenantId: user.tenant_id,
        };
      }
    }
    ```

    Important: The return value becomes req.user. Controllers can access these fields.

    Verify: Strategy extracts token correctly; validates signature; returns user info with tenantId.
  </action>
  <verify>
    <automated>
      grep -q "extends PassportStrategy" src/auth/strategies/jwt.strategy.ts &&
      grep -q "ExtractJwt.fromExtractors" src/auth/strategies/jwt.strategy.ts &&
      grep -q "JWT_SECRET" src/auth/strategies/jwt.strategy.ts &&
      grep -q "validate(req, payload)" src/auth/strategies/jwt.strategy.ts &&
      echo "JwtStrategy defined"
    </automated>
  </verify>
  <done>JwtStrategy with cookie and header extraction implemented</done>
</task>

</tasks>

<verification>
Wave 2b - Authentication strategies complete

**Automated checks:**
1. LocalStrategy extends PassportStrategy; uses usernameField 'email'; validates against AuthService
2. JwtStrategy extends PassportStrategy; extracts token from cookie or Authorization header; uses JWT_SECRET; validates payload.tenant_id
3. Both strategies inject AuthService correctly
4. TypeScript compiles: `npx tsc --noEmit src/auth/strategies/*.ts`

**Integration:**
- LocalStrategy used by AuthController login endpoint with `@UseGuards(LocalStrategy)`
- JwtStrategy used by JwtAuthGuard (to be created in 03d) as `AuthGuard('jwt')`

**Security notes:**
- JWT secret must be strong (256-bit min) and kept in env
- Token extraction from httpOnly cookies protects against XSS
- Validate user exists before returning tokens (prevents token for deleted user)

</verification>

<success_criteria>
Strategies ready when:
- [ ] src/auth/strategies/local.strategy.ts implements passport-local with email/password
- [ ] src/auth/strategies/jwt.strategy.ts implements passport-jwt with cookie + header extraction
- [ ] Both strategies return user object without password_hash
- [ ] JwtStrategy validates tenant_id from payload and checks user.tenant_id matches
- [ ] AuthService methods validateUserByEmail and validatePassword exist to support strategies
- [ ] `npx tsc --noEmit` passes for strategies

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-03b-PLAN-03b-summary.md`
</output>
