---
phase: 01-backend-mvp
plan: 03
type: execute
wave: 2
depends_on:
  - 02
files_modified:
  - src/auth/auth.module.ts
  - src/auth/auth.controller.ts
  - src/auth/auth.service.ts
  - src/auth/strategies/jwt.strategy.ts
  - src/auth/strategies/local.strategy.ts
  - src/auth/guards/jwt-auth.guard.ts
  - src/auth/guards/tenant-context.guard.ts
  - src/auth/middleware/tenant-context.middleware.ts
  - src/auth/dto/login.dto.ts
  - src/auth/dto/register.dto.ts
  - src/auth/dto/password-reset.dto.ts
  - src/shared/decorators/tenant.decorator.ts
autonomous: true
requirements:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04
user_setup: []
must_haves:
  truths:
    - "User can register with email/password and receives verification email"
    - "User can log in with credentials and receives JWT in httpOnly cookie"
    - "User can log out from any page (session invalidated)"
    - "User can request password reset via email and set new password with token"
    - "All auth endpoints enforce tenant isolation via RLS"
  artifacts:
    - path: "src/auth/auth.module.ts"
      provides: "NestJS AuthModule with providers and guards"
    - path: "src/auth/auth.service.ts"
      provides: "User CRUD, password hashing (bcrypt), email verification, token management"
      exports: ["register", "login", "logout", "requestPasswordReset", "resetPassword", "validateUser"]
    - path: "src/auth/strategies/jwt.strategy.ts"
      provides: "Passport JWT strategy validating token and extracting tenant_id"
    - path: "src/auth/strategies/local.strategy.ts"
      provides: "Local strategy for email/password validation during login"
    - path: "src/auth/guards/jwt-auth.guard.ts"
      provides: "Guard protecting routes requiring authentication"
    - path: "src/auth/middleware/tenant-context.middleware.ts"
      provides: "Middleware that sets PostgreSQL RLS context after JWT validation"
    - path: "src/auth/dto/login.dto.ts"
      provides: "Validation DTO for login request (email, password)"
    - path: "src/auth/dto/register.dto.ts"
      provides: "Validation DTO for registration (email, password, tenant_id)"
    - path: "src/auth/dto/password-reset.dto.ts"
      provides: "Validation DTOs for reset request and new password"
  key_links:
    - from: "src/auth/middleware/tenant-context.middleware.ts"
      to: "src/shared/database/database.service.ts"
      via: "dbService.setTenantContext(tenantId)"
      pattern: "setTenantContext"
    - from: "src/auth/strategies/jwt.strategy.ts"
      to: "JWT payload"
      via: "JwtPayload interface with tenant_id"
      pattern: "interface JwtPayload"
    - from: "src/auth/auth.service.ts"
      to: "bcrypt hashing"
      via: "bcrypt.hash sync during registration"
      pattern: "bcrypt.hash"
    - from: "src/auth/auth.controller.ts"
      to: "AuthService"
      via: "constructor(private authService: AuthService)"
      pattern: "constructor.*AuthService"

---

<objective>
Implement complete authentication module with JWT sessions, email verification, and password reset

Purpose: Enable user signup, login, logout, and password reset - the foundation for all authenticated operations. Enforce multi-tenancy via RLS context middleware.

Output: Working auth endpoints: POST /auth/register, POST /auth/login, POST /auth/logout, POST /auth/password-reset-request, POST /auth/password-reset-confirm

</objective>

<execution_context>
@/Users/franciscoegloff/.claude/get-shit-done/workflows/execute-plan.md
@/Users/franciscoegloff/.claude/get-shit-done/templates/summary.md
</context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-backend-mvp/01-CONTEXT.md
@.planning/phases/01-backend-mvp/01-RESEARCH.md

# Key research patterns:
- JWT with httpOnly cookies for persistent sessions (15m access, 7d refresh)
- Password hashing with bcrypt (12 rounds)
- Email verification via token (simulate sending for MVP)
- Password reset: generate token, email link, token validation, password update
- Tenant context: Extract tenant_id from JWT payload → set via DatabaseService.setTenantContext
- Multi-tenancy: Every query must filter by tenant_id; RLS as safety net

