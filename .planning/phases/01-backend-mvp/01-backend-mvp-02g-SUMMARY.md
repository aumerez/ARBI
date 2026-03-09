---
phase: 01-backend-mvp
plan: 02g
subsystem: app-wiring
tags: [appmodule, wiring, infrastructure, bootstrap]
dependency_graph:
  requires: [02a, 02b, 02c, 02d, 02e]
  provides: [app-module-ready, infrastructure-integration]
  affects: [03a-auth, 04a-documents, 05a-chat]
tech-stack:
  added:
    - nestjs-modules (AppModule, RedisModule)
    - helmet (security middleware)
    - supertest (integration testing)
  patterns:
    - global-config-module
    - infrastructure-module-wiring
    - bootstrap-middleware-stack
key-files:
  created:
    - src/app/app.module.ts
    - src/main.ts
    - src/shared/infrastructure/redis.module.ts
    - tsconfig.build.json
    - nest-cli.json
  modified:
    - package.json (dependencies)
decisions: []
metrics:
  duration: ~15min
  completed_date: 2026-03-09
  tasks_completed: 1
  files_created: 5
  lines_added: ~150
---

# Phase 01-backend-mvp Plan 02g: AppModule Wiring Summary

## One-Liner

Complete Wave 1 infrastructure integration with AppModule, bootstrap configuration, and missing RedisModule.

## What Was Built

### Core Infrastructure Wiring

**Created `src/app/app.module.ts`** - Root NestJS application module that imports and integrates all Wave 1 infrastructure:

- **ConfigModule** - Global configuration with `.env` file support
- **DatabaseModule** - PostgreSQL connection with tenant context
- **RedisModule** - Redis client for caching and session management
- **QdrantModule** - Vector database for embeddings storage
- **ProviderModule** - LLM and embedding provider factory

The module is structured to be extended with feature modules (AuthModule, DocumentsModule, ChatModule) in subsequent waves.

**Created `src/main.ts`** - Application entry point with complete bootstrap sequence:

- Security: `helmet()` middleware for HTTP headers protection
- CORS: Enabled cross-origin resource sharing
- Validation: Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- Port binding: Listens on `PORT` from environment (default: 3000)

### Auto-Fixed Blocking Issues

**Deviation Rule 3 Applied - Missing RedisModule**

- **Issue:** Plan required `RedisModule` to be imported by `AppModule`, but the module file did not exist. Only `RedisService` was present.
- **Fix:** Created `src/shared/infrastructure/redis.module.ts` with:
  - `@Global()` decorator for provider availability across modules
  - Exports `RedisService` for injection
  - Clean, minimal NestJS module structure matching existing patterns

**Deviation Rule 3 Applied - Build Configuration**

- **Issue:** `tsconfig.json` included `tests/**/*` pattern, causing build failures from test files referencing future feature modules (Auth, Chat) that don't exist yet.
- **Fix:** Created `tsconfig.build.json` and `nest-cli.json` to configure production builds to exclude test files while keeping them in standard tsconfig for development.

**Deviation Rule 3 Applied - Missing Dependencies**

- **Issue:** `helmet` and `supertest` packages missing, causing compilation errors.
- **Fix:** Installed `helmet`, `@types/helmet`, `supertest`, `@types/supertest` as dev dependencies.

## Verification

✅ **Build succeeds:** `npm run build` completes without TypeScript errors
✅ **Module imports:** AppModule correctly imports ConfigModule, DatabaseModule, RedisModule, QdrantModule, ProviderModule
✅ **Bootstrap code:** main.ts contains `NestFactory.create(AppModule)`, `ValidationPipe`, `CORS`, `helmet`, `PORT` binding
✅ **No circular dependencies:** N/A - AppModule is root with no circular references
✅ **TypeScript compilation:** Clean build with new tsconfig.build.json excluding test files

## Wave 1 Infrastructure Summary

All Wave 1 (Infrastructure) components are now complete and integrated:

- **02a:** Schema + provider interfaces
- **02b:** RLS migration applied
- **02c:** DatabaseService with tenant context
- **02d:** Redis + Qdrant services
- **02e:** Provider implementations (OpenAI, Local, Claude, LocalLLM) + factory + module
- **02g (this plan):** AppModule wiring + bootstrap configuration

## Next Steps

**Wave 2 - Authentication (Plans 03a-c):**
- 03a: Auth types and DTOs
- 03b: Auth strategies (JWT, local)
- 03c: Auth service implementation

AppModule is now ready to import `AuthModule` when created.

---

## Self-Check

**Files Created:**
✅ src/app/app.module.ts
✅ src/main.ts
✅ src/shared/infrastructure/redis.module.ts
✅ tsconfig.build.json
✅ nest-cli.json

**Build Success:**
✅ npm run build executes without errors

**Commit Recorded:**
✅ 5aec5d0: feat(01-backend-mvp-02g): wire AppModule with infrastructure modules

**Self-Check: PASSED**
