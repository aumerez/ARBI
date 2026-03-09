---
phase: 01-backend-mvp
plan: 05
type: execute
wave: 4
depends_on:
  - 02
  - 03
files_modified:
  - src/chat/chat.module.ts
  - src/chat/chat.controller.ts
  - src/chat/chat.service.ts
  - src/chat/retrieval/hybrid-search.service.ts
  - src/chat/retrieval/reranker.service.ts
  - src/chat/generation/claude-client.service.ts
  - src/chat/generation/citation-validator.service.ts
  - src/chat/generation/streaming.service.ts
  - src/chat/guards/no-context.guard.ts
  - src/chat/guards/confidence.guard.ts
  - src/chat/dto/chat-request.dto.ts
  - src/chat/dto/chat-response.dto.ts
autonomous: true
requirements:
  - CHAT-01
  - CHAT-02
  - CHAT-03
  - CHAT-04
  - CHAT-10
  - CHAT-11
  - CHAT-12
  - QUAL-03
user_setup: []
must_haves:
  truths:
    - "User can create a new chat conversation and send messages"
    - "System retrieves relevant document chunks using hybrid search (semantic 0.7 + BM25 0.3 with RRF fusion)"
    - "System reranks retrieved chunks using cross-encoder for better precision"
    - "System generates Claude responses grounded in retrieved context with streaming"
    - "Responses include inline citations ([1], [2]) linking to source chunks"
    - "System validates citations match retrieved sources (no fake citations)"
    - "System refuses to answer when no relevant context found"
    - "System indicates confidence level when sources are weak"
  artifacts:
    - path: "src/chat/chat.module.ts"
      provides: "NestJS module for chat and RAG pipeline"
    - path: "src/chat/chat.controller.ts"
      provides: "Chat endpoints: POST /chats, GET /chats, POST /chats/:id/messages, GET /chats/:id/stream"
    - path: "src/chat/chat.service.ts"
      provides: "Conversation management, message persistence, orchestration of retrieval + generation"
    - path: "src/chat/retrieval/hybrid-search.service.ts"
      provides: "Hybrid search with semantic + BM25 using RRF fusion (weights 0.7/0.3)"
    - path: "src/chat/retrieval/reranker.service.ts"
      provides: "Cross-encoder reranking (ms-marco-MiniLM-L-6-v2) - optional MVP"
    - path: "src/chat/generation/claude-client.service.ts"
      provides: "Claude API client with streaming and citation handling"
    - path: "src/chat/generation/citation-validator.service.ts"
      provides: "Post-generation citation validation against retrieved chunks"
    - path: "src/chat/generation/streaming.service.ts"
      provides: "SSE formatting and event streaming to client"
    - path: "src/chat/guards/no-context.guard.ts"
      provides: "Guard blocking responses when retrieval confidence below threshold"
    - path: "src/chat/guards/confidence.guard.ts"
      provides: "Confidence scoring and flagging for weak sources"
    - path: "src/chat/dto/chat-request.dto.ts"
      provides: "Validation DTO for chat message (message: string)"
    - path: "src/chat/dto/chat-response.dto.ts"
      provides: "Response DTO for non-streaming chat (answer, citations, confidence)"
  key_links:
    - from: "src/chat/retrieval/hybrid-search.service.ts"
      to: "src/shared/infrastructure/qdrant.service.ts"
      via: "qdrant.search(semantic) + qdrant.search(bm25)"
      pattern: "qdrant.search"
    - from: "src/chat/chat.service.ts"
      to: "hybrid-search.service.ts + reranker.service.ts + claude-client.service.ts"
      via: "orchestration: search → rerank → generate → validate citations"
      pattern: "retrieveRerankGenerate"
    - from: "src/chat/generation/claude-client.service.ts"
      to: "Anthropic SDK"
      via: "anthropic.messages.stream"
      pattern: "messages.stream"
    - from: "src/chat/chat.controller.ts"
      to: "src/chat/generation/streaming.service.ts"
      via: "stream response with @Res() passthrough"
      pattern: "streamingService.formatStream"
    - from: "src/chat/guards/no-context.guard.ts"
      to: "hybrid-search.service.ts"
      via: "search score threshold check"
      pattern: "search.*score"

---

<objective>
Implement chat API with RAG engine: hybrid search, reranking, Claude streaming, and citation validation

Purpose: Deliver the core RAG functionality: user queries retrieve relevant document chunks via hybrid search (semantic + BM25 with RRF), reranked for precision, grounded in Claude with streaming responses and inline citations. Enforce no hallucinations via no-context guard.

Output: Chat endpoints (create conversation, send message, list conversations, streaming responses) with full RAG pipeline

</objective>

