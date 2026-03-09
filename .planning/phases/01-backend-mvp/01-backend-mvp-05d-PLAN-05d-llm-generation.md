---
phase: 01-backend-mvp
plan: 05d
type: execute
wave: 16
depends_on:
  - 05c
files_modified:
  - src/chat/generation/claude-client.service.ts
  - src/chat/generation/local-llm.service.ts
  - src/chat/generation/streaming.service.ts
  - src/chat/types/chat.types.ts
autonomous: true
requirements:
  - CHAT-03
  - CHAT-04
  - CHAT-10
  - CHAT-11
  - CHAT-12
user_setup: []
must_haves:
  truths:
    - "ClaudeLLMProvider implements LLMProvider interface with streamChat(messages, context) returning AsyncIterable<StreamChunk>"
    - "LocalLLMProvider implements LLMProvider using Ollama chat API with SSE streaming"
    - "StreamingService orchestrates LLM calls: builds system prompt with retrieved context, handles streaming to client via Server-Sent Events"
    - "StreamChunk type includes { type: 'text'|'done'|'error', text?, citations?, error? }"
    - "ChatService.generateResponse(chatId, query, tenantId) retrieves relevant chunks (via HybridSearchService), calls LLM provider stream, stores messages in DB"
    - "All streaming responses are forwarded to client with proper Content-Type: text/event-stream"
    - "Provider choice (Claude vs Local) configurable via LLM_PROVIDER env var and ProviderFactory"
  artifacts:
    - path: "src/chat/generation/claude-client.service.ts"
      provides: "Anthropic Claude streaming client"
      min_lines: 50
    - path: "src/chat/generation/local-llm.service.ts"
      provides: "Local LLM (Ollama) streaming client"
      min_lines: 50
    - path: "src/chat/generation/streaming.service.ts"
      provides: "Orchestration: combines retrieval, LLM, and SSE"
      min_lines: 80
    - path: "src/chat/types/chat.types.ts"
      provides: "ChatMessage, StreamChunk, RetrievedChunk types"
      min_lines: 30
  key_links:
    - from: "StreamingService.generateResponse"
      to: "HybridSearchService.search"
      via: "const chunks = await this.hybridSearch.search(query, tenantId, 10)"
      pattern: "hybridSearch.search"
    - from: "StreamingService.generateResponse"
      to: "LLMProvider.streamChat"
      via: "this.llmProvider.streamChat(messages, chunks)"
      pattern: "llmProvider.streamChat"
    - from: "StreamingService"
      to: "ChatMessage persistence"
      via: "prisma.chatMessage.create"
      pattern: "prisma\\.chatMessage\\.create"
    - from: "ClaudeLLMProvider"
      to: "@anthropic-ai/sdk messages.stream"
      pattern: "anthropic.*messages.*stream"

---

<objective>
Implement LLM provider integration with streaming for Claude and Local (Ollama)

Purpose: Provide streaming chat completions grounded in retrieved context. Support both Anthropic Claude (cloud) and local Ollama. Integrate retrieval with generation to produce real-time responses.

Output: LLM providers and streaming orchestration service

</objective>

<execution_context>
@/Users/franciscoegloff/projects/metacortex/ops-ai-platform/.planning/workflows/execute-plan.md
@/Users/franciscoegloff/projects/metacortex/ops-ai/platform/planning/templates/summary.md
</context>

<context>
@.planning/ROADMAP.md
@.planning/phases/01-backend-mvp/01-CONTEXT.md
@.planning/phases/01-backend-mvp/01-RESEARCH.md

# LLM Provider requirements (CHAT-03, CHAT-10 streaming)

**ClaudeLLMProvider:**
- Implements LLMProvider.streamChat(messages, context) → AsyncIterable<StreamChunk>
- Uses Anthropic Messages API with streaming (messages.stream())
- System prompt includes retrieved context, instructs to cite using <cite> tags
- Model: claude-sonnet-4-6 (or claude-3-5-sonnet)
- Temperature 0.3, max_tokens ~2000
- Stream chunks: text delta, then done; citations can be included in special block after message complete? But StreamChunk may contain citations in 'text' or separate field. For MVP, we can stream text only and include citations as plain text with [1] markers, then later validate via separate service. Simpler: LLM returns text with citations already; we don't need to parse out separately; we just stream raw text.