# Interfaces needed:
Define types early for executor:
- JwtPayload: { sub: userId, email: string, tenant_id: number, iat: number, exp: number }
- User entity (already in schema.prisma from Plan 02)
- LoginRequest: { email: string; password: string }
- RegisterRequest: { email: string; password: string; tenant_id: number }

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create shared types and tenant decorator</name>
  <files>
    src/shared/decorators/tenant.decorator.ts
    src/auth/types/jwt-payload.interface.ts
    src/auth/types/user.entity.ts
  </files>
  <behavior>
    - Test 1: Tenant decorator extracts tenantId from JWT payload in request
    - Test 2: JwtPayload interface has required fields: sub, email, tenant_id, iat, exp
    - Test 3: User entity matches Prisma User model structure
    - Test 4: Decorator throws error if tenant_id missing
  </behavior>
  <action>
    Create TypeScript types:

    1. src/shared/decorators/tenant.decorator.ts:
       - Param decorator: `@Tenant()` extracts tenant_id from req.user (JWT payload)
       - Use createParamDecorator from '@nestjs/common'
       - Implementation: `const payload = req.user as JwtPayload; return payload.tenant_id;`

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
       - Mirror Prisma User model (id, email, password_hash, tenant_id, email_verified, created_at, updated_at)
       - Export as class with decorators or interface based on preference (using class-validator if needed)

    Verify: Types compile without errors; decorator can be imported elsewhere.
  </action>
  <verify>
    <automated>grep -q "createParamDecorator" src/shared/decorators/tenant.decorator.ts && grep -q "interface JwtPayload" src/auth/types/jwt-payload.interface.ts && echo "Shared types created"</automated>
  </verify>
  <done>Tenant decorator and JWT payload interface ready for auth guards</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement Local JWT strategies with Passport</name>
  <files>
    src/auth/strategies/local.strategy.ts
    src/auth/strategies/jwt.strategy.ts
  </files>
  <behavior>
    - Test 1: Local strategy validates email/password against database (bcrypt.compare)
    - Test 2: Local strategy fails with invalid credentials (401)
    - Test 3: JWT strategy validates token signature with JWT_SECRET
    - Test 4: JWT strategy extracts tenant_id and includes in validated user object
    - Test 5: JWT strategy rejects expired tokens
  </behavior>
  <action>
    Create Passport strategies:

    1. local.strategy.ts (extends PassportStrategy(Strategy) from '@nestjs/passport'):
       - Use BasicStrategy or custom ValidateFunction
       - Validate: find user by email (AuthService.validateUserByEmail), bcrypt.compare password
       - Return user object without password_hash
       - On failure: throw UnauthorizedException

    2. jwt.strategy.ts (extends PassportStrategy(Strategy) from 'passport-jwt'):
       - super({ jwtFromRequest: ExtractJwt.fromExtractors([...]), ignoreExpiration: false, secretOrKey: process.env.JWT_SECRET, passReqToCallback: true })
       - Extract JWT from httpOnly cookie OR Authorization header
       - validate(req, payload): call authService.validateUser(payload.sub), verify user exists, ensure payload.tenant_id present, return { userId, email, tenantId }
       - Throws UnauthorizedException if user not found or tenant_id missing

    Note: RESEARCH shows JWT extraction from cookie OR header. Implement both for flexibility.

    Verify: Strategies compile with correct imports from @nestjs/passport and passport-jwt.
  </action>
  <verify>
    <automated>grep -q "extends PassportStrategy" src/auth/strategies/local.strategy.ts && grep -q "passport-jwt" src/auth/strategies/jwt.strategy.ts && echo "Passport strategies defined"</automated>
  </verify>
  <done>Local and JWT Passport strategies implemented</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create DTOs with validation decorators</name>
  <files>
    src/auth/dto/login.dto.ts
    src/auth/dto/register.dto.ts
    src/auth/dto/password-reset.dto.ts
  </files>
  <behavior>
    - Test 1: LoginDto validates email (isEmail) and password (min length 8)
    - Test 2: RegisterDto validates email, password (min 8), and tenant_id (isInt)
    - Test 3: PasswordResetRequestDto validates email
    - Test 4: PasswordResetConfirmDto validates token and new password
    - Test 5: DTOs strip sensitive fields from logs (no password in error messages)
  </behavior>
  <action>
    Create DTOs using class-validator:

    1. login.dto.ts:
       ```typescript
       export class LoginDto {
         @IsEmail() email: string;
         @IsString() @MinLength(8) password: string;
       }
       ```

    2. register.dto.ts:
       ```typescript
       export class RegisterDto {
         @IsEmail() email: string;
         @IsString() @MinLength(8) password: string;
         @IsInt() tenant_id: number;
       }
       ```

    3. password-reset.dto.ts (two classes):
       - PasswordResetRequestDto { @IsEmail() email: string }
       - PasswordResetConfirmDto { @IsString() token: string; @IsString() @MinLength(8) newPassword: string }

    Use ValidationPipe globally in main.ts (configure later).

    Verify: DTOs export classes with proper decorators; no syntax errors.
  </action>
  <verify>
    <automated>grep -q "@IsEmail" src/auth/dto/login.dto.ts && grep -q "@MinLength" src/auth/dto/register.dto.ts && echo "DTOs with validation defined"</automated>
  </verify>
  <done>Authentication DTOs with class-validator ready</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Implement AuthService core logic</name>
  <files>
    src/auth/auth.service.ts
  </files>
  <behavior>
    - Test 1: register(userDto) creates user with bcrypt hash, returns user without password
    - Test 2: register sends verification email (EmailService.saveVerificationToken called)
    - Test 3: validateUser(userId) returns user or null
    - Test 4: login(loginDto) validates credentials, issues JWT access (15m) and refresh (7d) tokens
    - Test 5: login returns tokens set in httpOnly cookies (not in body for security)
    - Test 6: logout(refreshToken) invalidates refresh token (revoke/deletes)
    - Test 7: requestPasswordReset(email) generates hashed token, saves with expiry, sends email
    - Test 8: resetPassword(token, newPassword) validates token, updates password, marks token used
    - Test 9: All database operations use tenant context (tenant_id in WHERE)
  </behavior>
  <action>
    Implement AuthService:

    - Inject PrismaService (from shared/database), JwtService (@nestjs/jwt), ConfigService
    - Methods:
      * async register(dto: RegisterDto): Promise<User>
        - Hash password: bcrypt.hash(dto.password, 12)
        - Create user: prisma.user.create({ data: { email, password_hash, tenant_id, email_verified: false } })
        - Generate verification token (UUID) saved to User.verification_token (or separate table)
        - Send email (EmailService - will be abstract, mock for MVP)
        - Return user (exclude password_hash)
      * async validateUser(userId: number): Promise<User | null>
        - prisma.user.findUnique({ where: { id: userId } })
      * async login(loginDto: LoginDto, tenantId: number): Promise<{ accessToken: string, refreshToken: string }>
        - Find user by email AND tenant_id (multi-tenant filter)
        - bcrypt.compare(loginDto.password, user.password_hash)
        - payload = { sub: user.id, email: user.email, tenant_id: user.tenant_id }
        - accessToken = this.jwtService.sign(payload, { expiresIn: '15m' })
        - refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' })
        - Save refresh token hash to RefreshToken table with user_id, expires_at
        - Return tokens
      * async logout(refreshToken: string, userId: number): Promise<void>
        - Hash refreshToken, find RefreshToken record with matching token_hash, user_id, and not revoked/expired
        - Update set revoked = true where token_hash matches
      * async requestPasswordReset(email: string, tenantId: number): Promise<void>
        - Find user by email AND tenant_id
        - Generate token (UUID), hash it, save to PasswordResetToken with user_id, expires_at (1h)
        - Send password reset email with token (mock: just save to db for testing)
      * async resetPassword(token: string, newPassword: string, tenantId: number): Promise<void>
        - Find PasswordResetToken where token_hash matches, user belongs to tenantId, not used/expired
        - Verify token (bcrypt.compare token with stored hash)
        - Update user password_hash = bcrypt.hash(newPassword, 12)
        - Mark token used = true
        - Invalidate all refresh tokens for user (security)

    Verification: All service methods tested by Plan 01 auth tests.
  </action>
  <verify>
    <automated>grep -q "async register" src/auth/auth.service.ts && grep -q "async login" src/auth/auth.service.ts && grep -q "bcrypt.hash" src/auth/auth.service.ts && echo "AuthService methods implemented"</automated>
  </verify>
  <done>AuthService with registration, login, logout, password reset implemented</done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: Create TenantContextMiddleware and JWT guard</name>