<execution_context>
@/Users/franciscoegloff/.claude/get-shit-done/workflows/execute-plan.md
@/Users/franciscoegloff/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-backend-mvp/01-CONTEXT.md
@.planning/phases/01-backend-mvp/01-RESEARCH.md

# Key research patterns:
- Hybrid search: semantic (dense vector 0.7 weight) + BM25 (lexical 0.3 weight) with RRF fusion (k=60)
- Cross-encoder reranker: ms-marco-MiniLM-L-6-v2 (can be optional Phase 1, behind feature flag)
- Claude streaming: Messages API with stream=true; SSE events to client: event: token, event: done with citations
- Citation validation: post-process response, parse [1],[2] → verify chunk IDs match retrieved set
- No-context guard: Check retrieval scores; if max score < threshold (0.5), refuse to answer
- Confidence scoring: Based on average/top retrieval scores; indicate weak grounding
- Conversation storage: Chat, ChatMessage tables with tenant_id, userId; cascade delete

# Interfaces from previous plans:
- JwtPayload: { sub: userId, tenant_id: number }
- QdrantService.search returns SearchResult[] with { id, score, payload }
- OpenAIService.generateEmbedding(query) returns number[] (3072 dim)
- DocumentChunk metadata: chunk_id, document_id, content, documentName, pageNumber

# Important:
- Tenant isolation: All Qdrant queries filter by tenant_id
- Streaming: Controller uses @Res({ passthrough: true }) and sets SSE headers
- RRF fusion algorithm: For each result at rank r, score += 1/(60+r); then sort descending
- BM25 in Qdrant: Use search with vector: null and query_mode: 'fulltext' or similar (verify client API)

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create ChatModule with all providers</name>
<files>
    src/chat/chat.module.ts
  </files>
  <behavior>
    - Test 1: ChatModule imports DatabaseModule, QdrantModule, OpenAIModule (or OpenAI service)
    - Test 2: Provides: ChatService, HybridSearchService, RerankerService, ClaudeClientService, CitationValidatorService, StreamingService
    - Test 3: No circular dependencies with other modules
    - Test 4: Guards (NoContextGuard, ConfidenceGuard) provided as injectable
  </behavior>
  <action>
    Create ChatModule:

    - Imports: DatabaseModule (for chat persistence), QdrantModule, ConfigModule (for Claude model, thresholds)
    - Provides all chat services and guards
    - Optionally export ChatService if needed elsewhere (unlikely)

    Verify: Module structure follows NestJS best practices; all providers declared in module.providers.
  </action>
  <verify>
    <automated>grep -q "ChatModule" src/chat/chat.module.ts && grep -q "ChatService" src/chat/chat.module.ts && grep -q "providers: \\[" src/chat/chat.module.ts && echo "ChatModule defined"</automated>
  </verify>
  <done>ChatModule with all RAG services registered</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement HybrydSearchService with RRF fusion</name>
<files>
    src/chat/retrieval/hybrid-search.service.ts
  </files>
  <behavior>
    - Test 1: search(query, tenantId, k=10) performs semantic search (vector) and BM25 search (keyword)
    - Test 2: Semantic search uses OpenAIService.generateEmbedding(query) to get vector
    - Test 3: BM25 search uses Qdrant text query (verify exact parameter: vector: null, query: query, query_mode: 'fulltext' or 'bm25')
    - Test 4: Both searches filter by tenant_id
    - Test 5: RRF fusion: combine results using reciprocal rank fusion with k=60 constant
    - Test 6: Returns top k results after fusion with payloads intact
    - Test 7: Each SearchResult includes { id, score, payload } where payload has document_id, chunk_index, content
  </behavior>
  <action>
    Implement HybridSearchService:

    ```typescript
    @Injectable()
    export class HybridSearchService {
      constructor(
        private openai: OpenAIService,
        private qdrant: QdrantService,
        private config: ConfigService,
      ) {}

      async search(query: string, tenantId: number, k: number = 10): Promise<SearchResult[]> {
        // 1. Generate query embedding
        const queryVector = await this.openai.generateEmbeddings([query]);
        const vector = queryVector[0];

        // 2. Semantic search
        const semanticResults = await this.qdrant.search({
          tenantId,
          vector,
          limit: k * 2, // oversample for fusion
          filter: {},
          params: { hnsw_ef: 256 },
        });

        // 3. BM25 search
        const lexicalResults = await this.qdrant.search({
          tenantId,
          vector: null, // triggers Qdrant BM25 mode
          limit: k * 2,
          filter: {},
          query: query, // BM25 query string
          params: { query_mode: 'fulltext' }, // verify exact syntax
        });

        // 4. RRF fusion
        return this.rrfFuse(semanticResults, lexicalResults, k);
      }

      private rrfFuse(semantic: SearchResult[], lexical: SearchResult[], k: number): SearchResult[] {
        const scores = new Map<string, number>();
        const K = 60;

        semantic.forEach((r, rank) => {
          scores.set(r.id, (scores.get(r.id) || 0) + 1 / (K + rank));
        });

        lexical.forEach((r, rank) => {
          scores.set(r.id, (scores.get(r.id) || 0) + 1 / (K + rank));
        });

        return Array.from(scores.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, k)
          .map(([id]) => semantic.find(r => r.id === id)!);
      }
    }
    ```

    Verify: Service uses correct Qdrant client parameters; RRF algorithm implemented per RESEARCH.
  </action>
  <verify>
    <automated>grep -q "async search" src/chat/retrieval/hybrid-search.service.ts && grep -q "rrfFuse" src/chat/retrieval/hybrid-search.service.ts && grep -q "query: null" src/chat/retrieval/hybrid-search.service.ts && echo "HybridSearch with RRF defined"</automated>
  </verify>
  <done>HybridSearchService with semantic + BM25 fusion ready</done>