**LocalLLMProvider:**
- Uses Ollama /api/chat with stream=true
- Model: llama2 or codellama
- Prompt similar to Claude but may need formatting adjustments
- Stream NDJSON lines, extract 'response' fields

**StreamingService:**
- Injects: HybridSearchService, ProviderFactory (for LLMProvider), PrismaService
- Method: async generateResponse(chatId: number, query: string, userId: number, tenantId: number): Promise<AsyncIterable<StreamChunk>>
  Steps:
  1. Save user message to ChatMessage (role='user', content=query)
  2. Retrieve relevant chunks: const chunks = await this.hybridSearch.search(query, tenantId, topK=10)
  3. Build messages array: system prompt with context, then chat history (previous messages from DB for this chat), then current user query.
  4. Get LLM provider: const provider = this.providerFactory.getLLMProvider()
  5. Stream: for await (const chunk of provider.streamChat(messages, chunks)) { yield chunk; optionally save assistant message chunks in real-time or accumulate }
  6. After stream completes, save full assistant message to ChatMessage (role='assistant', content=fullText, citations?).
  7. Link retrieved chunks (store chunk IDs or citation mapping). For MVP, we can store retrieved_chunk_ids array in ChatMessage.

- SSE endpoint: ChatController should have POST /chats/:id/messages that uses this service and returns stream.

**Types:**
- ChatMessage: { id, chat_id, role ('user'|'assistant'), content, citations?, retrieved_chunk_ids?, created_at }
- StreamChunk: { type: 'text'|'done'|'error', text?: string, citations?: Citation[], error?: string }

**Implementation details:**
- Claude provider: use Anthropic SDK: `anthropic.messages.stream({ model, system, messages, max_tokens, temperature })` returns stream of events.
- Map events: when content_block.delta.text appears, yield StreamChunk { type: 'text', text: delta.text }.
- When message_stop event, yield { type: 'done' }.
- Errors: catch and yield { type: 'error', error }.

- Ollama provider: use `POST /api/chat` with JSON `{ model, messages, stream: true }`. Response is NDJSON: each line JSON with 'message' object containing 'content' and 'done'. Yield text chunks accordingly.

**Dependencies:**
- HybridSearchService (05c)
- ProviderFactory (02e)
- PrismaService

**To be done in next plan (05e):** Citation validation service that checks quoted [1] etc against retrieved chunks.

