---
phase: 1
slug: backend-mvp
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2025-03-08
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x |
| **Config file** | `jest.config.js` (to be created in Wave 0) |
| **Quick run command** | `npm test -- --bail --passWithNoTests` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --bail --passWithNoTests`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | TEN-01, TEN-02 | integration | `npm test -- AuthModule.test.ts` | ⬜ pending | ⬜ pending |
| 01-01-02 | 01 | 0 | TEN-01 | integration | `npm test -- RlsMiddleware.test.ts` | ⬜ pending | ⬜ pending |
| 01-02-01 | 02 | 0 | AUTH-01, AUTH-02 | e2e | `npm test -- AuthController.test.ts` | ⬜ pending | ⬜ pending |
| 01-02-02 | 02 | 0 | AUTH-04 | integration | `npm test -- PasswordResetService.test.ts` | ⬜ pending | ⬜ pending |
| 01-03-01 | 03 | 0 | DOC-01, DOC-02 | e2e | `npm test -- UploadController.test.ts` | ⬜ pending | ⬜ pending |
| 01-03-02 | 03 | 0 | DOC-06, DOC-07 | integration | `npm test -- ChunkingService.test.ts` | ⬜ pending | ⬜ pending |
| 01-03-03 | 03 | 0 | DOC-08 | integration | `npm test -- EmbeddingService.test.ts` | ⬜ pending | ⬜ pending |
| 01-04-01 | 04 | 0 | CHAT-01, CHAT-02 | e2e | `npm test -- ChatController.test.ts` | ⬜ pending | ⬜ pending |
| 01-04-02 | 04 | 0 | CHAT-03, CHAT-04 | integration | `npm test -- RagService.test.ts` | ⬜ pending | ⬜ pending |
| 01-04-03 | 04 | 0 | CHAT-11, QUAL-03 | integration | `npm test -- CitationValidator.test.ts` | ⬜ pending | ⬜ pending |
| 01-05-01 | 05 | 0 | QUAL-04 | integration | `npm test -- RateLimitGuard.test.ts` | ⬜ pending | ⬜ pending |
| 01-05-02 | 05 | 0 | QUAL-05 | security | `npm test -- EncryptionService.test.ts` | ⬜ pending | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/e2e/auth.e2e.test.ts` — Multi-tenant authentication flow
- [ ] `tests/e2e/upload.e2e.test.ts` — Document upload with status tracking
- [ ] `tests/e2e/chat.e2e.test.ts` — End-to-end chat with citations
- [ ] `tests/integration/rls-integration.test.ts` — Verify tenant isolation enforced by DB
- [ ] `tests/conftest.ts` — Shared fixtures (database cleanup, test tenants)
- [ ] `jest.config.js` — Jest configuration with TypeScript support
- [ ] `npm install --save-dev jest @types/jest ts-jest` — Test framework installation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-time SSE streaming format | CHAT-10 | Requires live client connection testing | 1. Connect to `/chat/stream` endpoint; 2. Send query; 3. Verify data events contain `content` and `citation` fields; 4. Confirm type-out effect |
| Email verification flow | AUTH-01 | Requires mail server/interceptor | 1. Register user; 2. Check test mail inbox; 3. Click verification link; 4. Verify login succeeds |
| Document processing async status | DOC-04, DOC-05 | Requires BullMQ worker running | 1. Upload document; 2. Poll status endpoint; 3. Verify transitions: queued → processing → indexed; 4. Check error state on invalid file |
| Cross-encoder reranking quality | CHAT-02 | Requires relevance judgment | 1. Prepare test queries with known relevant chunks; 2. Run retrieval; 3. Manually verify top-5 contains expected documents; 4. Compare with/without reranking |
| Claude citation accuracy | CHAT-03, CHAT-04 | Requires LLM response validation | 1. Send query with known context; 2. Inspect response citations; 3. Verify each `[N]` maps to correct chunk; 4. Check no fake citations |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency estimated < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (pending planner approval)

**Approval:** pending