</task>

<task type="auto">
  <name>Task 3: Implement RerankerService (optional MVP)</name>
<files>
    src/chat/retrieval/reranker.service.ts
  </files>
  <action>
    Create RerankerService as optional (feature flag ENABLE_RERANKER=true):

    - For MVP, can use simple no-op: return top K chunks as-is (skip reranking)
    - Or implement cross-encoder using HuggingFace Inference Endpoints (requires external API key)
    - Research suggests: cross-encoder model ms-marco-MiniLM-L-6-v2
    - Method: rerank(query: string, chunks: RetrievedChunk[]): Promise<RetrievedChunk[]>
      * Compute similarity scores for each chunk
      * Sort by score descending
      * Return top K (or reorder input array)

    For MVP simplicity: implement identity function (`return chunks;`) and log warning that reranker is experimental.

    If implementing real reranker: use @xenova/transformers Node.js to load model (CPU inference 10-50ms per chunk). But that adds heavy dependency. Decision: skip for Phase 1, mark as Phase 3 enhancement per RESEARCH open question #5.

    Verify: Service exists, compiles, exports rerank method (even if stub).
  </action>
  <verify>
    <automated>grep -q "rerank" src/chat/retrieval/reranker.service.ts && echo "RerankerService defined (stub or real)"</automated>
  </verify>
  <done>RerankerService implemented (stub for MVP optional)</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Implement ClaudeClientService with streaming</name>
<files>
    src/chat/generation/claude-client.service.ts
  </files>
  <behavior>
    - Test 1: streamChat(messages, retrievedChunks) returns AsyncIterable of tokens
    - Test 2: Builds system prompt with retrieved context and citation instructions
    - Test 3: System prompt includes numbered chunks [1], [2], etc. with document name and page
    - Test 4: Calls Anthropic Messages API with stream=true, model from env (claude-sonnet-4-6)
    - Test 5: Temperature 0.3 for factual groundedness
    - Test 6: Max tokens 4096
    - Test 7: Stream emits 'text' deltas and final 'message_stop' with citations
    - Test 8: Handles errors from Anthropic API (network, API errors)
  </behavior>
  <action>
    Create ClaudeClientService:

    - Import Anthropic from '@anthropic-ai/sdk'
    - Constructor: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    - Method: async *streamChat(messages: ChatMessage[], retrievedChunks: RetrievedChunk[]): AsyncIterable<StreamChunk>
      * Build system prompt:
      ```
      You are a technical assistant for oil & gas operations. Answer ONLY using provided context.
      If no relevant info, say "I cannot answer based on available documents."

      Context:
      ${chunks.map((c,i) => `[${i+1}] ${c.content} (source: ${c.documentName}, page ${c.pageNumber || '?'})`).join('\n')}

      Instructions:
      - Cite sources inline using [1], [2], etc.
      - Never cite sources not listed above.
      - If uncertain, say so.
      ```
      * Call: this.anthropic.messages.stream({ model: 'claude-sonnet-4-6', max_tokens: 4096, system: systemPrompt, messages: messages.map(m=>({role: m.role, content: m.content})), stream: true, temperature: 0.3 })
      * Iterate events: content_block_delta (text), message_stop (citations)
      * Yield { type: 'text', text } for deltas; yield { type: 'done', citations } at end
    - Error handling: throw ChatGenerationError with details

    Verify: Service uses correct Anthropic SDK streaming pattern from RESEARCH.
  </action>
  <verify>
    <automated>grep -q "async \*streamChat" src/chat/generation/claude-client.service.ts && grep -q "anthropic.messages.stream" src/chat/generation/claude-client.service.ts && grep -q "Anthropic" src/chat/generation/claude-client.service.ts && echo "Claude streaming service defined"</automated>
  </verify>
  <done>ClaudeClientService with streaming and citation support ready</done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: Implement CitationValidatorService</name>
