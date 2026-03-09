---
phase: 01-backend-mvp
plan: 02a
subsystem: database
tags: [prisma, postgresql, multi-tenancy, provider-abstraction]

# Dependency graph
requires:
  - phase: 01-backend-mvp
    provides: "Test infrastructure and integration test scaffolds (Plan 01d)"
provides:
  - "Prisma schema with Tenant model and tenant-scoped tables with FK constraints"
  - "Provider abstraction interfaces for embedding and LLM backends"
  - "Test suite validating multi-tenancy requirements"
affects:
  - "02b-migration-rls-policies (uses schema to generate migration)"
  - "All subsequent backend phases (services depend on tenant_id fields and providers)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-tenancy via tenant_id foreign keys with onDelete Cascade"
    - "Provider abstraction pattern for cloud/local backend flexibility"
key-files:
  created:
    - prisma/schema.prisma
    - src/shared/types/providers.interface.ts
    - tests/prisma/schema.tenants.spec.ts
  modified: []
key-decisions:
  - "All tenant-scoped tables include tenant_id NOT NULL with FK to tenants.id"
  - "Cascade delete ensures automatic cleanup when tenant is removed"
  - "Provider interfaces defined abstractly to support OpenAI/Anthropic (cloud) and Ollama (local)"
patterns-established:
  - "Tenant isolation enforced at database schema level, not application level"
  - "Provider abstraction separates interface from implementation for flexibility"

requirements-completed:
  - TEN-01
  - TEN-02
  - TEN-03

# Metrics
duration: 8min
completed: 2026-03-09
---

# Phase 01-backend-mvp: Plan 02a Summary

**Multi-tenancy foundation with Tenant model and provider abstraction for cloud/local backends**

## Performance

- **Duration:** ~8 minutes
- **Started:** 2026-03-09T15:25:08Z
- **Completed:** 2026-03-09T15:33:00Z
- **Tasks:** 2 completed (TDD pattern)
- **Files created:** 3 (schema, interfaces, test suite)

## Accomplishments

- Complete Prisma schema with Tenant model and 8 tenant-scoped tables
- All tenant-scoped tables have tenant_id Int FK to tenants.id with onDelete Cascade
- Performance indexes on tenant_id added to all tenant-scoped tables
- Abstract provider interfaces: EmbeddingProvider, LLMProvider, StreamChunk, RetrievedChunk
- Comprehensive test suite (28 tests) validating multi-tenancy constraints
- Schema validates successfully with `npx prisma validate`

## Task Commits

Each task was committed atomically:

1. **Task 1: Update schema with Tenant model and FK constraints** - `36edbf8` (feat, TDD)
   - RED: Created failing test suite (28 tests)
   - GREEN: Implemented complete schema (260+ lines)
   - Tests: 28 passing
2. **Task 2: Create provider abstraction interfaces** - `50933be` (feat)
   - Defined EmbeddingProvider, LLMProvider, StreamChunk, RetrievedChunk, Citation
   - ProviderConfig: embeddingProvider (openai|local), llmProvider (anthropic|local)

**Plan metadata commit will follow STATE.md update**

## Files Created/Modified

- `prisma/schema.prisma` - Complete database schema (263 lines)
  - Tenant model with plan field, relations to all scoped tables
  - 8 tenant-scoped models: User, Document, DocumentChunk, Chat, ChatMessage, RefreshToken, PasswordResetToken, AuditLog
  - All with tenant_id FK (CASCADE), indexes, proper inverse relations
  - Enums: DocumentStatus (queued|processing|indexed|error), ChatRole (user|assistant)
- `src/shared/types/providers.interface.ts` - Provider abstraction layer (48 lines)
  - EmbeddingProvider: generateEmbeddings(texts: string[]): Promise<number[][]>
  - LLMProvider: streamChat(messages, context): AsyncIterable<StreamChunk>
  - Supporting types: StreamChunk, RetrievedChunk, Citation, ProviderConfig
- `tests/prisma/schema.tenants.spec.ts` - Schema validation test suite (28 tests)
  - Validates Tenant model structure, relations, indexes
  - Ensures FK constraints with Cascade delete
  - Verifies unique constraints and schema structure

## Decisions Made

None - followed plan as specified. Schema design was pre-defined in PLAN.md and executed exactly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing inverse relation in PasswordResetToken**
- **Found during:** Task 1 schema validation (npx prisma validate)
- **Issue:** PasswordResetToken.user relation defined but User model lacked inverse `passwordResetTokens` field
- **Fix:** Added `passwordResetTokens PasswordResetToken[]` to User model
- **Files modified:** prisma/schema.prisma
- **Verification:** Schema validates after fix; tests still pass (28/28)
- **Committed in:** 36edbf8 (Task 1 commit - fix applied before completion)

**2. [Rule 3 - Blocking] Resolved missing DATABASE_URL env var during validation**
- **Found during:** Automated verification `npx prisma validate` after schema creation
- **Issue:** Prisma CLI requires DATABASE_URL even for schema-only validation
- **Fix:** Provided dummy DATABASE_URL via environment: `DATABASE_URL="postgresql://..." npx prisma validate`
- **Files modified:** None (runtime env fix)
- **Verification:** Schema validation succeeded; test suite passed independently
- **Committed in:** N/A (env-level fix, no code change needed)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness and verification. No scope creep; all planned artifacts delivered.

## Issues Encountered

- Prisma validation failed due to missing inverse relation - auto-fixed (see deviations)
- Prisma CLI required DATABASE_URL for schema validation even though no DB connection needed - provided dummy value

## User Setup Required

None - no external service configuration required at this stage. Migration generation (with RLS policies) will happen in Plan 02b.

## Next Phase Readiness

- ✅ Schema complete and validated - ready for migration generation
- ✅ Provider abstraction defined - infrastructure providers can implement
- All tenant-scoped tables have required tenant_id FKs for RLS policies (Plan 02b)
- No blockers; Plan 02b can execute immediately

---
*Phase: 01-backend-mvp*
*Completed: 2026-03-09*