I'll now write the plan file with tasks.

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Define chat types and chat message schema</name>
  <files>
    src/chat/types/chat.types.ts
  </files>
  <action>
    Create chat.types.ts:

    ```typescript
    export type ChatRole = 'user' | 'assistant';

    export interface ChatMessage {
      id: number;
      chat_id: number;
      role: ChatRole;
      content: string;
      retrieved_chunk_ids?: number[]; // array of DocumentChunk IDs
      created_at: Date;
      // Additional fields like citations? Could be computed
    }

    export interface RetrievedChunk {
      id: number;
      content: string;
      document_id: number;
      documentName?: string; // from payload
      score: number;
      embedding?: number[]; // optional for reranker
    }

    export interface StreamChunk {
      type: 'text' | 'done' | 'error';
      text?: string;
      citations?: Citation[];
      error?: string;
    }

    export interface Citation {
      number: number;
      chunkId: number;
      documentId: number;
      page?: number;
    }
    ```

    Verify: TypeScript compiles; exports types.
  </action>
  <verify>
    <automated>
      npx tsc --noEmit src/chat/types/chat.types.ts &&
      echo "Chat types defined"
    </automated>
  </verify>
  <done>ChatMessage, StreamChunk, RetrievedChunk interfaces defined</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement Claude and Local LLM providers</name>
  <files>
    src/chat/generation/claude-client.service.ts
    src/chat/generation/local-llm.service.ts
  </files>
  <action>
    These providers should implement LLMProvider interface defined earlier. We'll create them as independent services (could also be in shared/providers but for chat-specific we place here). They will be selected by ProviderFactory in 02e, but for now we implement them standalone; later we can update ProviderFactory to include them. However for this plan we just create services; integration with ProviderFactory can be in 02e or a later wiring. But 05d says "LLM provider integration" so we need to ensure they are used. We could modify ProviderFactory to include them, but that's in 02e which is already done? 02e already created claude-llm.provider.ts and local-llm.provider.ts according to its must_haves. Actually 02e includes those files. So maybe they already exist. Let's check 02e must_haves: includes claude-llm.provider.ts and local-llm.provider.ts. So we already have LLM provider implementations in shared infrastructure. So we don't need to create them again. But the revision plan for 05d expects to create these files? The must_haves list includes these files. But they are already created in 02e. There would be conflict if we create again. So we need to adjust: either we note that these providers already exist, and this plan focuses on the streaming orchestration service (StreamingService) that uses them. So files to modify: streaming.service.ts, maybe chat.types.ts. And we might adjust ProviderFactory if not already set up. But 02e should have already done it. So I'll set files_modified to only streaming.service.ts and perhaps not include claude-client.service.ts etc. But the must_haves lists those files, implying they are created here. That conflicts with 02e. Since we are the planner, we should ensure we don't duplicate. We must respect that 02e already created those services. Thus 05d should focus on the generation/streaming orchestration, not on the low-level providers. But the requirements for CHAT-03 and CHAT-10 are about generating responses and streaming. That's exactly what StreamingService does. So I'll revise: 05d creates StreamingService and maybe integrates with existing providers.

I'll adjust plan accordingly.

Thus new file list:
- src/chat/generation/streaming.service.ts
- Possibly extend chat.types for any needed types.

I'll also need a controller endpoint for chat messages: POST /chats/:id/messages. That could be in ChatController (maybe already created in 05a). 05a created ChatController with create/list/get. It didn't include message endpoints. We'll need to add message endpoints later, maybe in 05e or 05f. Actually 05d should include streaming endpoint. To avoid scope creep, I'll include the controller update as part of this plan? But files_modified currently only lists services. We could also modify chat.controller.ts to add new route. That would be part of this plan. But that might increase tasks. Let's think: The plan should be 2-3 tasks. Task 1: define types. Task 2: implement StreamingService. Task 3: extend ChatController with streaming endpoint. That's 3 tasks.

But must_haves lists only streaming.service.ts and chat.types.ts. It doesn't mention controller. I could include controller in files_modified as well. The frontmatter lists files_modified; I can add chat.controller.ts. That's fine.

Thus tasks:
1. Define chat.types (if not already defined; but we already created it as part of 05a? We created chat.entity.ts only. We didn't create chat.types.ts. So it's new.)
2. Implement StreamingService (streaming.service.ts)
3. Add streaming endpoint to ChatController (modify controller)

That's 3 tasks.

Let's adjust.

But also need to ensure that StreamingService uses HybridSearchService (05c) and ProviderFactory. We'll inject them.

Now implement streaming.service.ts:

