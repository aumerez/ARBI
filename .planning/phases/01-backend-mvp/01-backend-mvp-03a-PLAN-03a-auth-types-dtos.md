---
phase: 01-backend-mvp
plan: 03a
type: execute
wave: 10
depends_on:
  - 02f
files_modified:
  - src/shared/decorators/tenant.decorator.ts
  - src/auth/types/jwt-payload.interface.ts
  - src/auth/types/user.entity.ts
  - src/auth/dto/login.dto.ts
  - src/auth/dto/register.dto.ts
  - src/auth/dto/password-reset.dto.ts
autonomous: true
requirements:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04
user_setup: []
must_haves:
  truths:
    - "Tenant decorator extracts tenant_id from JWT payload"
    - "JwtPayload interface has sub, email, tenant_id, iat, exp"
    - "User entity mirrors Prisma User model (without password_hash in responses)"
    - "LoginDto validates email and password"
    - "RegisterDto validates email, password (min 8), tenant_id"
    - "PasswordResetRequestDto and PasswordResetConfirmDto validate email and new password"
  artifacts:
    - path: "src/shared/decorators/tenant.decorator.ts"
      provides: "Custom param decorator @Tenant() to extract tenant_id from request"
      min_lines: 10
    - path: "src/auth/types/jwt-payload.interface.ts"
      provides: "JWT payload type for TypeScript"
      contains:
        - "sub: number"
        - "email: string"
        - "tenant_id: number"
        - "iat: number"
        - "exp: number"
    - path: "src/auth/types/user.entity.ts"
      provides: "User type/class excluding sensitive fields"
      contains:
        - "id: number"
        - "email: string"
        - "tenant_id: number"
        - "email_verified: boolean"
    - path: "src/auth/dto/login.dto.ts"
      provides: "Validation DTO for login (email, password)"
      contains: "@IsEmail() email", "@IsString() @MinLength(8) password"
    - path: "src/auth/dto/register.dto.ts"
      provides: "Validation DTO for registration"
      contains: "@IsInt() tenant_id", "@IsEmail() email", "@MinLength(8) password"
    - path: "src/auth/dto/password-reset.dto.ts"
      provides: "DTOs for password reset request and confirmation"
      contains: "PasswordResetRequestDto { @IsEmail() email }", "PasswordResetConfirmDto { token, @MinLength(8) newPassword }"
  key_links:
    - from: "src/shared/decorators/tenant.decorator.ts"
      to: "AuthController, DocumentsController, ChatController"
      via: "constructor(@Tenant() tenantId: number)"
      pattern: "@Tenant"
    - from: "src/auth/types/jwt-payload.interface.ts"
      to: "jwt.strategy.ts"
      via: "validate method returns JwtPayload"
      pattern: "JwtPayload"
    - from: "src/auth/dto/*.dto.ts"
      to: "AuthController methods"
      via: "@Body() dto: LoginDto"
      pattern: "@Body.*Dto"

---

<objective>
Create auth types, decorators, and DTOs for validation

Purpose: Define TypeScript interfaces for JWT payload and User entity. Create custom @Tenant() decorator to extract tenant ID from request. Define DTOs with class-validator decorators for all auth endpoints (login, register, password reset).

Output: Complete type definitions and validation DTOs for authentication module

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

# Type definitions needed:
- JwtPayload: extends TypeScript interface for what's stored in JWT. Must include tenant_id (critical for multi-tenancy)
- User entity: shape of User returned from database (exclude password_hash)
- Tenant decorator: param decorator extracting tenant_id from req.user (set by JWT guard)

# DTO validation requirements (from RESEARCH):
- LoginDto: email (isEmail), password (minLength 8)
- RegisterDto: email (isEmail), password (minLength 8), tenant_id (isInt)
- PasswordResetRequestDto: email (isEmail)
- PasswordResetConfirmDto: token (string), newPassword (minLength 8)