<files>
    src/auth/middleware/tenant-context.middleware.ts
    src/auth/guards/jwt-auth.guard.ts
    src/auth/guards/tenant-context.guard.ts
  </files>
  <behavior>
    - Test 1: TenantContextMiddleware sets database tenant context from JWT payload
    - Test 2: Middleware calls DatabaseService.setTenantContext before request proceeds
    - Test 3: JwtAuthGuard extends AuthGuard('jwt') and blocks unauthenticated requests
    - Test 4: TenantContextGuard ensures tenant_id present in JWT payload
    - Test 5: Middleware order: JWT guard validates BEFORE tenant context guard sets DB context
  </behavior>
  <action>
    Implement guards and middleware:

    1. tenant-context.middleware.ts (implements NestMiddleware):
       - use(req: Request, res: Response, next: NextFunction)
       - Extract user from req.user (JwtPayload)
       - Call databaseService.setTenantContext(user.tenant_id)
       - next()
       - Optional: catch errors, clear context on response finish

    2. tenant-context.guard.ts (implements CanActivate):
       - Checks req.user exists and has tenant_id
       - Throws ForbiddenException if missing (should never happen if JWT valid)
       - This guard runs AFTER JwtAuthGuard in route decorator: `@UseGuards(JwtAuthGuard, TenantContextGuard)`

    3. jwt-auth.guard.ts:
       - Extends AuthGuard('jwt') from '@nestjs/passport'
       - Optionally override handleRequest to customize error messages

    Verify: Middleware and guards reference DatabaseService correctly; guard interfaces implemented.
  </action>
  <verify>
    <automated>grep -q "setTenantContext" src/auth/middleware/tenant-context.middleware.ts && grep -q "extends AuthGuard" src/auth/guards/jwt-auth.guard.ts && grep -q "implements CanActivate" src/auth/guards/tenant-context.guard.ts && echo "Tenant guards and middleware defined"</automated>
  </verify>
  <done>Tenant context middleware and JWT guard implementation complete</done>