<files>
    src/chat/generation/citation-validator.service.ts
  </files>
  <behavior>
    - Test 1: validateCitations(responseText, retrievedChunks) returns { valid: boolean, correctedResponse? }
    - Test 2: Extracts citation numbers from response using regex /\[(\d+)\]/g
    - Test 3: Validates each citation index (1-based) is within retrievedChunks.length
    - Test 4: If any invalid citation → return { valid: false }
    - Test 5: If all valid → return { valid: true }
    - Test 6: Optionally: generate warning if citation numbers non-sequential (still valid but odd)
  </behavior>
  <action>
    Create CitationValidatorService:

    ```typescript
    @Injectable()
    export class CitationValidatorService {
      validate(response: string, retrievedChunks: RetrievedChunk[]): { valid: boolean; correctedResponse?: string } {
        const citationRegex = /\[(\d+)\]/g;
        const chunkCount = retrievedChunks.length;
        const citedIds: number[] = [];
        let match;

        while ((match = citationRegex.exec(response)) !== null) {
          const index = parseInt(match[1], 10) - 1; // Convert to 0-based
          if (index < 0 || index >= chunkCount) {
            return { valid: false }; // Invalid citation detected
          }
          citedIds.push(index);
        }

        // All citations valid
        return { valid: true };
      }
    }
    ```

    Use this post-generation to verify QUAL-03 requirement. If invalid, either regenerate or strip invalid citations with note.

    Verify: Regex correctly parses [1], [2], [10] etc; handles multiple citations.
  </action>
  <verify>
    <automated>grep -q "validate\(" src/chat/generation/citation-validator.service.ts && grep -q "/\\\\[(" src/chat/generation/citation-validator.service.ts && echo "CitationValidator defined"</automated>
  </verify>
  <done>CitationValidatorService for QUAL-03 requirement ready</done>
</task>

<task type="auto">
  <name>Task 6: Implement NoContextGuard and ConfidenceGuard</name>
<files>
    src/chat/guards/no-context.guard.ts
    src/chat/guards/confidence.guard.ts
    src/chat/guards/index.ts (optional barrel)
  </files>
  <behavior>
    - Test 1 (NoContextGuard): CanActivate checks if search results empty OR all scores below threshold (0.5)
    - Test 2 (NoContextGuard): If insufficient context, sets response flag and prevents Claude call
    - Test 3 (ConfidenceGuard): Computes confidence score from retrieved chunk scores (avg or max)
    - Test 4 (ConfidenceGuard): Attaches confidence level (high/medium/low) to request context for inclusion in response
    - Test 5: Guards executed before ChatGPT service (in controller pipeline)
  </behavior>
  <action>
    Implement guards:

    1. no-context.guard.ts (implements CanActivate):
       - Dependency: inject HybridSearchService via custom decorator or execute search in guard
       - Better: Move search to service, then guard checks results
       - Implementation: Guard called before chat generation. Access search results from request context (set by preceding middleware or service)
       - Guard: if no results or maxScore < 0.5 → throw BusinessException('Cannot answer based on available documents') or set flag in request
       - Alternative: Controller handles by checking results before calling Claude; guard not needed. Simpler: Service method returns decision, not guard.
       - For now implement as service method `shouldAnswer(results)` and controller uses it.

    2. confidence.guard.ts (less a guard, more a scorer):
       - Class: ConfidenceService: computeScore(results: SearchResult[]): 'high' | 'medium' | 'low'
       - Thresholds: high ≥0.8, medium 0.5-0.8, low <0.5 (based on top score or average)
       - Attach to conversation context or include in response DTO

    Since guards typically run before route handler, but we need retrieval results first, the flow is:

    Controller → ChatService.sendMessage(query):
       1. retrieval = await hybridSearch.search(query)
       2. if (!shouldAnswer(retrieval)) return refusal
       3. confidence = computeConfidence(retrieval)
       4. response = await claudeClient.streamChat(...)
       5. validate citations
       6. save messages, return

    So guards may not be appropriate. Instead create services.

    Revised: Create NoContextService and ConfidenceService (not guards). These are business logic, not request guards.

    Keep names but implement as regular services. Remove "Guard" suffix. Update must_haves.

    Action: Create `src/chat/services/no-context.service.ts` and `src/chat/services/confidence.service.ts` instead.

    Compromise: Keep file paths as originally planned but implement as services, not guards (guard interface not needed). Tests from Plan 01 expect these as services anyway.

    Implement:

    - no-context.service.ts: `shouldAnswer(results: SearchResult[], threshold = 0.5): boolean`
    - confidence.service.ts: `getConfidence(results: SearchResult[]): 'low'|'medium'|'high'`

    Verify: Services implement business logic, can be injected into ChatService.
  </action>
  <verify>
    <automated>grep -q "shouldAnswer" src/chat/guards/no-context.guard.ts && grep -q "getConfidence" src/chat/guards/confidence.guard.ts && echo "NoContext and Confidence logic ready"</automated>
  </verify>
  <done>Context validation and confidence scoring services implemented</done>
