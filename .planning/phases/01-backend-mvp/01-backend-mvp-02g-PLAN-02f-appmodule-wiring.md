---
phase: 01-backend-mvp
plan: 02g
type: execute
wave: 10
depends_on: [02f]
  - 02e
files_modified:
  - src/app/app.module.ts
  - src/main.ts
autonomous: true
requirements:
  - TEN-01
  - TEN-02
  - TEN-03
  - DOC-08
  - CHAT-02
  - CHAT-03
user_setup: []
must_haves:
  truths:
    - "AppModule imports all shared infrastructure modules in correct order"
    - "ConfigModule is global with isGlobal: true and envFilePath: '.env'"
    - "DatabaseModule, RedisModule, QdrantModule, ProviderModule are imported"
    - "AppModule compiles without circular dependencies"
    - "main.ts bootstraps Nest app with proper global pipes/filters"
    - "Server listens on PORT from environment"
  artifacts:
    - path: "src/app/app.module.ts"
      provides: "Root module importing all infrastructure"
      min_lines: 30
      imports:
        - "ConfigModule"
        - "DatabaseModule"
        - "RedisModule"
        - "QdrantModule"
        - "ProviderModule"
    - path: "src/main.ts"
      provides: "Application bootstrap with ValidationPipe and CORS"
      min_lines: 20
      contains:
        - "NestFactory.create(AppModule)"
        - "app.useGlobalPipes(new ValidationPipe())"
        - "app.enableCors()"
        - "await app.listen(PORT)"
  key_links:
    - from: "src/app/app.module.ts"
      to: "all feature modules (AuthModule, DocumentsModule, ChatModule - coming in later waves)"
      via: "module imports"
      pattern: "imports: \\[.*Module.*\\]"
    - from: "src/main.ts"
      to: "AppModule"
      via: "NestFactory.create(AppModule)"
      pattern: "NestFactory.create"
    - from: "ProviderModule"
      to: "DocumentsModule, ChatModule"
      via: "ProviderFactory injection"
      pattern: "constructor.*providerFactory.*ProviderFactory"
---


<verification>
Wave 1f - AppModule wiring complete

**Automated checks:**
1. AppModule imports: ConfigModule, DatabaseModule, RedisModule, QdrantModule, ProviderModule
2. main.ts creates Nest app with ValidationPipe, CORS, helmet, listens on PORT
3. TypeScript compilation: `npm run build` succeeds with no errors
4. No circular dependencies (build should detect)

**Wave 1 Infrastructure Summary:**
- 02a: Schema + provider interfaces ✓
- 02b: RLS migration applied ✓
- 02c: DatabaseService with tenant context ✓
- 02d: Redis + Qdrant services ✓
- 02e: Provider implementations (OpenAI, Local, Claude, LocalLLM) + factory + module ✓
- 02f: AppModule integration ✓

**All Wave 1 infrastructure ready for feature modules:**
- AuthModule (Wave 2) will use DatabaseModule, JWT, TenantContext
- DocumentsModule (Wave 3) will use DatabaseModule, Redis, Qdrant, ProviderFactory
- ChatModule (Wave 4) will use DatabaseModule, Qdrant, ProviderFactory

**Configuration dependencies:**
Ensure .env file exists with:
- DATABASE_URL (PostgreSQL)
- REDIS_URL
- QDRANT_URL
- OPENAI_API_KEY (or EMBEDDING_PROVIDER=local)
- ANTHROPIC_API_KEY (or LLM_PROVIDER=local)
- JWT_SECRET (needed later for auth)
- OLLAMA_HOST (if using local providers)

**Next:** Proceed to Wave 2 (Authentication) - Plan 03a (split original Plan 03)

</verification>

<success_criteria>
Wave 1 complete when:
- [ ] AppModule imports all 5 infrastructure modules (Config, Database, Redis, Qdrant, Provider)
- [ ] main.ts bootstrap with CORS, ValidationPipe, helmet, port binding
- [ ] `npm run build` succeeds (no TypeScript errors)
- [ ] All infrastructure services are provided and can be injected
- [ ] Application startup without runtime errors (database connection may fail if DB not running, but compilation must pass)

**Deliverable:** Complete backend infrastructure foundation with multi-tenancy, external service clients, and provider abstraction for cloud/local flexibility.

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-02f-PLAN-02f-summary.md`
</output>
