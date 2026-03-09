---
phase: 01-backend-mvp
plan: 05e
type: execute
wave: 17
depends_on:
  - 05d
files_modified:
  - src/chat/validation/citation-validator.service.ts
  - src/chat/generation/streaming.service.ts
autonomous: true
requirements:
  - QUAL-03
user_setup: []
must_haves:
  truths:
    - "CitationValidatorService.validate(text: string, retrievedChunkCount: number): { valid: boolean, errors: string[] } checks that every citation [n] references a valid chunk number (1 ≤ n ≤ retrievedChunkCount)"
    - "StreamingService invokes validator after LLM stream completes, before saving assistant message; if invalid, logs warning but still saves message (or optionally strips invalid citations)"
    - "Validation includes regex to find all \\[\\d+\\] patterns"
    - "Service handles simple numbering; later can expand to validate specific chunk citations"
    - "Tests: 'See [1] [2]' with 2 chunks → valid; 'See [3]' with 2 chunks → invalid"
  artifacts:
    - path: "src/chat/validation/citation-validator.service.ts"
      provides: "Citation validation logic"
      min_lines: 30
    - path: "src/chat/generation/streaming.service.ts"
      provides: "Updated to call validator after streaming"
      min_lines: 80 (plus modifications)
  key_links:
    - from: "StreamingService"
      to: "CitationValidatorService"
      via: "const result = this.citationValidator.validate(fullText, chunks.length)"
      pattern: "citationValidator.validate"
    - from: "CitationValidatorService"
      to: "Retrieved chunk count"
      via: "retrievedChunkCount determines max valid number"
      pattern: "retrievedChunkCount"

---

<objective>
Validate response citations against retrieved sources

Purpose: Ensure AI-generated citations ([1], [2]) correspond to actual retrieved chunks. Prevent fake citations (hallucination).

Output: CitationValidatorService integrated into streaming generation

</objective>

<execution_context>
@/Users/franciscoegloff/projects/metacortex/ops-ai-platform/.planning/workflows/execute-plan.md
@/Users/franciscoegloff/projects/metacortex/ops-ai-platform/.planning/templates/summary.md</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/01-backend-mvp/01-CONTEXT.md
@.planning/phases/01-backend-mvp/01-RESEARCH.md

# Validation approach (QUAL-03):
- After LLM streaming completes, we have full response text.
- We know how many chunks were retrieved (chunks.length).
- Extract all citation numbers using regex /\[(\d+)\]/g.
- For each number n, check if 1 ≤ n ≤ chunks.length. If any n exceeds, it's invalid (cites non-existent source).
- Could also validate duplicates, but not necessary.
- Return validation result; log if invalid.

# Integration:
- In StreamingService.generateResponse, after streaming loop and before saving assistant message, run validator.
- If invalid, either (a) still save but log warning, or (b) strip invalid citations. Simpler: log warning and save as-is. Requirement says "validate" not "reject". We can store validation status in ChatMessage (add boolean field citationsValid or validationErrors Json). But to avoid schema changes, we'll just log.
- Alternatively, we could modify the system prompt to instruct LLM to only cite within provided range; but still validate.

# Future: More precise validation: ensure cited chunk's content actually supports the claim (semantic similarity). Out of scope for MVP.

# Files:
- Create src/chat/validation/citation-validator.service.ts
- Update src/chat/generation/streaming.service.ts to call validator

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement CitationValidatorService</name>
  <files>
    src/chat/validation/citation-validator.service.ts
  </files>
  <action>
    Create service:

    ```typescript
    import { Injectable, Logger } from '@nestjs/common';

    @Injectable()
    export class CitationValidatorService {
      private readonly logger = new Logger(CitationValidatorService.name);
      private readonly citationRegex = /\[(\d+)\]/g;

      validate(text: string, retrievedChunkCount: number): { valid: boolean; errors: string[] } {
        if (retrievedChunkCount === 0) {
          // No chunks, any citation is invalid
          const citations = this.extractCitations(text);
          if (citations.length > 0) {
            return { valid: false, errors: ['Citations present but no retrieved chunks'] };
          }
          return { valid: true, errors: [] };
        }

        const errors: string[] = [];
        const citations = this.extractCitations(text);
        for (const num of citations) {
          if (num < 1 || num > retrievedChunkCount) {
            errors.push(`Invalid citation [${num}]: expected 1-${retrievedChunkCount}`);
          }
        }

        const valid = errors.length === 0;
        return { valid, errors };
      }

      private extractCitations(text: string): number[] {
        const matches = text.matchAll(this.citationRegex);
        const numbers: number[] = [];
        for (const match of matches) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num)) {
            numbers.push(num);
          }
        }
        return numbers;
      }
    }
    ```

    Verify: Service compiles; unit tests would check validation.
  </action>
  <verify>
    <automated>
      npx tsc --noEmit src/chat/validation/citation-validator.service.ts &&
      echo "CitationValidatorService compiled"
    </automated>
  </verify>
  <done>CitationValidatorService with basic range check implemented</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Integrate validator into StreamingService</name>
  <files>
    src/chat/generation/streaming.service.ts
  </files>
  <action>
    Modify StreamingService generateResponse to include validation step:

    - Inject CitationValidatorService in constructor.
    - After the forawait loop completes and before saving assistant message, call validator.
    - If invalid, log warning with errors; optionally we could modify message content to strip invalid citations, but keep message as is.
    - Optionally add a ChatMessage field to store validation result (would require schema change - avoid for now). Just log.

    Code addition:

    ```typescript
    // In constructor: private readonly citationValidator: CitationValidatorService
    // After streaming loop:
    const validation = this.citationValidator.validate(fullText, chunks.length);
    if (!validation.valid) {
      this.logger.warn(`Citation validation failed for chat ${chatId}: ${validation.errors.join(', ')}`);
    }
    // Then save assistant message as before
    ```

    Ensure we also import CitationValidatorService in module (ChatModule or create ValidationModule). We'll need to provide it in ChatModule or a shared module. We can add it to ChatModule providers.

    Verify: StreamingService now uses CitationValidatorService.
  </action>
  <verify>
    <automated>
      grep -q "CitationValidatorService" src/chat/generation/streaming.service.ts &&
      grep -q "validate(fullText, chunks.length)" src/chat/generation/streaming.service.ts &&
      echo "Citation validation integrated into streaming"
    </automated>
  </verify>
  <done>StreamingService calls CitationValidator after LLM response</done>
</task>

</tasks>

<verification>
Wave 4e - Citation validation integrated

**Automated checks:**
1. CitationValidatorService exists with validate(text, retrievedChunkCount) returning {valid, errors}
2. Regex extracts [number] patterns
3. StreamingService injects CitationValidatorService
4. After streaming loop, validator called and warnings logged
5. ChatMessage saved regardless of validation result
6. TypeScript compiles

**Requirements coverage:**
- QUAL-03: Citation validation ensures citations match retrieved sources ✓

**Integration:**
- Depends on 05d (StreamingService)
- Chaining: 05d → 05e → 05f

</verification>

<success_criteria>
Citation validation ready when:
- [ ] CitationValidatorService implemented with range check
- [ ] StreamingService invokes validator after LLM streaming completes
- [ ] Validation errors logged; message still saved
- [ ] `npx tsc --noEmit` passes

**Deliverable:** Protection against fake citations.

**Output:** `.planning/phases/01-backend-mvp/01-backend-mvp-05e-PLAN-05e-summary.md`

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-05e-PLAN-05e-summary.md`