</task>

<task type="auto" tdd="true">
  <name>Task 7: Implement StreamingService (SSE formatter)</name>
<files>
    src/chat/generation/streaming.service.ts
  </files>
  <behavior>
    - Test 1: formatToken(token: string) returns SSE event string: `event: token\ndata: {"text":"..."}\n\n`
    - Test 2: formatDone(citations) returns SSE done event: `event: done\ndata: {"citations":[...]}\n\n`
    - Test 3: formatError(error) returns SSE error event
    - Test 4: StreamingService.write(response, event) writes to Response object with proper headers
    - Test 5: Headers set: Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive
  </behavior>
  <action>
    Create StreamingService:

    ```typescript
    @Injectable()
    export class StreamingService {
      formatToken(token: string): string {
        return `event: token\ndata: ${JSON.stringify({ text: token })}\n\n`;
      }

      formatDone(citations?: Citation[]): string {
        const data = citations ? { citations } : {};
        return `event: done\ndata: ${JSON.stringify(data)}\n\n`;
      }

      formatError(error: Error): string {
        return `event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`;
      }

      async stream(
        response: Response,
        stream: AsyncIterable<StreamChunk>,
        onComplete?: (citations: Citation[]) => void
      ): Promise<void> {
        response.setHeader('Content-Type', 'text/event-stream');
        response.setHeader('Cache-Control', 'no-cache');
        response.setHeader('Connection', 'keep-alive');

        try {
          for await (const chunk of stream) {
            if (chunk.type === 'text') {
              response.write(this.formatToken(chunk.text));
            }
            if (chunk.type === 'done') {
              response.write(this.formatDone(chunk.citations));
              onComplete?.(chunk.citations);
            }
          }
        } catch (error) {
          response.write(this.formatError(error as Error));
        } finally {
          response.end();
        }
      }
    }
    ```

    Verify: Methods produce correctly formatted SSE lines.
  </action>
  <verify>
    <automated>grep -q "formatToken" src/chat/generation/streaming.service.ts && grep -q "Content-Type: text/event-stream" src/chat/generation/streaming.service.ts && echo "StreamingService SSE formatter ready"</automated>
  </verify>
  <done>StreamingService for SSE formatting and response streaming ready</done>
</task>

<task type="auto" tdd="true">
  <name>Task 8: Implement ChatService orchestration</name>
