---
phase: 01-backend-mvp
plan: 04e
subsystem: documents
tags: [nestjs, bullmq, workers, integration, queue]
depends_on:
  - 04d
  - 04b
requires:
  - DOC-01
  - DOC-02
  - DOC-03
  - DOC-04
  - DOC-05
  - DOC-06
  - DOC-07
  - DOC-08
provides:
  - DocumentsModule
  - Queue providers
  - Worker integration
tech_stack:
  added:
    - BullMQ Queue dependency injection
    - Worker provider pattern in NestJS
  patterns:
    - BullMQ Queue token injection
    - Worker auto-start via NestJS provider
    - TextSplitterService integration
key_files:
  created:
    - src/documents/documents.module.ts
    - src/documents/documents.module.spec.ts
  modified:
    - src/documents/jobs/document-upload.worker.ts
    - src/documents/jobs/document-upload.worker.spec.ts
decisions:
  - "Use RedisService.getConnection() pattern for queue factory (consistent with 04d)"
  - "Provide both queues as injectable tokens rather than creating inline"
  - "Inject TextSplitterService to replace inline chunking (from 04b)"
  - "Workers auto-start as module providers (no manual startup needed)"
---

# Phase 01-backend-mvp Plan 04e: DocumentsModule and Worker Integration - Summary

**Status:** ✅ Complete
**Executed:** 2026-03-09
**Commits:** 2 (Task 1: Module, Task 2: Worker integration)

## Overview

Wired the DocumentsModule, registering all document processing components, providing BullMQ queues as injectable tokens, and integrating the DocumentUploadWorker with the TextSplitterService from Plan 04b.

## Tasks Executed

### Task 1: Create DocumentsModule with queue providers and worker registration

**Commit:** `86dc58b`

Created `src/documents/documents.module.ts`:
- Imports `DatabaseModule`, `RedisModule`, `QdrantModule` from infrastructure
- Provides `DOCUMENT_UPLOAD_QUEUE` and `EMBEDDING_QUEUE` using factory functions
- Registers `DocumentUploadWorker` and `EmbeddingGenerationWorker` as providers (auto-start on module init)
- Declares `DocumentsController` for REST endpoints
- Exports `DocumentsService` for AppModule consumption
- Adds `@Global()` decorator for module-wide availability

Created `src/documents/documents.module.spec.ts`:
- Tests module compilation and provider registration
- Validates queue tokens, service providers, and module exports
- Uses mock RedisService to avoid real Redis connection in tests

### Task 2: Integrate TextSplitterService and embedding queue into DocumentUploadWorker

**Commit:** `de0287c`

Updated `src/documents/jobs/document-upload.worker.ts`:
- Modified constructor to inject `TextSplitterService` and `EMBEDDING_QUEUE` (via `@Inject('EMBEDDING_QUEUE')`)
- Replaced inline chunking with `this.textSplitter.splitText(text)` call for semantic chunking
- Removed local `Queue` instantiation for embedding; uses injected `this.embeddingQueue`
- Maintains `DatabaseService` and `Redis` dependencies for document updates and worker connection
- All refactored to use closures for processor function context (standard BullMQ Worker pattern)

Updated `src/documents/jobs/document-upload.worker.spec.ts`:
- Updated test to expect 4-argument constructor (database, embeddingQueue, textSplitter, redis)
- Added mocks for `TextSplitterService.splitText` returning test chunks
- Added tests verifying:
  - Worker instantiation with injected dependencies
  - `TextSplitterService.splitText` called with extracted text
  - `embeddingQueue.add('embedding-generation', { chunkId })` called for each chunk
  - Document status transitions (`processing` → `indexed` on success, `error` on failure)
  - Document status updates with correct parameters

## Verification

### Automated Tests (all passed)

```bash
✓ src/documents/documents.module.spec.ts (9 tests)
  - Module definition, providers, controllers, exports
  - Queue token provision (DOCUMENT_UPLOAD_QUEUE, EMBEDDING_QUEUE)

✓ src/documents/jobs/document-upload.worker.spec.ts (8 tests)
  - Worker instantiation with dependencies
  - TextSplitterService integration
  - Embedding queue enqueueing
  - Status updates and error handling
```

### Manual Verification

- TypeScript compiles without errors
- No circular dependency warnings
- All required imports resolve correctly
- Redis connection handled via `RedisService.getConnection()` with proper typing (`as any` per project pattern)

## Deviations

**None** - Plan executed exactly as specified.

## Integration Notes

- The DocumentUploadWorker now cleanly separates concerns: text extraction (processors) → chunking (TextSplitterService) → embedding (EmbeddingGenerationWorker)
- Both queues are singleton providers managed by NestJS DI container
- Workers auto-start upon module initialization; no manual `start()` calls needed
- The upload directory creation is already handled in `DocumentsService.uploadFile()` (line 54) via `fs.mkdir(tenantDir, { recursive: true })` - this satisfies the requirement to ensure uploads exist at runtime

## Requirements Coverage (DOC-01 through DOC-08)

All document requirements satisfied by the completed 04a-04e split:
- DOC-01: Upload endpoint (04d) → service → queue enqueue
- DOC-02: Validation in service (04d)
- DOC-03: Status tracking (04c service + 04d endpoints)
- DOC-04: Async processing via BullMQ queues and workers (04a, 04e)
- DOC-05: Status visibility (04d GET status endpoint)
- DOC-06: Text extraction processors (04a)
- DOC-07: Semantic chunking with TextSplitterService (04b integrated in 04e)
- DOC-08: Embedding generation and vector storage (04a embedding worker + Qdrant)

## Next Steps

- Documents feature (04a-04e) is now **complete**
- AppModule should import `DocumentsModule` (Plan 02g already handled this)
- Phase 1 Backend MVP continues with remaining plans (if any)

## Files Modified/Created

| File | Type | Lines |
|------|------|-------|
| `src/documents/documents.module.ts` | Created | 58 |
| `src/documents/documents.module.spec.ts` | Created | 102 |
| `src/documents/jobs/document-upload.worker.ts` | Modified | 110 |
| `src/documents/jobs/document-upload.worker.spec.ts` | Modified | 194 |