</task>

<task type="auto" tdd="true">
  <name>Task 6: Implement AuthController endpoints</name>
  <files>
    src/auth/auth.controller.ts
  </files>
  <behavior>
    - Test 1: POST /auth/register accepts RegisterDto, returns 201 with user (no password)
    - Test 2: POST /auth/login accepts LoginDto, sets httpOnly cookie (access_token, refresh_token), returns 200
    - Test 3: POST /auth/logout clears httpOnly cookie (set empty with max-age 0), invalidates refresh token
    - Test 4: POST /auth/password-reset-request accepts email, returns 202 (email queued)
    - Test 5: POST /auth/password-reset-confirm accepts token and newPassword, returns 204
    - Test 6: All protected routes use appropriate guards: @UseGuards(JwtAuthGuard, TenantContextGuard)
  </behavior>
  <action>
    Create AuthController with REST endpoints:

    ```typescript
    @Controller('auth')
    export class AuthController {
      constructor(private authService: AuthService) {}

      @Post('register')
      async register(@Body() dto: RegisterDto): Promise<UserResponse> {
        const user = await this.authService.register(dto);
        return this.buildUserResponse(user);
      }

      @Post('login')
      @UseGuards(LocalStrategy) // LocalStrategy validates credentials, then sets JWT in response
      async login(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
      ): Promise<{ message: string }> {
        const { accessToken, refreshToken } = await this.authService.login(req.user as LoginRequest, req.tenantId);
        // Set httpOnly cookies
        res.cookie('access_token', accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 15 * 60 * 1000,
          path: '/',
        });
        res.cookie('refresh_token', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000,
          path: '/auth/refresh',
        });
        return { message: 'Logged in' };
      }

      @Post('logout')
      @UseGuards(JwtAuthGuard, TenantContextGuard)
      async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
        const refreshToken = req.cookies?.refresh_token;
        await this.authService.logout(refreshToken, req.user.userId);
        res.clearCookie('access_token', { path: '/' });
        res.clearCookie('refresh_token', { path: '/auth/refresh' });
      }

      @Post('password-reset-request')
      async requestReset(@Body() dto: PasswordResetRequestDto): Promise<{ message: string }> {
        await this.authService.requestPasswordReset(dto.email, /* tenantId from tenant context? */);
        return { message: 'Reset email sent (mock for MVP)' };
      }

      @Post('password-reset-confirm')
      async confirmReset(@Body() dto: PasswordResetConfirmDto): Promise<void> {
        await this.authService.resetPassword(dto.token, dto.newPassword, /* tenantId */);
      }
    }
    ```

    Note: Tenant ID for password reset needs routing guard or extraction; simplest: assume email identifies tenant uniquely (user exists in only one tenant). Will find user and extract tenant.

    Verify: Controller uses correct decorators, guards, and returns appropriate HTTP status codes.
  </action>
  <verify>
    <automated>grep -q "@Controller('auth')" src/auth/auth.controller.ts && grep -q "@Post('register')" src/auth/auth.controller.ts && grep -q "@UseGuards" src/auth/auth.controller.ts && echo "AuthController endpoints defined"</automated>
  </verify>
  <done>AuthController with register, login, logout, password reset endpoints complete</done>