<files>
    src/chat/chat.service.ts
    src/chat/dto/chat-response.dto.ts
    src/chat/dto/chat-request.dto.ts
  </files>
  <behavior>
    - Test 1: createConversation(userId, tenantId, title?) creates Chat record and returns chatId
    - Test 2: listConversations(userId, tenantId) returns chats with preview (last message snippet)
    - 3: sendMessage(chatId, message, userId, tenantId) orchestrates:
        a. Save user message to ChatMessage (role=user)
        b. HybridSearchService.search(query, tenantId) → retrievedChunks
        c. Check no-context: shouldAnswer(results) → if false, return refusal response
        d. Compute confidence: getConfidence(results) → store in response
        e. Optional: RerankerService.rerank(query, results) → rerankedChunks
        f. ClaudeClientService.streamChat(history, rerankedChunks) → stream tokens
        g. CitationValidatorService.validate(finalResponse, retrievedChunks) → if invalid, regenerate or strip
        h. Save assistant message to ChatMessage (role=assistant, content, citations, retrievedChunkIds)
        i. Return streaming (or full response for non-streaming endpoint)
    - Test 4: deleteConversation(chatId, tenantId) cascades delete messages
    - Test 5: All operations enforce tenant isolation (tenant_id in WHERE)
  </behavior>
  <action>
    Implement ChatService:

    ```typescript
    @Injectable()
    export class ChatService {
      constructor(
        private db: DatabaseService,
        private hybridSearch: HybridSearchService,
        private reranker: RerankerService,
        private claude: ClaudeClientService,
        private citationValidator: CitationValidatorService,
        private noContext: NoContextService,
        private confidence: ConfidenceService,
      ) {}

      async createConversation(userId: number, tenantId: number, title?: string): Promise<Chat> {
        return this.db.prisma.chat.create({
          data: { user_id: userId, tenant_id: tenantId, title: title || 'New Chat', created_at: new Date() },
        });
      }

      async listConversations(userId: number, tenantId: number): Promise<Chat[]> {
        return this.db.prisma.chat.findMany({
          where: { user_id: userId, tenant_id: tenantId },
          orderBy: { updated_at: 'desc' },
        });
      }

      async *sendMessage(chatId: number, message: string, userId: number, tenantId: number): AsyncIterable<ChatStreamChunk> {
        // Save user message
        await this.db.prisma.chatMessage.create({
          data: { chat_id: chatId, role: 'user', content: message, created_at: new Date() },
        });

        // Retrieve context
        const results = await this.hybridSearch.search(message, tenantId, 10);

        // No-context check
        if (!this.noContext.shouldAnswer(results)) {
          yield { type: 'refusal', content: 'I cannot answer based on available documents.' };
          return;
        }

        // Confidence score
        const confidenceLevel = this.confidence.getConfidence(results);
        yield { type: 'confidence', level: confidenceLevel };

        // Rerank (optional)
        const chunks = await this.reranker.rerank(message, results);

        // Build chat history
        const history = await this.buildHistory(chatId);

        // Stream from Claude
        let fullResponse = '';
        const citations: Citation[] = [];

        for await (const chunk of this.claude.streamChat(history, chunks)) {
          if (chunk.type === 'text') {
            fullResponse += chunk.text;
            yield { type: 'token', text: chunk.text };
          }
          if (chunk.type === 'done') {
            citations.push(...chunk.citations);
          }
        }

        // Validate citations
        const validation = this.citationValidator.validate(fullResponse, results);
        if (!validation.valid) {
          // For MVP, log warning but keep response (regenerate would require second API call)
          logger.warn('Invalid citations detected in Claude response', { chatId, response: fullResponse });
        }

        // Save assistant message with citations and retrieved chunk IDs
        await this.db.prisma.chatMessage.create({
          data: {
            chat_id: chatId,
            role: 'assistant',
            content: fullResponse,
            citations: JSON.stringify(citations),
            retrieved_chunk_ids: JSON.stringify(results.map(r => r.id)),
            created_at: new Date(),
          },
        });

        yield { type: 'done', citations };
      }

      async deleteConversation(chatId: number, tenantId: number): Promise<void> {
        await this.db.prisma.chatMessage.deleteMany({ where: { chat_id: chatId } });
        await this.db.prisma.chat.delete({ where: { id: chatId } });
      }

      private async buildHistory(chatId: number): Promise<ChatMessage[]> {
        const messages = await this.db.prisma.chatMessage.findMany({
          where: { chat_id: chatId },
          orderBy: { created_at: 'asc' },
          take: 20, // limit context window
        });
        return messages.map(m => ({ role: m.role, content: m.content }));
      }
    }
    ```

    Verify: Service orchestrates full RAG pipeline; all dependencies injected; AsyncIterable streaming pattern.
  </action>
  <verify>
    <automated>grep -q "async \*sendMessage" src/chat/chat.service.ts && grep -q "hybridSearch.search" src/chat/chat.service.ts && grep -q "claude.streamChat" src/chat/chat.service.ts && echo "ChatService orchestration implemented"</automated>
  </verify>
  <done>ChatService orchestrating retrieval, reranking, generation, validation complete</done>
</task>

<task type="auto" tdd="true">
  <name>Task 9: Implement ChatController with streaming endpoint</name>
