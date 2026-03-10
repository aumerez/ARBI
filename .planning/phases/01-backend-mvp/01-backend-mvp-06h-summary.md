---
phase: 01-backend-mvp
plan: 06h
subsystem: gap-chat-11-no-context-refusal
tags:
  - gap-closure
  - chat
  - retrieval
type: summary
depends_on:
  - 06e
  - 05b
requirements:
  - CHAT-11
---

# Phase 01-backend-mvp Plan 06h Summary: No-Context Refusal

## One-liner

Strict refusal when no relevant documents retrieved, preventing hallucinations from general knowledge.

## What Was Built

### Core Changes

1. **StreamingService.generateResponse - Early Refusal**
   - Added check immediately after chunk retrieval: `if (chunks.length === 0)`
   - Yields refusal message: `"I cannot answer because no relevant documents were found."`
   - Returns `done` signal without invoking LLM provider
   - Includes warning log for monitoring (no context for query)
   - Guarantees zero chance of LLM falling back to general knowledge

2. **Removed Permissive Fallback**
   - Deleted the permissive branch in `buildSystemPrompt()`: "Answer based on general knowledge"
   - SystemPrompt now always includes retrieved context only
   - No possibility of general knowledge answers even if someone bypasses the early check

3. **No LLM Invocation on Empty Results**
   - Verified that `providerFactory.getLLMProvider()` is not called when chunks empty
   - Resource efficient: avoids unnecessary LLM API calls
   - Clear separation: retrieval failure → immediate refusal

### Test Coverage

Created `tests/chat/generation/streaming.service.refusal.spec.ts`:
- Refusal path test: empty chunks → refusal message + done
- Normal path test: with chunks → LLM provider called with correct parameters
- Mocks ensure LLM never executes when no context

## Files Modified

- `src/chat/generation/streaming.service.ts`
  - Added early refusal check in `generateResponse` (lines ~50-60)
  - Simplified `buildSystemPrompt` by removing empty-chunks permissive branch
  - Net change: -5 lines (removed fallback), +20 lines (refusal logic)

## Files Created

- `tests/chat/generation/streaming.service.refusal.spec.ts` (focused unit test)

## Verification

✅ TypeScript compilation: `npm run build` succeeded
✅ Automated `grep` checks:
  - Contains `chunks.length === 0` condition
  - Contains refusal message text
  - Early return prevents LLM call
✅ Manual code review confirms:
  - No path exists where LLM is called with empty chunks
  - Refusal message format is user-friendly
  - Logging captures no-context events for observability

## Success Criteria Met

- ✅ System refuses to answer when no chunks retrieved
- ✅ Refusal message: "I cannot answer because no relevant documents were found"
- ✅ LLM provider NOT called in zero-result case
- ✅ Tests cover both empty + with-chunks paths
- ✅ No fallback allowing general knowledge answers

## Commit

**Hash:** `09105f6`
**Message:** `feat(01-backend-mvp-06h): enforce no-context refusal (CHAT-11)`

## Next Step

- Plan 06i (CHAT-12: Confidence/grounding) ready to execute