</task>

<task type="auto">
  <name>Task 7: Create AuthModule and wire dependencies</name>
  <files>
    src/auth/auth.module.ts
  </files>
  <action>
    Create AuthModule that imports and configures:

    - ConfigModule (for env vars)
    - DatabaseModule (for AuthService DB access)
    - JwtModule.registerAsync({ useFactory: (config: ConfigService) => ({ secret: config.get('JWT_SECRET'), signOptions: { expiresIn: '15m' } }), inject: [ConfigService] })
    - PassportModule (for strategies)
    - Provide: AuthService, LocalStrategy, JwtStrategy
    - Register middleware: { provide: 'APP_MIDDLEWARE', useClass: TenantContextMiddleware } OR apply globally via app.module

    Also export AuthService if needed by other modules.

    Verify: Module imports and providers array matches NestJS best practices; no circular dependencies.
  </action>
  <verify>
    <automated>grep -q "JwtModule.registerAsync" src/auth/auth.module.ts && grep -q "PassportModule" src/auth/auth.module.ts && grep -q "AuthService" src/auth/auth.module.ts && echo "AuthModule configured"</automated>
  </verify>
  <done>AuthModule wired with JWT, Passport, Database, and middleware</done>
</task>

<task type="auto">
  <name>Task 8: Add global validation and exception filters</name>
  <files>
    src/app/app.module.ts
    src/main.ts
  </files>
  <action>
    Update main.ts and app.module.ts:

    1. main.ts:
       - Enable CORS if needed (for Electron later)
       - Use global validation pipe: `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))`
       - Optionally add helmet middleware: `app.use(helmet())`
       - Listen on PORT

    2. app.module.ts:
       - Already imports ConfigModule with isGlobal: true
       - Add global exception filter (HttpExceptionFilter) if defined in shared

    Verify: App bootstraps without errors; ValidationPipe active for all DTOs.
  </action>
  <verify>
    <automated>grep -q "ValidationPipe" src/main.ts && grep -q "isGlobal: true" src/app/app.module.ts && echo "Global pipes and filters configured"</automated>
  </verify>
  <done>Global validation and exception handling set up</done>
