---
phase: 01-backend-mvp
plan: 06i
subsystem: gap-chat-12-confidence-grounding
tags:
  - gap-closure
  - chat
  - confidence
depends_on:
  - 06e
  - 05b  # hybrid-search
  - 05c  # reranker (optional)
files_modified:
  - src/chat/generation/streaming.service.ts
  - src/chat/retrieval/hybrid-search.service.ts
  - src/chat/types/chat.types.ts
autonomous: true
requirements:
  - CHAT-12
user_setup: []
must_haves:
  truths:
    - "System calculates confidence score based on retrieval scores (similarity, count, variance)"
    - "Low confidence responses include grounding indicator (e.g., 'Based on limited information...')"
    - "Confidence metadata included in chat response (score, reason)"
  artifacts:
    - path: "src/chat/retrieval/hybrid-search.service.ts"
      provides: "Quality metrics from retrieval results"
      contains:
        - "Returns chunk count, average score, max score, score variance"
        - "Determines if results are high-quality or low-confidence"
      min_lines: 20 (modification)
    - path: "src/chat/generation/streaming.service.ts"
      provides: "Confidence scoring and grounding logic"
      contains:
        - "calculateConfidence(chunks): computes score from retrieval metrics"
        - "buildSystemPrompt(chunks, confidence): adds grounding prefix when confidence low"
        - "Response includes confidence metadata (score, level)"
      min_lines: 40 (modification)
    - path: "src/chat/types/chat.types.ts"
      provides: "Extended response type with confidence"
      contains:
        - "interface ChatResponse { content: string, citations: ChunkCitation[], confidence?: { score: number, level: 'high' | 'medium' | 'low' } }"
      min_lines: 15 (addition)
  key_links:
    - from: "Hybrid search results"
      to: "Confidence calculation"
      pattern: "calculateConfidence"
    - from: "Confidence level"
      to: "System prompt grounding"
      pattern: "groundingPrefix"
    - from: "Chat response"
      to: "Confidence metadata"
      via: "json response"
      pattern: "confidence"
---

<objective>
Add confidence scoring and grounding indicators (CHAT-12)

Purpose: Signal to users when answers are based on weak or limited document sources, improving transparency and trust.

Output: Confidence score calculation, grounding prefix for low-confidence responses, metadata in API response
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
  <name>Task 1: Enhance HybridSearchService to return quality metrics</name>
  <files>
    src/chat/retrieval/hybrid-search.service.ts
  </files>
  <behavior>
    - Test 1: search() returns not just chunks but also { chunks, metrics: { count, avgScore, maxScore, scoreVariance } }
    - Test 2: Metrics computed from hybrid RRF scores (or vector BM25 scores if RRF not scoring)
    - Test 3: Handles empty chunks (metrics zeros)
  </behavior>
  <action>
    Modify HybridSearchService.search() to compute retrieval quality metrics. Calculate from chunk scores (after RRF fusion). Return object with chunks and metrics. Update any callers to handle new return shape.
  </action>
  <verify>
    <automated>
      grep -q "metrics" src/chat/retrieval/hybrid-search.service.ts &&
      grep -q "avgScore\|variance" src/chat/retrieval/hybrid-search.service.ts &&
      echo "Quality metrics computed"
    </automated>
  </verify>
  <done>Hybrid search returns quality metrics</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Define confidence score and response type</name>
  <files>
    src/chat/types/chat.types.ts
  </files>
  <behavior>
    - Test: ChatResponse interface includes optional confidence: { score: number, level: 'high' | 'medium' | 'low' }
  </behavior>
  <action>
    Extend ChatResponse type to include confidence metadata. Define ConfidenceLevel enum or literal types.
  </action>
  <verify>
    <automated>
      grep -q "confidence" src/chat/types/chat.types.ts &&
      echo "Confidence type added"
    </automated>
  </verify>
  <done>Chat response type extended with confidence</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Implement confidence calculation and grounding logic</name>
  <files>
    src/chat/generation/streaming.service.ts
  </files>
  <behavior>
    - Test 1: calculateConfidence(metrics) returns numeric score (0-1) weighted by chunk count, avg score, low variance → high score
    - Test 2: Level thresholds: high (>0.7), medium (0.4-0.7), low (<0.4)
    - Test 3: buildSystemPrompt(chunks, confidence) prefixes: "High confidence → standard answer", "Medium → 'Based on the provided documents...'", "Low → 'Based on limited information from the documents...'"
    - Test 4: Response includes confidence metadata in JSON
  </behavior>
  <action>
    Add calculateConfidence(metrics) function. Map metrics to score (e.g., normalize count to 0.3, avgScore to 0.5, variance penalty 0.2). Add groundingPrefix(level) helper returning appropriate prefix. Update generateResponse() to compute confidence and include in response. Add grounding prefix to system message when confidence is medium/low.
  </action>
  <verify>
    <automated>
      grep -q "calculateConfidence" src/chat/generation/streaming.service.ts &&
      grep -q "Based on limited" src/chat/generation/streaming.service.ts &&
      echo "Confidence and grounding implemented"
    </automated>
  </verify>
  <done>Confidence scoring and grounding added</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Update tests for confidence feature</name>
  <files>
    tests/chat/generation/streaming.service.spec.ts
  </files>
  <behavior>
    - Test 1: verify confidence score computed correctly for various metric inputs
    - Test 2: verify grounding prefix appears in system message for low/medium confidence
    - Test 3: verify response includes confidence metadata
  </behavior>
  <action>
    Add unit tests covering confidence calculation, grounding prefix logic, and response metadata. Update existing generateResponse tests to expect confidence field.
  </action>
  <verify>
    <automated>
      grep -q "confidence" tests/chat/generation/streaming.service.spec.ts &&
      echo "Confidence tests added"
    </automated>
  </verify>
  <done>Tests cover confidence/grounding</done>
</task>

</tasks>

<verification>
Wave 6i closes CHAT-12 confidence/grounding gap.
Verify:
1. Unit tests: confidence score ranges, grounding prefixes, response metadata
2. Integration: chat query with 1 weak chunk returns grounding prefix in answer and confidence level 'low'
3. High-confidence answer returns standard format without disclaimer
4. All existing tests still pass
5. TypeScript compiles
</verification>

<success_criteria>
CHAT-12 complete when:
- [ ] Confidence score calculated from retrieval metrics
- [ ] Low/medium confidence responses include grounding disclaimer prefix
- [ ] Confidence metadata in API response (score, level)
- [ ] Tests validate all confidence levels and prefixes
- [ ] No regression on existing chat functionality
</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-06i-summary.md`

</output>
