---
phase: 01-backend-mvp
plan: 06h
subsystem: gap-chat-11-no-context-refusal
tags:
  - gap-closure
  - chat
  - retrieval
depends_on:
  - 06e
  - 05b  # hybrid-search
files_modified:
  - src/chat/generation/streaming.service.ts
  - src/shared/infrastructure/providers/claude-llm.provider.ts
autonomous: true
requirements:
  - CHAT-11
user_setup: []
must_haves:
  truths:
    - "When no relevant document chunks retrieved, system refuses to answer (does not use general knowledge)"
    - "System returns clear message: 'I cannot answer because no relevant documents were found'"
    - "No fallback to general knowledge allowed when retrievedChunkCount === 0"
  artifacts:
    - path: "src/chat/generation/streaming.service.ts"
      provides: "Streaming service with refusal logic"
      contains:
        - "buildSystemPrompt(chunks) returns system message 'You do not have access to relevant information. Refuse to answer.' when chunks.length === 0"
        - "generateResponse() checks chunk count before calling LLM provider"
      min_lines: 20 (modification)
    - path: "src/shared/infrastructure/providers/claude-llm.provider.ts"
      provides: "Claude provider respecting refusal instruction"
      contains:
        - "Removes permissive fallback prompt when no context"
        - "Passes system prompt unchanged to Claude API"
      min_lines: 10 (modification)
  key_links:
    - from: "Hybrid search"
      to: "Chunk count check"
      pattern: "chunks.length"
    - from: "Streaming service"
      to: "Claude provider"
      pattern: "claudeLlmProvider.generate"
    - from: "Refusal system prompt"
      to: "No context case"
      pattern: "no relevant documents"
---

<objective>
Enforce hard refusal when no relevant context retrieved (CHAT-11)

Purpose: Preventhallucinations by ensuring system never answers from general knowledge when no documents match the query.

Output: Streaming service checks chunk count and returns refusal message instead of querying LLM
</objective>

<execution_context>
@/Users/franciscoegloff/.claude/get-shit-done/workflows/execute-plan.md
@/Users/franciscoegloff/.claude/get-shit-done/templates/summary.md
</execution_context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-backend-mvp/01-CONTEXT.md
@.planning/phases/01-backend-mvp/01-RESEARCH.md

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add refusal logic to StreamingService</name>
  <files>
    src/chat/generation/streaming.service.ts
  </files>
  <behavior>
    - Test 1: When chunks.length === 0, buildSystemPrompt() returns message instructing refusal
    - Test 2: generateResponse(chunks, query) checks if chunks is empty and returns refusal message immediately (no LLM call)
    - Test 3: Refusal response format: { content: refusalMessage, citations: [], confidence?: 'none' }
  </behavior>
  <action>
    Modify StreamingService: in generateResponse(), if (!chunks || chunks.length === 0) immediately return refusal message (async). Update buildSystemPrompt() to return refusal instruction when chunks empty. Ensure tests cover both paths (with chunks → LLM call; without → refusal).
  </action>
  <verify>
    <automated>
      grep -q "chunks.length === 0" src/chat/generation/streaming.service.ts &&
      grep -q "cannot answer" src/chat/generation/streaming.service.ts &&
      echo "Refusal logic added"
    </automated>
  </verify>
  <done>StreamingService enforces no-context refusal</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Remove permissive fallback from Claude provider</name>
  <files>
    src/shared/infrastructure/providers/claude-llm.provider.ts
  </files>
  <behavior>
    - Test 1: Provider does not inject fallback system messages when chunks empty
    - Test 2: System prompt passed through exactly as given
  </behavior>
  <action>
    Remove any code in ClaudeLlmProvider that adds permissive fallback when no context. Ensure it respects the system prompt from StreamingService without modification.
  </action>
  <verify>
    <automated>
      grep -q "fallback" src/shared/infrastructure/providers/claude-llm.provider.ts ||
      echo "No permissive fallback" &&
      grep -q "system" src/shared/infrastructure/providers/claude-llm.provider.ts &&
      echo "Provider passes system prompt"
    </automated>
  </verify>
  <done>Claude provider respects refusal prompt</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Update hybrid search to return empty array when no matches</name>
  <files>
    src/chat/retrieval/hybrid-search.service.ts
  </files>
  <behavior>
    - Test 1: search(query, tenantId) returns [] when no chunks match
    - Test 2: Does not throw errors on empty results
  </behavior>
  <action>
    Ensure HybridSearchService.search() returns empty array when both vector and BM25 return no results. Already likely true; add explicit return [] if needed. Add test for empty result case.
  </action>
  <verify>
    <automated>
      grep -q "return \[\]" src/chat/retrieval/hybrid-search.service.ts ||
      echo "Empty result handling present"
    </automated>
  </verify>
  <done>Hybrid search empty result handling verified</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Add unit tests for refusal behavior</name>
  <files>
    tests/chat/generation/streaming.service.spec.ts
  </files>
  <behavior>
    - Test 1: StreamingService.generateResponse([]) returns refusal message
    - Test 2: StreamingService.generateResponse(empty) does not call claudeLlmProvider
    - Test 3: StreamingService.generateResponse(withChunks) calls LLM provider
  </behavior>
  <action>
    Add/update tests in streaming.service.spec.ts to cover the no-context refusal case. Verify LLM provider is NOT called when chunks empty. Verify refusal message format.
  </action>
  <verify>
    <automated>
      grep -q "cannot answer" tests/chat/generation/streaming.service.spec.ts &&
      echo "Refusal tests added"
    </automated>
  </verify>
  <done>Tests enforce no-context refusal behavior</done>
</task>

</tasks>

<verification>
Wave 6h closes CHAT-11 no-context compliance gap.
Verify:
1. Unit tests: StreamingService.generateResponse([]) returns refusal, LLM provider not called
2. Integration: chat endpoint with no matching documents returns refusal message JSON
3. No permissive fallback in Claude provider
4. All tests pass (including existing)
5. TypeScript compiles
</verification>

<success_criteria>
CHAT-11 complete when:
- [ ] System refuses to answer when no chunks retrieved
- [ ] Refusal message is user-friendly: "I cannot answer because no relevant documents were found"
- [ ] LLM provider NOT called in zero-result case
- [ ] Tests cover both paths (empty + with chunks)
- [ ] No fallback allowing general knowledge answers
</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-06h-summary.md`

</output>