</task>

<task type="auto">
  <name>Task 9: Integrate AuthModule into AppModule</name>
  <files>
    src/app/app.module.ts
  </files>
  <action>
    Update src/app/app.module.ts to import AuthModule:

    ```typescript
    @Module({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
        DatabaseModule,
        RedisModule,
        QdrantModule,
        AuthModule, // ← Add this
      ],
      controllers: [AppController],
      providers: [],
    })
    export class AppModule {}
    ```

    Verify: No circular imports; AuthModule can import DatabaseModule which is already provided.
  </action>
  <verify>
    <automated>grep -q "AuthModule" src/app/app.module.ts && echo "AuthModule integrated"</automated>
  </verify>
  <done>AuthModule added to AppModule imports, making auth endpoints available</done>
</task>

</tasks>

<verification>
**Wave 2 - Authentication Complete**

**Automated verification sequence:**
1. Compile TypeScript: `npm run build` succeeds (no type errors across auth module)
2. Start dev server: `npm run start:dev` boots without module resolution errors
3. Run auth unit tests (from Plan 01): `npx jest tests/auth/*.spec.ts --runInBand`
   - Expected: Auth service, strategy, DTO tests pass (actual implementation matches test expectations)
4. Integration test auth flow: `npx jest tests/integration/authentication-flow.integration.spec.ts --runInBand`
   - Expected: Register → login → logout flow works with database

**Requirements mapping:**
- AUTH-01: User signup with email/password + verification email (actual email send mocked but token saved)
- AUTH-02: JWT persistent session (cookies) with 15m access + 7d refresh
- AUTH-03: Logout invalidates refresh token + clears cookie
- AUTH-04: Password reset via token + email link (email mocked)

**Critical checks:**
- RLS enforcement: TenantContextMiddleware sets context BEFORE any DB query in request lifecycle (order of middleware/guards)
- JWT payload includes tenant_id from User record - verified in JwtStrategy.validate
- Password hashing uses bcrypt with 12 rounds (REQUIRED, not stored plaintext)
- Refresh tokens stored hashed (never plaintext) for security
- All endpoints return appropriate HTTP status codes (201 for create, 200 for success, 401/403 for auth failures)

**Manual verification steps:**
1. Register a user via POST /auth/register with {email, password, tenant_id} → 201 response
2. Login via POST /auth/login (credentials in body) → 200 with Set-Cookie headers
3. Access protected route with cookie → 200 (JwtAuthGuard allows)
4. Logout → 200 with Cleared cookies; refresh token invalidated
5. Attempt reuse of refresh token → denied (401)

</verification>

<success_criteria>
Authentication module complete when:
- [ ] All 5 auth DTOs compile with validation decorators
- [ ] LocalStrategy validates credentials with bcrypt.compare
- [ ] JwtStrategy validates tokens and extracts tenant_id
- [ ] AuthService implements register, login, logout, password reset with bcrypt hashing (12 rounds)
- [ ] Refresh tokens stored hashed with expiry; logout revokes them
- [ ] TenantContextMiddleware sets `SET app.current_tenant` from JWT payload
- [ ] AuthController endpoints respond correctly: /register (201), /login (200+cookies), /logout (200+clearcookies), /password-reset-request (202), /password-reset-confirm (204)
- [ ] AuthModule imports DatabaseModule, JwtModule, PassportModule, ConfigModule
- [ ] Auth unit tests (from Plan 01) pass: `npx jest tests/auth/*.spec.ts` success rate ≥95%

**Security criteria:**
- [ ] Bcrypt salt rounds = 12 (configurable but minimum 10)
- [ ] JWT_SECRET never exposed in responses or logs
- [ ] Refresh tokens httpOnly + SameSite=Strict
- [ ] All auth queries filter by tenant_id (RLS as backup)
- [ ] Passwords never returned in API responses (UserResponse excludes password_hash)

**File ownership:**
- All files listed in files_modified are created/modified
- No file conflicts with later plans (auth module is self-contained)

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-03-PLAN-03-summary.md`
</output>