```typescript
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ProviderFactory } from '../../shared/infrastructure/providers/provider.factory';
import { HybridSearchService } from '../retrieval/hybrid-search.service';
import { PrismaService } from '../../shared/database/database.service';
import { ChatMessage, StreamChunk, RetrievedChunk } from './chat.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerFactory: ProviderFactory,
    private readonly hybridSearch: HybridSearchService,
  ) {}

  async generateResponse(
    chatId: number,
    userId: number,
    tenantId: number,
    query: string,
  ): Promise<AsyncIterable<StreamChunk>> {
    // 1. Save user message
    await this.prisma.chatMessage.create({
      data: {
        chat_id: chatId,
        user_id: userId,
        role: 'user',
        content: query,
      },
    });

    // 2. Retrieve relevant chunks
    const chunks: RetrievedChunk[] = await this.hybridSearch.search(query, tenantId, 10);

    // 3. Build conversation context
    // Fetch recent messages from this chat for context (maybe last 10)
    const history = await this.prisma.chatMessage.findMany({
      where: { chat_id: chatId },
      orderBy: { created_at: 'asc' },
      take: 20, // limit
    });

    // Transform to Anthropic message format: [{ role: 'user'|'assistant', content: string }]
    const messages: { role: 'user' | 'assistant'; content: string }[] = history.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Add current user query as last user message (it's already in history? We added after, so it might be included if we requery. Simpler: we already saved user message, so history includes it. So we don't need separate; we can use history directly.

    // 4. System prompt with context
    const systemPrompt = this.buildSystemPrompt(chunks);

    // 5. Get LLM provider
    const llmProvider = this.providerFactory.getLLMProvider();

    // 6. Stream response
    let fullText = '';

    // We need to convert to AsyncIterable: we'll create an async generator
    const stream = (async function* () {
      try {
        for await (const chunk of llmProvider.streamChat(messages, chunks)) {
          if (chunk.type === 'text' && chunk.text) {
            fullText += chunk.text;
            yield chunk;
          } else if (chunk.type === 'error') {
            yield chunk;
            return;
          }
        }
        // After completion, save assistant message
        // Need to call service method outside generator? Can't after yielding? We'll save after iteration.
        // We'll save after the loop returns to caller? But generator finishes, control goes back. We need to perform action after stream ends. The generator function can do post-processing after the loop before returning.
        // We'll do: after forawait ends, we save assistant message to DB.
        // But we need access to this context. Use outer this? In generator function, `this` is not the class. Instead we can have the generator return the fullText via side channel, or we can save in the generator before returning. Actually we can do:
        //   let fullText = '';
        //   for await (const chunk of provider.streamChat(...)) { ... yield chunk; fullText += ...; }
        //   // after loop, save to DB using injected prisma
        //   await this.prisma.chatMessage.create(...);
        // But inside generator, `this` is undefined. We'll need to capture dependencies in closure: const prisma = this.prisma; etc. Then use them inside.
      } catch (err) {
        yield { type: 'error', error: err.message };
      }
    })();

    // But we need to also save after the stream is consumed. The async iterable should handle that internally; the consumer just reads until done. We can have the generator itself do the save after iteration. That works if we capture closure.

    // However the generator defined immediately as above can't access this.prisma after yield because we are inside the generator function. Actually we can: let fullText=''; const prisma = this.prisma; ... then in generator after forawait, call prisma.chatMessage.create. That is fine.

    // But the generator is consumed by the controller; after control returns, the generator is done. So we implement properly.

    // We'll implement StreamingService.generateResponse as an async generator function directly (using async function*). That's simpler: mark method as async function* and use yield. Then after loop, do the save.

    // Change signature to: async *generateResponse(...): AsyncIterable<StreamChunk>
    // But the plan says generateResponse returns Promise<AsyncIterable<StreamChunk>> which is weird; it's just AsyncIterable. We'll use async generator.

    // I'll implement as async *generateResponse, but the frontmatter just says method exists; details in action.

    // Implementation will be:

    async *generateResponse(
      chatId: number,
      userId: number,
      tenantId: number,
      query: string,
    ): AsyncIterable<StreamChunk> {
      // Save user message
      await this.prisma.chatMessage.create({
        data: { chat_id: chatId, user_id: userId, role: 'user', content: query },
      });

      // Retrieve chunks
      const chunks = await this.hybridSearch.search(query, tenantId, 10);

      // Build messages history (including just-saved user message)
      const history = await this.prisma.chatMessage.findMany({
        where: { chat_id: chatId },
        orderBy: { created_at: 'asc' },
      });
      const messages = history.map(m => ({ role: m.role as 'user'|'assistant', content: m.content }));

      const systemPrompt = this.buildSystemPrompt(chunks);
      const llmProvider = this.providerFactory.getLLMProvider();

      let fullText = '';

      try {
        for await (const chunk of llmProvider.streamChat(messages, chunks)) {
          if (chunk.type === 'text' && chunk.text) {
            fullText += chunk.text;
            yield chunk;
          } else if (chunk.type === 'error') {
            yield chunk;
            return;
          }
        }

        // Save assistant response
        await this.prisma.chatMessage.create({
          data: {
            chat_id: chatId,
            role: 'assistant',
            content: fullText,
            retrieved_chunk_ids: chunks.map(c => c.id),
          },
        });

        yield { type: 'done' };
      } catch (err: any) {
        this.logger.error(`Streaming error: ${err.message}`);
        yield { type: 'error', error: err.message };
      }
    }

    private buildSystemPrompt(chunks: RetrievedChunk[]): string {
      const context = chunks
        .map((c, idx) => `[${idx + 1}] ${c.content}`)
        .join('\n\n');
      return `You are a helpful assistant for industrial operations. Use the following context to answer the user's question. Cite sources using [n] format referencing the numbered context snippets.

