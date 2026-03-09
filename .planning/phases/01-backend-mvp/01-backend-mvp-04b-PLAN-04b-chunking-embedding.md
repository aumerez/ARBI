---
phase: 01-backend-mvp
plan: 04b
type: execute
wave: 14
depends_on:
  - 04a
files_modified:
  - src/documents/chunking/text-splitter.service.ts
  - src/documents/chunking/semantic-chunker.ts
autonomous: true
requirements:
  - DOC-07
user_setup: []
must_haves:
  truths:
    - "TextSplitterService uses LangChain RecursiveCharacterTextSplitter with configurable chunkSize (1000-1500) and overlap (10-20%)"
    - "TextSplitterService.splitText(text: string): Promise<string[]> returns semantically meaningful chunks"
    - "Separators include: '\\n\\n', '\\n', '. ', ' ', '' to preserve paragraphs and sentences"
    - "Chunker respects code boundaries (procedures/paragraphs) to avoid mid-sentence splits"
    - "Token estimation: roughly 4 chars per token (conservative)"
    - "Service is stateless and reusable across documents"
  artifacts:
    - path: "src/documents/chunking/text-splitter.service.ts"
      provides: "Service wrapping LangChain text splitter with default config"
      min_lines: 20
      exports:
        - "splitText(text: string): Promise<string[]>"
        - "setChunkOptions(size: number, overlap: number)"
    - path: "src/documents/chunking/semantic-chunker.ts"
      provides: "Optional advanced semantic chunker (if not using simple recursive splitter)"
      min_lines: 15
  key_links:
    - from: "TextSplitterService"
      to: "DocumentUploadWorker"
      via: "worker.splitText = this.textSplitter.splitText(text)"
      pattern: "textSplitter.splitText"
    - from: "TextSplitterService"
      to: "@langchain/textsplitters"
      via: "new RecursiveCharacterTextSplitter({ separators, chunkSize, chunkOverlap })"
      pattern: "RecursiveCharacterTextSplitter"
    - from: "TextSplitterService"
      to: "LangChain TextSplitter API"
      pattern: "splitText"
    - from: "DocumentUploadWorker (04e)"
      to: "TextSplitterService"
      via: "constructor injection and usage"
      pattern: "this.textSplitter"

---

<objective>
Implement semantic text chunking service for document processing

Purpose: Provide consistent, semantic-aware text splitting with configurable chunk sizes and overlap. This service will be used by DocumentUploadWorker to break extracted document text into chunks suitable for embedding generation.

Output: TextSplitterService with splitText method, integrated with LangChain

</objective>

<execution_context>
@/Users/franciscoegloff/projects/metacortex/ops-ai-platform/.planning/workflows/execute-plan.md
@/Users/franciscoegloff/projects/metacortex/ops-ai-platform/.planning/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/01-backend-mvp/01-CONTEXT.md
@.planning/phases/01-backend-mvp/01-RESEARCH.md

