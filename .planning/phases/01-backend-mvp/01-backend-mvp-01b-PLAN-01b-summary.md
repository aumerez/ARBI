---
phase: 01-backend-mvp
plan: 01b
subsystem: test
tags: ["test-fixtures", "mocks", "document-samples"]
dependency_graph:
  requires: ["01a"]
  provides: ["test-infrastructure"]
  affects: ["03-auth", "04-documents", "05-chat-rag"]
tech-stack:
  added:
    - "Jest test framework (ts-jest preset)"
    - "Mock service pattern for PostgreSQL, Redis, Qdrant"
    - "Builder pattern for test data generation"
  patterns:
    - "Test data builders for consistent test objects"
    - "Singleton mock services with shared state"
    - "Tenant context simulation for RLS testing"
key_files:
  created:
    - "tests/conftest.ts (256 lines)"
    - "tests/mocks/redis.service.ts"
    - "tests/mocks/postgres.service.ts"
    - "tests/mocks/qdrant.service.ts"
    - "tests/mocks/index.ts"
    - "tests/builders/test-builders.ts"
    - "tests/fixtures/sample.pdf (11KB)"
    - "tests/fixtures/sample.docx (9.8KB)"
    - "tests/fixtures/sample.txt (10KB)"
    - "scripts/generate-fixtures.ts"
  modified: []
decisions: []
metrics:
  duration: "Auto-calculated on commit"
  completed_date: "2026-03-09"
  total_tasks: 2
  total_files_created: 10
  total_lines_added: ~1200
---

# Phase 1 Plan 01b: Test Fixtures Summary

## One-Liner

Shared test infrastructure with database/Redis/Qdrant mocks and sample document fixtures for RAG pipeline testing.

## Description

This plan delivered the foundational test fixture infrastructure needed for all Phase 1 testing. It created reusable mock services for the three critical infrastructure components (PostgreSQL with RLS, Redis/BullMQ, Qdrant vector DB) and generated real document samples (PDF, DOCX, TXT) for processor validation.

## Completed Work

### Task 1: Create conftest.ts with global fixtures

**Status:** ✓ Complete (Commit cd696c9)

Created comprehensive test fixture infrastructure:

- **tests/conftest.ts** (256 lines): Central test configuration with global setup/teardown and re-exports
- **Test Data Builders**: UserBuilder, DocumentBuilder, ChunkBuilder for consistent test object creation
- **Helper Functions**: `mockJwtPayload()`, `mockUploadFile()` for common test scenarios
- **Mock Services**:
  - `MockPostgresService`: Simulates Prisma with RLS context enforcement, tenant isolation verification
  - `MockRedisService`: Simulates BullMQ job queues, job tracking, status updates
  - `MockQdrantService`: Simulates vector search with cosine similarity, hybrid RRF fusion, tenant-filtered collections
- **Singleton instances**: `mockPostgres`, `mockRedis`, `mockQdrant` shared across test suites
- **Setup helpers**: `initializeTestEnvironment()`, `cleanupTestEnvironment()`, `withTenantContext()`

**Key features:**
- RLS enforcement verification (throws error if tenant context not set)
- Cosine similarity calculation mimicking Qdrant HNSW search
- BM25 simulation for lexical search
- Hybrid search with Reciprocal Rank Fusion (RRF)
- Soft delete pattern support
- Tenant isolation validation method

### Task 2: Create sample document fixtures (PDF, DOCX, TXT)

**Status:** ✓ Complete (Commit e520305)

Generated three production-like sample documents:

- **sample.pdf**: 10.5 KB, valid PDF header (`%PDF-`), ~1500 words of technical content
- **sample.docx**: 9.8 KB, valid DOCX structure with headings and paragraphs, ~800 words
- **sample.txt**: 10 KB plain text containing "Section 1" and "Section 2", ~1500 words

All documents contain technical operations content relevant to the Oil & Gas domain, with structured sections suitable for testing semantic chunking and retrieval.

Supporting infrastructure:
- **scripts/generate-fixtures.ts**: Regeneratable fixture script using `pdfkit` and `docx` libraries
- Documents include multiple sections, paragraphs, and technical terminology to exercise text splitters

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All automated verification criteria passed:

1. ✓ Conftest imports without TypeScript errors (`npx tsc --noEmit` succeeded)
2. ✓ All fixture files exist: `tests/fixtures/*.{pdf,docx,txt}`
3. ✓ File sizes meet minimums: PDF >10KB (11KB), DOCX >5KB (9.8KB), TXT >5KB (10KB)
4. ✓ PDF header valid: `%PDF-` present in first 5 bytes
5. ✓ TXT contains expected section markers: "Section 1" and "Section 2"
6. ✓ Helper functions (`mockJwtPayload`, `mockUploadFile`) exported from conftest
7. ✓ All mocks implement required methods for test suites (database queries, Redis operations, vector search)

## Success Criteria Met

- [x] `tests/conftest.ts` exists with MockPostgresService, MockRedisService, MockQdrantService, test builders (256 lines)
- [x] `tests/fixtures/sample.pdf` exists, 11KB (>10KB), valid PDF header
- [x] `tests/fixtures/sample.docx` exists, 9.8KB (>5KB), valid DOCX structure
- [x] `tests/fixtures/sample.txt` exists, 10KB (>5KB), contains "Section 1" and "Section 2"
- [x] Helper functions exported from conftest
- [x] All mocks implement methods needed by test suites (query, insert, search, upsert, etc.)

## Files Created

**Total: 10 files (9 code + 3 fixtures)**

```
tests/
├── conftest.ts (256 lines)
├── mocks/
│   ├── index.ts (8 lines)
│   ├── postgres.service.ts (173 lines)
│   ├── qdrant.service.ts (235 lines)
│   └── redis.service.ts (74 lines)
├── builders/
│   └── test-builders.ts (159 lines)
└── fixtures/
    ├── sample.pdf (11KB)
    ├── sample.docx (9.8KB)
    └── sample.txt (10KB)

scripts/
└── generate-fixtures.ts (helper script)
```

## Commits

- `cd696c9`: test(01-backend-mvp-01b): create shared test fixtures infrastructure
- `e520305`: test(01-backend-mvp-01b): add sample document fixtures

## Technical Notes

All mock services are designed to simulate real infrastructure behavior while remaining lightweight for unit testing:

- **MockPostgresService**: Enforces tenant isolation at query time; throws if context unset (mirrors RLS policy)
- **MockQdrantService**: Uses actual cosine similarity math for realistic search results; implements hybrid search with RRF
- **MockRedisService**: Tracks jobs in memory; supports queue operations needed by BullMQ workers

These fixtures will support unit and integration tests across requirements:
- AUTH-01 through AUTH-04 (authentication tests with JWT mocks)
- DOC-06/DOC-07 (document processors and chunking tests)
- CHAT-02 (hybrid search), CHAT-04 (citations), QUAL-03 (citation validation)
- TEN-01/TEN-02/TEN-03 (tenant isolation integration tests)