NestJS uses class-validator. DTOs are classes with decorator metadata. ValidationPipe will enforce at runtime.

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create Tenant decorator and types</name>
  <files>
    src/shared/decorators/tenant.decorator.ts
    src/auth/types/jwt-payload.interface.ts
    src/auth/types/user.entity.ts
  </files>
  <behavior>
    - Test 1: Tenant decorator returns req.user.tenant_id as number
    - Test 2: Throws error if req.user is null or tenant_id missing
    - Test 3: JwtPayload interface has all required fields (sub, email, tenant_id, iat, exp)
    - Test 4: User entity has id, email, tenant_id (no password_hash)
    - Test 5: User entity can be used in response serialization (exclude password)
  </behavior>
  <action>
    Create files:

    1. src/shared/decorators/tenant.decorator.ts:
    ```typescript
    import { createParamDecorator, ExecutionContext } from '@nestjs/common';
    import { JwtPayload } from '../../auth/types/jwt-payload.interface';

    export const Tenant = createParamDecorator(
      (data: unknown, ctx: ExecutionContext): number => {
        const request = ctx.switchToHttp().getRequest();
        const user = request.user as JwtPayload | undefined;

        if (!user || !user.tenant_id) {
          throw new Error('Tenant context missing from authenticated user');
        }

        return user.tenant_id;
      }
    );
    ```

    2. src/auth/types/jwt-payload.interface.ts:
    ```typescript
    export interface JwtPayload {
      sub: number; // userId
      email: string;
      tenant_id: number;
      iat: number;
      exp: number;
    }
    ```

    3. src/auth/types/user.entity.ts:
    ```typescript
    export class UserEntity {
      id: number;
      email: string;
      tenant_id: number;
      email_verified: boolean;
      created_at: Date;
      updated_at: Date;

      // Exclude password_hash from responses
    }
    ```
    Could also use interface instead of class. For simplicity, use interface:
    ```typescript
    export interface User {
      id: number;
      email: string;
      tenant_id: number;
      email_verified: boolean;
      created_at: Date;
      updated_at: Date;
    }
    ```
    Export as User.

    Verify: Decorator compiles and extracts tenant_id correctly; interfaces/types compile without errors.
  </action>
  <verify>
    <automated>
      grep -q "createParamDecorator" src/shared/decorators/tenant.decorator.ts &&
      grep -q "interface JwtPayload" src/auth/types/jwt-payload.interface.ts &&
      grep -q "export.*interface User" src/auth/types/user.entity.ts &&
      echo "Auth types and decorator created"
    </automated>
  </verify>
  <done>Tenant decorator and auth type definitions ready</done>
</task>

<task type="auto" tdd="true">
  <name="Task 2: Create auth DTOs with validation</name>
  <files>
    src/auth/dto/login.dto.ts
    src/auth/dto/register.dto.ts
    src/auth/dto/password-reset.dto.ts
  </files>
  <behavior>
    - Test 1: LoginDto has @IsEmail() email, @IsString() @MinLength(8) password
    - Test 2: RegisterDto has @IsEmail() email, @IsString() @MinLength(8) password, @IsInt() tenant_id
    - Test 3: PasswordResetRequestDto has @IsEmail() email
    - Test 4: PasswordResetConfirmDto has @IsString() token, @IsString() @MinLength(8) newPassword
    - Test 5: DTOs compile without errors
  </behavior>
  <action>
    Create DTO files:

    1. src/auth/dto/login.dto.ts:
    ```typescript
    import { IsEmail, IsString, MinLength } from 'class-validator';

    export class LoginDto {
      @IsEmail()
      email: string;

      @IsString()
      @MinLength(8)
      password: string;
    }
    ```

    2. src/auth/dto/register.dto.ts:
    ```typescript
    import { IsEmail, IsString, MinLength, IsInt } from 'class-validator';

    export class RegisterDto {
      @IsEmail()
      email: string;

      @IsString()
      @MinLength(8)
      password: string;

      @IsInt()
      tenant_id: number;
    }
    ```

    3. src/auth/dto/password-reset.dto.ts:
    ```typescript
    import { IsEmail, IsString, MinLength } from 'class-validator';

    export class PasswordResetRequestDto {
      @IsEmail()
      email: string;
    }

    export class PasswordResetConfirmDto {
      @IsString()
      token: string;

      @IsString()
      @MinLength(8)
      newPassword: string;
    }
    ```

    Verify: All DTOs have required validation decorators; no TypeScript errors.
  </action>
  <verify>
    <automated>
      grep -q "@IsEmail" src/auth/dto/login.dto.ts &&
      grep -q "@MinLength" src/auth/dto/register.dto.ts &&
      grep -q "PasswordResetRequestDto" src/auth/dto/password-reset.dto.ts &&
      grep -q "PasswordResetConfirmDto" src/auth/dto/password-reset.dto.ts &&
      echo "Auth DTOs with validation defined"
    </automated>
  </verify>
  <done>Authentication DTOs with class-validator ready</done>
</task>

</tasks>

<verification>
Wave 2a - Auth types and DTOs complete

**Automated checks:**
1. Tenant decorator file exists and uses createParamDecorator
2. JwtPayload interface exists with sub, email, tenant_id, iat, exp
3. User entity/interface exists with id, email, tenant_id, etc.
4. All 3 DTO files exist with class-validator decorators
5. TypeScript compiles: `npx tsc --noEmit src/shared/decorators/tenant.decorator.ts src/auth/types/*.ts src/auth/dto/*.ts`

**Dependencies:** These types will be used by Passport strategies (next plan 03b), AuthService (03c), and middleware (03d).

</verification>

<success_criteria>
Auth types and DTOs ready when:
- [ ] src/shared/decorators/tenant.decorator.ts exists and extracts tenant_id from request.user
- [ ] src/auth/types/jwt-payload.interface.ts defines JwtPayload with tenant_id
- [ ] src/auth/types/user.entity.ts defines User (interface or entity) without password_hash
- [ ] LoginDto, RegisterDto, PasswordResetRequestDto, PasswordResetConfirmDto exist with validation decorators
- [ ] All files compile without TypeScript errors

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-03a-PLAN-03a-summary.md`
</output>