# Chunking requirements (DOC-07):
- Target chunk size: 500-1500 tokens (we'll use ~1000 characters? Actually tokens ~4 chars => 2000-6000 characters)
- Overlap: 10-20% (so ~200-400 characters)
- Semantic awareness: respect paragraphs, sections, code blocks, lists
- Use LangChain's RecursiveCharacterTextSplitter with separators: ['\n\n', '\n', '. ', ' ', '']
- Splitting: first by paragraphs, then by sentences, then by spaces, finally by characters if needed.

# Performance:
- Should process quickly; no async I/O required beyond returning array
- Stateless; can be instantiated once and reused

# Configuration:
- Allow chunkSize and chunkOverlap to be configured via environment or fixed default
- For MVP default: chunkSize=1000 (characters or tokens? LangChain uses lengthFunction default: text.length) but we could use token counting via tiktoken? That adds dependency. Simpler: use character count with approximate token ratio. 1000 chars ~250 tokens. That's a bit low. We want 500-1500 tokens, so 2000-6000 chars. Let's use chunkSize = 2000, chunkOverlap = 400 (20%).
- Actually LangChain RecursiveCharacterTextSplitter parameters: chunkSize (number), chunkOverlap (number). They are in characters by default. We'll set chunkSize: 2000, chunkOverlap: 400.

# Implementation pattern:
- Create class TextSplitterService with method splitText(text: string): Promise<string[]>
- Internally instantiate RecursiveCharacterTextSplitter with appropriate separators and bounds
- Call splitText from LangChain (which returns Document[]; we need to extract pageContent)
- Alternatively, use LangChain TextSplitter directly in worker without service wrapper. But we want service for reusability and testability.

# Files:
- src/documents/chunking/text-splitter.service.ts
- src/documents/chunking/semantic-chunker.ts (optional more advanced version with embeddings-based chunking; not needed for MVP). We'll create a simple placeholder semantic-chunker if desired.

We'll create both as requested: text-splitter.service and semantic-chunker (maybe extends base). But we can keep semantic-chunker empty or with simple semantic splitting using newlines. But to satisfy must_haves we list both paths. We'll create minimal semantic-chunker that uses TextSplitterService.

Actually the must_haves block already listed two files. So we must create both.

We can implement:
- text-splitter.service.ts: wraps RecursiveCharacterTextSplitter
- semantic-chunker.ts: uses TextSplitterService, maybe with slight adjustments for semantics (e.g., prioritize code fences). But it can just delegate.

Better: make text-splitter the primary service. semantic-chunker could be a variant. We'll create both.

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement TextSplitterService with LangChain</name>
  <files>
    src/documents/chunking/text-splitter.service.ts
  </files>
  <action>
    Create TextSplitterService:

    ```typescript
    import { Injectable } from '@nestjs/common';
    import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

    @Injectable()
    export class TextSplitterService {
      private splitter: RecursiveCharacterTextSplitter;

      constructor() {
        this.splitter = new RecursiveCharacterTextSplitter({
          separators: ['\n\n', '\n', '. ', ' ', ''],
          chunkSize: 2000,   // ~500-1500 tokens (roughly 4 chars/token)
          chunkOverlap: 400, // 20% overlap
          lengthFunction: (text) => text.length, // character count
        });
      }

      async splitText(text: string): Promise<string[]> {
        const docs = await this.splitter.splitText(text);
        // docs is Document[] with pageContent
        return docs.map(doc => doc.pageContent);
      }

      // Optional: allow runtime config
      setChunkOptions(chunkSize: number, chunkOverlap: number): void {
        this.splitter = new RecursiveCharacterTextSplitter({
          separators: ['\n\n', '\n', '. ', ' ', ''],
          chunkSize,
          chunkOverlap,
          lengthFunction: (text) => text.length,
        });
      }
    }
    ```

    Verify: Service compiles, imports LangChain correctly.
  </action>
  <verify>
    <automated>
      npx tsc --noEmit src/documents/chunking/text-splitter.service.ts &&
      echo "TextSplitterService compiled"
    </automated>
  </verify>
  <done>TextSplitterService with splitText method created</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create SemanticChunker wrapper</name>
  <files>
    src/documents/chunking/semantic-chunker.ts
  </files>
  <action>
    Create semantic-chunker.ts as an alternative that may incorporate future semantic boundary detection:

    ```typescript
    import { TextSplitterService } from './text-splitter.service';

    export class SemanticChunker {
      constructor(private readonly textSplitter: TextSplitterService) {}

      async chunk(text: string): Promise<string[]> {
        // For MVP, just delegate to TextSplitterService
        return this.textSplitter.splitText(text);
      }
    }
    ```

    This provides a placeholder for more advanced semantic splitting (e.g., using embeddings) in future phases.

    Verify: Compiles, exports class with chunk method.
  </action>
  <verify>
    <automated>
      npx tsc --noEmit src/documents/chunking/semantic-chunker.ts &&
      echo "SemanticChunker compiled"
    </automated>
  </verify>
  <done>SemanticChunker wrapper created</done>
</task>

</tasks>

<verification>
Wave 3b - Text splitting service ready

**Automated checks:**
1. TextSplitterService exists and compiles
2. Service uses RecursiveCharacterTextSplitter with separators ['\n\n', '\n', '. ', ' ', '']
3. Service exposes splitText(text) method returning string[]
4. SemanticChunker exists and delegates to TextSplitterService
5. No runtime errors when constructing service

**Requirements mapping:**
- DOC-07: Chunking with semantic awareness ✓ (via RecursiveCharacterTextSplitter)
- Overlap 10-20% (400 chars on 2000 chunk size = 20%) ✓
- Token estimate: 2000 chars ~500 tokens, within 500-1500 range ✓

**Dependencies:**
- @langchain/textsplitters package must be installed (from standard stack)
- No external services

**Integration:**
- DocumentUploadWorker (04e) will inject TextSplitterService and call splitText instead of inline chunking

**Next:** 04c (DocumentsService) which uses chunk counts and creates DocumentChunk records.

</verification>

<success_criteria>
Chunking service complete when:
- [ ] TextSplitterService class with splitText method using RecursiveCharacterTextSplitter
- [ ] Separators configured for paragraph/sentence awareness
- [ ] chunkSize 2000, chunkOverlap 400 (20%)
- [ ] Service provided as injectable in module (DocumentsModule)
- [ ] SemanticChunker wrapper exists
- [ ] TypeScript compiles for both files

**Deliverable:** Semantic chunking foundation for document processing.

**Output:** `.planning/phases/01-backend-mvp/01-backend-mvp-04b-PLAN-04b-summary.md`

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-04b-PLAN-04b-summary.md`