<files>
    src/chat/chat.controller.ts
  </files>
  <behavior>
    - Test 1: POST /chats creates new conversation (protected) returns 201 with chatId
    - Test 2: GET /chats lists user's conversations (protected)
    - Test 3: POST /chats/:id/messages sends message and returns non-streaming response (optional)
    - Test 4: GET /chats/:id/messages/stream streams SSE events (tokens, confidence, done)
    - Test 5: DELETE /chats/:id deletes conversation (cascade)
    - Test 6: All endpoints use @UseGuards(JwtAuthGuard, TenantContextGuard)
    - Test 7: Streaming controller sets SSE headers and uses @Res({ passthrough: true })
  </behavior>
  <action>
    Create ChatController:

    ```typescript
    @Controller('chats')
    @UseGuards(JwtAuthGuard, TenantContextGuard)
    export class ChatController {
      constructor(private chatService: ChatService) {}

      @Post()
      async createChat(@Req() req: Request, @Body() request: CreateChatDto): Promise<{ chatId: number }> {
        const tenantId = (req.user as JwtPayload).tenant_id;
        const userId = (req.user as JwtPayload).sub;
        const chat = await this.chatService.createConversation(userId, tenantId, request.title);
        return { chatId: chat.id };
      }

      @Get()
      async listChats(@Req() req: Request): Promise<Chat[]> {
        const tenantId = (req.user as JwtPayload).tenant_id;
        const userId = (req.user as JwtPayload).sub;
        return this.chatService.listConversations(userId, tenantId);
      }

      @Delete(':id')
      async deleteChat(@Param('id') id: string, @Req() req: Request): Promise<void> {
        const tenantId = (req.user as JwtPayload).tenant_id;
        await this.chatService.deleteConversation(parseInt(id), tenantId);
      }

      @Post(':id/messages')
      async sendMessage(
        @Param('id') id: string,
        @Body() request: SendMessageDto,
        @Req() req: Request
      ): Promise<ChatResponseDto> {
        // Non-streaming fallback (collect all tokens)
        const response = await this.chatService.sendMessage(parseInt(id), request.message, (req.user as JwtPayload).sub, (req.user as JwtPayload).tenant_id).toArray();
        // Build full response from chunks
        const content = response.filter(c => c.type === 'token').map(c => c.text).join('');
        const citations = response.find(c => c.type === 'done')?.citations || [];
        const confidence = response.find(c => c.type === 'confidence')?.level || 'low';
        return { chatId: parseInt(id), content, citations, confidence };
      }

      @Get(':id/messages/stream')
      async streamMessage(
        @Param('id') id: string,
        @Body() request: SendMessageDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
      ): Promise<void> {
        const tenantId = (req.user as JwtPayload).tenant_id;
        const userId = (req.user as JwtPayload).sub;

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        try {
          for await (const chunk of this.chatService.sendMessage(parseInt(id), request.message, userId, tenantId)) {
            if (chunk.type === 'token') {
              res.write(`event: token\ndata: ${JSON.stringify({ text: chunk.text })}\n\n`);
            }
            if (chunk.type === 'confidence') {
              res.write(`event: confidence\ndata: ${JSON.stringify({ level: chunk.level })}\n\n`);
            }
            if (chunk.type === 'done') {
              res.write(`event: done\ndata: ${JSON.stringify({ citations: chunk.citations })}\n\n`);
            }
            if (chunk.type === 'refusal') {
              res.write(`event: refusal\ndata: ${JSON.stringify({ content: chunk.content })}\n\n`);
              break;
            }
          }
        } catch (error) {
          res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
        } finally {
          res.end();
        }
      }
    }
    ```

    DTOs:
    - CreateChatDto: { title?: string }
    - SendMessageDto: { message: string }
    - ChatResponseDto: { chatId: number; content: string; citations: Citation[]; confidence: 'low'|'medium'|'high' }

    Verify: Controller sets SSE headers and streams tokens; guards protect all routes.
  </action>
  <verify>
    <automated>grep -q "@Controller('chats')" src/chat/chat.controller.ts && grep -q "streamMessage" src/chat/chat.controller.ts && grep -q "text/event-stream" src/chat/chat.controller.ts && echo "ChatController with streaming endpoint defined"</automated>
  </verify>
  <done>ChatController with create, list, send, stream, delete complete</done>
</task>

<task type="auto">
  <name>Task 10: Add ChatModule to AppModule</name>
<files>
    src/app/app.module.ts
  </files>
  <action>
    Update src/app/app.module.ts to import ChatModule:

    ```typescript
    @Module({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
        DatabaseModule,
        RedisModule,
        QdrantModule,
        AuthModule,
        DocumentsModule,
        ChatModule, // ← Add
      ],
      // ...
    })
    ```

    Verify: All modules imported in dependency order (Auth → Documents → Chat). No circular imports.
  </action>
  <verify>
    <automated>grep -q "ChatModule" src/app/app.module.ts && echo "ChatModule integrated"</automated>
  </verify>
  <done>ChatModule added to application root</done>
</task>

<task type="auto">
  <name>Task 11: Create Chat database relationship models</name>
<files>
    prisma/schema.prisma
  </files>
  <action>
    Verify that Chat and ChatMessage models exist in schema.prisma from Plan 02. If not, add:

    model Chat {
      id            Int            @id @default(autoincrement())
      tenant_id     Int
      user_id       Int
      title         String?
      messages      ChatMessage[]
      created_at    DateTime       @default(now())
      updated_at    DateTime       @updatedAt

      @@index([tenant_id])
      @@index([user_id])
    }

    model ChatMessage {
      id                Int       @id @default(autoincrement())
      chat_id           Int
      role              ChatRole  // enum: 'user', 'assistant'
      content           String
      citations         Json?     // array of { number, documentId, page? }
      retrieved_chunk_ids Json?   // array of string chunk IDs
      created_at        DateTime  @default(now())

      chat              Chat      @relation(fields: [chat_id], references: [id], onDelete: Cascade)

      @@index([chat_id])
      @@index([tenant_id]) // denormalized? Add via trigger or manual
    }

    enum ChatRole {
      user
      assistant
    }

    Also ensure DocumentChunk model exists with: id, document_id, chunk_index, content, (embedding stored in Qdrant only)

    Run: `npx prisma validate` to ensure schema still valid.

    Note: tenant_id in ChatMessage should match Chat's tenant_id via denormalization or join. Simplify: add tenant_id directly to ChatMessage for RLS, set on message creation by copying from Chat.

    Update schema if needed, but Plan 02 should have created these. Quick check and add missing pieces.
  </action>
  <verify>
    <automated>grep -q "model Chat" prisma/schema.prisma && grep -q "model ChatMessage" prisma/schema.prisma && echo "Chat models present in schema"</automated>
  </verify>
  <done>Chat and ChatMessage models verified/added to schema</done>
