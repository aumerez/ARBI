---
phase: 01-backend-mvp
plan: 04c
subsystem: documents
tags:
  - documents
  - file-upload
  - bullmq
  - tenant-isolation
requirements:
  - DOC-02
  - DOC-03
  - DOC-05
duration: ~20 minutes
completed_date: 2026-03-09
commits:
  - 18e9048
  - 1a86087
  - 60342f3
files_modified:
  - src/documents/documents.service.ts
  - src/documents/documents.service.spec.ts
  - src/documents/dto/document-response.dto.ts
  - src/documents/dto/document-status.dto.ts
  - src/documents/dto/dto.validation.spec.ts
  - src/shared/infrastructure/qdrant.service.ts
decisions: []
metrics:
  tasks_completed: 2
  files_created: 5
  tests_added: 31
---

# Phase 01-backend-mvp Plan 04c: Documents Service

## One-liner
Document lifecycle management service with file validation, tenant isolation, BullMQ queuing, and Qdrant cleanup for RAG pipeline

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create DTOs for document responses | 18e9048 | src/documents/dto/document-response.dto.ts, src/documents/dto/document-status.dto.ts, src/documents/dto/dto.validation.spec.ts |
| 2 | Implement DocumentsService core methods | 1a86087 | src/documents/documents.service.ts, src/documents/documents.service.spec.ts, src/shared/infrastructure/qdrant.service.ts |

## What Was Built

### DocumentResponseDto & DocumentStatusResponseDto
Validated DTOs with class-validator decorators:
- **DocumentResponseDto**: id, filename, mimetype, size, status (enum), error_message?, created_at
- **DocumentStatusResponseDto**: documentId, status (enum), progress?, error_message?
- Comprehensive validation tests (13 passing) covering type safety, required fields, enums, and optional properties

### DocumentsService
Full business logic layer for document management:
- **uploadFile(userId, tenantId, file)**
  - Validates mimetype (PDF, DOCX, TXT only) and size (≤50MB)
  - Creates Document record with status='queued' in database (enforces tenant_id + user_id)
  - Saves file to local storage: `uploads/{tenantId}/{documentId}.{ext}`
  - Enqueues `document-upload` job to BullMQ for async processing
  - Returns DocumentResponseDto with metadata

- **getDocumentStatus(documentId, userId, tenantId)**
  - Queries document by id with tenant + user filter
  - Returns `{ status, error_message? }`
  - Throws NotFoundException if no matching document

- **listDocuments(userId, tenantId, options?)**
  - Paginated query (default 20, skip/take options)
  - Orders by created_at DESC
  - Returns DocumentResponseDto[] with full metadata
  - Enforces tenant isolation via WHERE clause

- **deleteDocument(documentId, userId, tenantId)**
  - Verifies document ownership via findFirst
  - Hard deletes document (DB cascade removes DocumentChunk rows)
  - Deletes vector embeddings from Qdrant by chunk ID payload filter
  - Removes local file from filesystem (uploads/{tenantId}/{documentId}.{ext})
  - Logs deletion activity

### QdrantService.deletePoints(tenantId, pointIds)
New method added to support vector cleanup:
- Accepts tenantId and array of point IDs (string/number)
- Deletes points from tenant's collection by ID
- Used by DocumentsService.deleteDocument for cascade cleanup

## Verification Results

**Automated checks:**
- ✓ All 31 document-related tests pass (13 DTO validation + 18 service tests)
- ✓ TypeScript compiles for service and DTOs
- ✓ All service methods enforce tenant isolation (user_id + tenant_id checks)
- ✓ File validation rejects unsupported mimetypes and oversized files
- ✓ uploadFile creates record with status='queued' and enqueues BullMQ job
- ✓ deleteDocument removes document, cascades chunks (via DB), calls Qdrant.deletePoints
- ✓ Local file storage follows tenant-scoped directory pattern

**Requirements coverage:**
- DOC-02: File validation (type and size) in uploadFile ✓
- DOC-03: Status tracking via getDocumentStatus (queued/processing/indexed/error) ✓
- DOC-05: User sees document status in listDocuments response ✓
- DOC-01: Provides uploadFile method for controller (next phase) ✓

**Dependencies satisfied:**
- PrismaService (renamed DatabaseService) from 02c ✓
- QdrantService with deletePoints from this plan ✓
- BullMQ queue 'document-upload' (provided in 04e module) ✓
- Local filesystem access (Node.js fs) ✓

## Deviations from Plan

### Auto-fixed Issues

**RULE 1 - Bug: Incorrect DocumentStatus enum usage in tests**
- **Found during:** Task 1 test creation
- **Issue:** Tests used `DocumentStatus.QUEUED` but Prisma enum exports lowercase `queued`. Tests failed with TS2551.
- **Fix:** Replaced all enum usages with lowercase values (`queued`, `processing`, `indexed`, `error`).
- **Files modified:** src/documents/dto/dto.validation.spec.ts
- **Commit:** 18e9048

**RULE 1 - Bug: class-validator decorator signature errors in DTOs**
- **Found during:** Task 1 test compilation
- **Issue:** DTOs had `@IsDateString()` decorator which caused TS1240 errors in project's TypeScript configuration. Also had unused `Type` import.
- **Fix:** Removed `@IsDateString()` and `Type` import, matching project DTO pattern (Date fields typed but not decorated).
- **Files modified:** src/documents/dto/document-response.dto.ts, src/documents/dto/document-status.dto.ts
- **Commit:** 60342f3

**RULE 2 - Missing: QdrantService.deletePoints()**
- **Found during:** Task 2 implementation preparation
- **Issue:** DocumentsService requires deleting Qdrant vectors by chunk IDs, but QdrantService lacked delete method.
- **Fix:** Added `async deletePoints(tenantId, pointIds)` method that calls `client.delete(collectionName, { points: pointIds })`.
- **Files modified:** src/shared/infrastructure/qdrant.service.ts
- **Commit:** 1a86087

### No Other Deviations

The plan executed exactly as specified after the above necessary corrections. All must-have truths verified:
- ✓ uploadFile validates type/size, stores temporarily, creates queued record, enqueues job
- ✓ getDocumentStatus returns status + error_message
- ✓ listDocuments returns paginated user documents with metadata
- ✓ deleteDocument performs cascade cleanup (DB + Qdrant + filesystem)
- ✓ All queries filter by user_id + tenant_id for security

## Test Coverage Summary

**DTO Validation Tests (13):**
- DocumentResponseDto: 6 tests (valid data, error_message, type validation, missing fields, invalid enum)
- DocumentStatusResponseDto: 7 tests (valid variants, type validation, missing status, invalid enum)

**Service Tests (18):**
- uploadFile: 6 tests (PDF/DOCX/TXT, reject invalid mimetype, reject oversized, DB error)
- getDocumentStatus: 4 tests (success, error_message, not found, tenant isolation)
- listDocuments: 3 tests (paginated list, defaults, tenant isolation)
- deleteDocument: 5 tests (no chunks, with chunks, file cleanup, not found, early exit)

## Next Steps

- **04d UploadController:** Create REST endpoints that inject DocumentsService and handle multipart/form-data
- **04e DocumentsModule:** Wire up dependencies (Prisma, Queue, Qdrant) and provide BullMQ 'document-upload' queue instance
- **04f Integration Tests:** End-to-end document upload flow with worker