Context:
${context}`;
    }
    ```

    Verify: Service compiles; method is async generator; uses injected services.
  </action>
  <verify>
    <automated>
      grep -q "async \*generateResponse" src/chat/generation/streaming.service.ts &&
      grep -q "buildSystemPrompt" src/chat/generation/streaming.service.ts &&
      grep -q "ProviderFactory" src/chat/generation/streaming.service.ts &&
      echo "StreamingService generator method defined"
    </automated>
  </verify>
  <done>StreamingService with async generator implemented</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Add streaming endpoint to ChatController</name>
  <files>
    src/chat/chat.controller.ts
  </files>
  <action>
    Add new route to ChatController:

    ```typescript
    import { Stream } from '@nestjs/common';
    import { StreamingService } from './generation/streaming.service';

    // In controller class:
    @Post(':id/messages')
    @UseGuards(JwtAuthGuard, TenantGuard)
    async streamMessage(
      @Param('id') chatId: string,
      @Body() body: { message: string },
      @Req() req: any,
    ): Stream<StreamChunk> {
      const userId = req.user.userId;
      const tenantId = req.user.tenantId;
      return this.streamingService.generateResponse(parseInt(chatId, 10), userId, tenantId, body.message);
    }
    ```

    Also inject StreamingService in controller constructor.

    Update module to import StreamingService.

    Verify: Controller has new route; returns stream.
  </action>
  <verify>
    <automated>
      grep -q "streamMessage" src/chat/chat.controller.ts &&
      grep -q "StreamingService" src/chat/chat.controller.ts &&
      grep -q "@Post.*:id/messages" src/chat/chat.controller.ts &&
      echo "Chat streaming endpoint added"
    </automated>
  </verify>
  <done>Chat streaming endpoint implemented</done>
</task>

</tasks>

<verification>
Wave 4d - LLM streaming integration complete

**Automated checks:**
1. StreamingService created with async* generateResponse method
2. Service injects HybridSearchService, ProviderFactory, PrismaService
3. Service saves user message, retrieves chunks, builds messages, calls LLM provider, streams chunks, saves assistant message with retrieved_chunk_ids
4. ChatController extended with POST /chats/:id/messages endpoint using StreamingService
5. System prompt includes retrieved context and citation instructions
6. ProviderFactory returns either Claude or Local provider based on LLM_PROVIDER
7. Types defined: StreamChunk, ChatMessage, RetrievedChunk

**Requirements coverage:**
- CHAT-03: LLM generation with grounding ✓
- CHAT-10: Streaming responses via SSE (NestJS Stream) ✓

**Dependencies:**
- 05c (HybridSearchService)
- 02e (ProviderFactory and LLM providers)
- 02c (Prisma)

**Next:** 05e (Citation validator) and 05f (guards/confidence).

</verification>

<success_criteria>
LLM streaming ready when:
- [ ] StreamingService generates responses as AsyncIterable<StreamChunk>
- [ ] System prompt includes retrieved context properly
- [ ] User and assistant messages persisted to DB
- [ ] Streamed text is sent to client via NestJS Stream
- [ ] Works with both Claude and Local providers
- [ ] TypeScript compiles

**Deliverable:** Streaming chat completion with grounding.

**Output:** `.planning/phases/01-backend-mvp/01-backend-mvp-05d-PLAN-05d-summary.md`

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-05d-PLAN-05d-summary.md`