</task>

</tasks>

<verification>
Wave 4 - RAG Chat Engine Complete

**Automated verification sequence:**
1. Unit tests (from Plan 01): `npx jest tests/chat/*.spec.ts --runInBand`
   - Hybrid search: RRF fusion, semantic + BM25 results
   - Claude client: streaming token emission, citation extraction
   - Citation validator: validates/invalidates responses
   - Confidence service: scoring thresholds
2. Integration test: `npx jest tests/integration/chat-streaming.integration.spec.ts --runInBand`
   - Full flow: query → hybrid search → Claude streaming → SSE response
3. Manual end-to-end test (using test client):
   - Create chat: POST /chats → 201 {chatId}
   - Send message: POST /chats/1/messages → 200 with response {content, citations, confidence}
   - Stream: GET /chats/1/messages/stream → see event: token lines
   - Verify citations in response refer to document chunks

**Requirements mapping:**
- CHAT-01: Create chat endpoint (POST /chats)
- CHAT-02: Hybrid search with RRF fusion (0.7/0.3 weights)
- CHAT-03: Claude streaming with context
- CHAT-04: Inline citations [1], [2] in response
- CHAT-10: Streaming responses via SSE
- CHAT-11: No-context guard (refusal when no relevant chunks or low scores)
- CHAT-12: Confidence indication (low/medium/high) sent to client
- QUAL-03: Citation validation post-generation

**Critical checks:**
- Tenant isolation: All Qdrant searches filter by tenant_id; Chat queries filter by tenant_id (RLS)
- RRF algorithm: K=60 constant, reciprocal rank fusion
- BM25 query parameters: Verify exact Qdrant client syntax (`query: string, vector: null, params: { query_mode: 'fulltext' }` or similar)
- Streaming SSE format: Each event ends with double newline \n\n; content-type text/event-stream
- Citation validation: Parses response text, ensures [n] within bounds of retrievedChunks.length
- No hallucinations guard: If max retrieval score < 0.5, refuse to answer (per CHAT-11)

**Performance expectations:**
- Hybrid search latency: <1 second (combine two Qdrant queries + RRF)
- Claude streaming: First token within 1 second of API call (per Phase 1 success criteria)
- Reranking (if enabled): +50-200ms per query (cross-encoder CPU inference)

**Dependencies:**
- Depends on DocumentsModule (Qdrant collections must exist with data from uploaded documents)
- Requires OpenAI service for query embedding
- Requires Anthropic API key configured

</verification>

<success_criteria>
RAG chat engine complete when:
- [ ] ChatModule imports Database, Qdrant; provides all chat services
- [ ] HybridSearchService.search returns fused results with RRF; calls Qdrant for semantic + BM25
- [ ] ClaudeClientService.streamChat yields tokens, builds system prompt with numbered context
- [ ] CitationValidatorService.validate checks all [n] citations are within bounds
- [ ] NoContextService.shouldAnswer returns false when all scores <0.5 (refusal)
- [ ] ConfidenceService.getConfidence returns 'high'/'medium'/'low' based on scores
- [ ] StreamingService formats SSE events correctly (event: token, done, error)
- [ ] ChatService orchestrates: search → no-context check → confidence → (optional rerank) → claude → validate → persist
- [ ] ChatController: POST /chats (201), GET /chats (200), POST /chats/:id/messages (200), GET /chats/:id/messages/stream (SSE), DELETE /chats/:id (204)
- [ ] All chat unit tests pass: `npx jest tests/chat/*.spec.ts`
- [ ] Integration test: full streaming chat flow works with test documents

**Quality gates:**
- [ ] No hallucinations: When retrievedChunks empty, response is refusal message (not made-up answer)
- [ ] Citations validated: Post-generation check logs warnings but retains response for MVP (future: regenerate)
- [ ] Streaming SSE validated with curl: `curl -N http://localhost:3000/chats/1/messages/stream` streams tokens line-by-line
- [ ] Tenant isolation: Chat queries limited to tenant_id from JWT; Qdrant searches filter by tenant_id

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-05-PLAN-05-summary.md`
</output>
