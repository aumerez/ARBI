---
phase: 01-backend-mvp
plan: 02e
type: execute
wave: 8
depends_on:
  - 02d
files_modified:
  - src/shared/infrastructure/providers/openai-embedding.provider.ts
  - src/shared/infrastructure/providers/local-embedding.provider.ts
  - src/shared/infrastructure/providers/claude-llm.provider.ts
  - src/shared/infrastructure/providers/local-llm.provider.ts
  - src/shared/infrastructure/providers/provider.factory.ts
  - src/shared/infrastructure/providers/provider.module.ts
autonomous: true
requirements:
  - DOC-08
  - CHAT-03
user_setup:
  - service: ollama (if using local providers)
    why: "Local embedding and LLM inference require Ollama server running"
    env_vars:
      - name: OLLAMA_HOST
        source: "Ollama server URL (default: http://localhost:11434)"
    dashboard_config: []
  - service: ollama models (if using local providers)
    why: "Need to pull required models: nomic-embed-text and llama2 (or codellama)"
    commands:
      - "ollama pull nomic-embed-text"
      - "ollama pull llama2"
requirements_coverage:
  - DOC-08: Embedding provider (OpenAI or Local)
  - CHAT-03: LLM provider (Claude or Local)
must_haves:
  truths:
    - "OpenAIEmbeddingProvider implements EmbeddingProvider interface"
    - "LocalEmbeddingProvider implements EmbeddingProvider using Ollama API (nomic-embed-text model)"
    - "ClaudeLLMProvider implements LLMProvider using Anthropic API"
    - "LocalLLMProvider implements LLMProvider using Ollama chat API (llama2 model)"
    - "ProviderFactory selects implementation based on env vars (EMBEDDING_PROVIDER, LLM_PROVIDER)"
    - "Default to OpenAI and Claude for MVP (configurable to local for cost control)"
    - "All providers handle errors (network, API errors) with meaningful logs"
  artifacts:
    - path: "src/shared/infrastructure/providers/openai-embedding.provider.ts"
      provides: "OpenAI embedding provider using text-embedding-3-large"
      min_lines: 40
    - path: "src/shared/infrastructure/providers/local-embedding.provider.ts"
      provides: "Local embedding provider using Ollama API"
      min_lines: 40
    - path: "src/shared/infrastructure/providers/claude-llm.provider.ts"
      provides: "Claude LLM provider using Anthropic Messages API with streaming"
      min_lines: 50
    - path: "src/shared/infrastructure/providers/local-llm.provider.ts"
      provides: "Local LLM provider using Ollama chat API with streaming"
      min_lines: 50
    - path: "src/shared/infrastructure/providers/provider.factory.ts"
      provides: "Factory that instantiates correct provider based on configuration"
      min_lines: 30
    - path: "src/shared/infrastructure/providers/provider.module.ts"
      provides: "Module providing provider implementations and factory"
      min_lines: 20
  key_links:
    - from: "ProviderFactory"
      to: "OpenAIEmbeddingProvider, LocalEmbeddingProvider, ClaudeLLMProvider, LocalLLMProvider"
      via: "conditionally instantiates based on env"
      pattern: "if.*embeddingProvider === 'openai'.*new OpenAIEmbeddingProvider"
    - from: "OpenAIEmbeddingProvider"
      to: "OpenAI API"
      via: "embeddings.create with text-embedding-3-large"
      pattern: "embeddings.create"
    - from: "LocalEmbeddingProvider"
      to: "Ollama API"
      via: "POST /api/embed with JSON {model, input}"
      pattern: "ollama.*embed"
    - from: "ClaudeLLMProvider"
      to: "Anthropic API"
      via: "anthropic.messages.stream"
      pattern: "messages.stream"
    - from: "LocalLLMProvider"
      to: "Ollama API"
      via: "POST /api/generate with stream=true"
      pattern: "ollama.*generate"
    - from: "provider.module.ts"
      to: "DocumentsModule, ChatModule"
      via: "ProviderModule exports providers for injection"
      pattern: "ProviderModule"

---

<objective>
Implement provider abstraction for embeddings and LLM with cloud/local variants

Purpose: Create flexible architecture supporting both cloud APIs (OpenAI, Anthropic) and local inference (Ollama). ProviderFactory selects implementation based on environment variables (EMBEDDING_PROVIDER, LLM_PROVIDER). This allows running entire stack locally for development and switching to cloud for production.

Output: Four provider implementations + factory + module, all implementing abstract interfaces

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
@.planning/phases/01-backend-mvp/01-backend-mvp-02a-PLAN-02a-schema-tenants.md

# Provider interfaces from 02a:
- EmbeddingProvider: generateEmbeddings(texts: string[]): Promise<number[][]>
- LLMProvider: streamChat(messages, context): AsyncIterable<StreamChunk>

# Cloud providers (default MVP):
- OpenAIEmbeddingProvider: Use OpenAI text-embedding-3-large (3072 dim), batch size 100, rate limit handling
- ClaudeLLMProvider: Use Anthropic Claude (claude-sonnet-4-6), streaming, temperature 0.3, system prompt with citations

# Local providers (alternative for development/cost savings):
- LocalEmbeddingProvider: Ollama /api/embed endpoint with nomic-embed-text model
  * Request: POST http://OLLAMA_HOST:11434/api/embed
  * Body: { model: "nomic-embed-text", input: string[] }
  * Returns: { embeddings: number[][] }
- LocalLLMProvider: Ollama /api/generate with stream=true and llama2 or codellama
  * Request: POST http://OLLAMA_HOST:11434/api/generate
  * Body: { model: "llama2", prompt: "...", stream: true }
  * Stream returns JSON lines: { response: "...", done: false/true }

# Configuration env vars (add to .env.example):
- EMBEDDING_PROVIDER=openai|local (default: openai)
- LLM_PROVIDER=anthropic|local (default: anthropic)
- OLLAMA_HOST=http://localhost:11434 (for local providers)

# Provider selection pattern:
```typescript
@Injectable()
export class ProviderFactory {
  private embeddingProvider: EmbeddingProvider;
  private llmProvider: LLMProvider;

  constructor(config: ConfigService) {
    const embProvider = config.get('EMBEDDING_PROVIDER', 'openai');
    const llmProvider = config.get('LLM_PROVIDER', 'anthropic');

    // Instantiate appropriate implementations
    // Could also use pattern: switch + case
  }

  getEmbeddingProvider(): EmbeddingProvider {
    return this.embeddingProvider;
  }

  getLLMProvider(): LLMProvider {
    return this.llmProvider;
  }
}
```

# ProviderModule:
- Provides: OpenAIEmbeddingProvider, LocalEmbeddingProvider, ClaudeLLMProvider, LocalLLMProvider
- Provides: ProviderFactory
- Exports: EmbeddingProvider, LLMProvider (interface tokens), ProviderFactory

# Implementation notes:
- OpenAI: Use official openai package v4+, handle rate limits (429) with retry
- Anthropic: Use @anthropic-ai/sdk, streaming via messages.stream()
- Ollama: REST API over HTTP, streams response as NDJSON (newline-delimited JSON)
- All providers should log errors and throw consistent error types
- Batch size for embeddings: 100 max (OpenAI limit 2048 but 100 safer); local can handle larger batches

</context>

<tasks>
<task type="auto" tdd="true">
  <name="Task 1: Implement OpenAIEmbeddingProvider</name>
  <files>
    src/shared/infrastructure/providers/openai-embedding.provider.ts
  </files>
  <behavior>
    - Test 1: OpenAIEmbeddingProvider implements EmbeddingProvider interface
    - Test 2: Constructor injects ConfigService, creates OpenAI client with API key
    - Test 3: generateEmbeddings(texts) truncates each text to 8192 tokens using tiktoken
    - Test 4: generateEmbeddings batches into BATCH_SIZE=100 chunks
    - Test 5: Calls this.client.embeddings.create({ model: 'text-embedding-3-large', input: batch })
    - Test 6: Adds delay between batches (100ms) to respect rate limits
    - Test 7: Returns number[][] with 3072 dimensions per vector
    - Test 8: Handles OpenAI errors (429, 500) with logging and rethrow
  </behavior>
  <action>
    Create OpenAIEmbeddingProvider:

    ```typescript
    import { Injectable, Logger } from '@nestjs/common';
    import OpenAI from 'openai';
    import { encoding_for_model } from 'js-tiktoken';
    import { EmbeddingProvider } from '../types/providers.interface';
    import { ConfigService } from '@nestjs/config';

    @Injectable()
    export class OpenAIEmbeddingProvider implements EmbeddingProvider {
      private readonly logger = new Logger(OpenAIEmbeddingProvider.name);
      private readonly client: OpenAI;
      private readonly encoding = encoding_for_model('text-embedding-3-large');
      private readonly BATCH_SIZE = 100;
      private readonly MAX_TOKENS = 8192;

      constructor(private readonly config: ConfigService) {
        const apiKey = this.config.get<string>('OPENAI_API_KEY');
        if (!apiKey) {
          throw new Error('OPENAI_API_KEY is required');
        }
        this.client = new OpenAI({ apiKey });
      }

      async generateEmbeddings(texts: string[]): Promise<number[][]> {
        if (texts.length === 0) {
          return [];
        }

        // Truncate each text to MAX_TOKENS
        const truncated = texts.map(text => this.truncateToTokenLimit(text, this.MAX_TOKENS));

        const embeddings: number[][] = [];

        // Batch processing
        for (let i = 0; i < truncated.length; i += this.BATCH_SIZE) {
          const batch = truncated.slice(i, i + this.BATCH_SIZE);

          try {
            const response = await this.client.embeddings.create({
              model: 'text-embedding-3-large',
              input: batch,
            });

            embeddings.push(...response.data.map(d => d.embedding));

            // Rate limit delay between batches
            if (i + this.BATCH_SIZE < truncated.length) {
              await this.delay(100);
            }
          } catch (error: any) {
            this.logger.error(`OpenAI embedding batch failed (${i}-${i+batch.length})`, error.message);
            throw error;
          }
        }

        this.logger.log(`Generated ${embeddings.length} embeddings (${embeddings[0]?.length || 0} dims)`);
        return embeddings;
      }

      private truncateToTokenLimit(text: string, maxTokens: number): string {
        const tokens = this.encoding.encode(text);
        if (tokens.length <= maxTokens) {
          return text;
        }
        const truncatedTokens = tokens.slice(0, maxTokens);
        return this.encoding.decode(truncatedTokens);
      }

      private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
      }
    }
    ```

    Verify: Provider compiles; implements EmbeddingProvider; uses correct model name.
  </action>
  <verify>
    <automated>
      grep -q "implements EmbeddingProvider" src/shared/infrastructure/providers/openai-embedding.provider.ts &&
      grep -q "text-embedding-3-large" src/shared/infrastructure/providers/openai-embedding.provider.ts &&
      grep -q "BATCH_SIZE = 100" src/shared/infrastructure/providers/openai-embedding.provider.ts &&
      echo "OpenAIEmbeddingProvider defined"
    </automated>
  </verify>
  <done>OpenAIEmbeddingProvider with batching and rate limiting implemented</done>
</task>
<task type="auto" tdd="true">
  <name="Task 2: Implement LocalEmbeddingProvider (Ollama)</name>
  <files>
    src/shared/infrastructure/providers/local-embedding.provider.ts
  </files>
  <behavior>
    - Test 1: LocalEmbeddingProvider implements EmbeddingProvider interface
    - Test 2: Constructor reads OLLAMA_HOST from env (default http://localhost:11434)
    - Test 3: generateEmbeddings sends POST to /api/embed with { model: "nomic-embed-text", input: texts[] }
    - Test 4: Returns embeddings array from response { embeddings: number[][] }
    - Test 5: Handles HTTP errors (connection refused, 500) with meaningful error messages
    - Test 6: Logs requests and errors
  </behavior>
  <action>
    Create LocalEmbeddingProvider:

    ```typescript
    import { Injectable, Logger } from '@nestjs/common';
    import { HttpService } from '@nestjs/axios';
    { firstValueFrom } from 'rxjs';
    import { EmbeddingProvider } from '../types/providers.interface';
    import { ConfigService } from '@nestjs/config';

    @Injectable()
    export class LocalEmbeddingProvider implements EmbeddingProvider {
      private readonly logger = new Logger(LocalEmbeddingProvider.name);
      private readonly ollamaHost: string;
      private readonly model = 'nomic-embed-text';

      constructor(
        private readonly config: ConfigService,
        private readonly httpService: HttpService
      ) {
        this.ollamaHost = this.config.get<string>('OLLAMA_HOST', 'http://localhost:11434');
      }

      async generateEmbeddings(texts: string[]): Promise<number[][]> {
        if (texts.length === 0) {
          return [];
        }

        const url = `${this.ollamaHost}/api/embed`;
        const payload = {
          model: this.model,
          input: texts,
        };

        try {
          const response = await firstValueFrom(
            this.httpService.post<{ embeddings: number[][] }>(url, payload, {
              timeout: 30000, // 30s timeout
            })
          );

          const embeddings = response.data.embeddings;
          if (!embeddings || embeddings.length !== texts.length) {
            throw new Error(`Embedding count mismatch: expected ${texts.length}, got ${embeddings?.length || 0}`);
          }

          this.logger.log(`Generated ${embeddings.length} embeddings via Ollama (${embeddings[0]?.length || 0} dims)`);
          return embeddings;
        } catch (error: any) {
          this.logger.error(`Ollama embedding request failed: ${error.message}`);
          throw new Error(`Local embedding provider error: ${error.message}`);
        }
      }
    }
    ```

    Note: Requires HttpModule imported in ProviderModule to inject HttpService.

    Verify: Provider uses correct Ollama endpoint and model; handles errors.
  </action>
  <verify>
    <automated>
      grep -q "implements EmbeddingProvider" src/shared/infrastructure/providers/local-embedding.provider.ts &&
      grep -q "nomic-embed-text" src/shared/infrastructure/providers/local-embedding.provider.ts &&
      grep -q "/api/embed" src/shared/infrastructure/providers/local-embedding.provider.ts &&
      echo "LocalEmbeddingProvider defined"
    </automated>
  </verify>
  <done>LocalEmbeddingProvider using Ollama API implemented</done>
</task>
</tasks>

<verification>
Wave 1e - Provider abstraction complete

**Automated checks:**
1. All 6 provider files exist in src/shared/infrastructure/providers/
2. Each provider implements correct interface (EmbeddingProvider or LLMProvider)
3. OpenAIEmbeddingProvider uses 'text-embedding-3-large' and batch size 100
4. LocalEmbeddingProvider calls /api/embed with nomic-embed-text model
5. ClaudeLLMProvider uses Anthropic SDK with streaming and system prompt
6. LocalLLMProvider calls /api/generate with stream=true and parses NDJSON
7. ProviderFactory has getEmbeddingProvider() and getLLMProvider() based on config
8. ProviderModule imports ConfigModule + HttpModule, provides all 4 providers + factory, exports ProviderFactory
9. TypeScript compiles: `npx tsc --noEmit src/shared/infrastructure/providers/*.ts`

**Configuration:**
- EMBEDDING_PROVIDER: 'openai' (default) or 'local'
- LLM_PROVIDER: 'anthropic' (default) or 'local'
- OLLAMA_HOST: http://localhost:11434 (for local providers)
- Required models if local: nomic-embed-text and llama2 (user must pull: `ollama pull nomic-embed-text && ollama pull llama2`)

**Integration:**
- DocumentsModule (Plan 04) will inject ProviderFactory → getEmbeddingProvider() for embedding generation
- ChatModule (Plan 05) will inject ProviderFactory → getLLMProvider() for Claude or local LLM

**User setup required if using local:**
- Install Ollama on host machine
- Start Ollama server: `ollama serve` (background process)
- Pull models: `ollama pull nomic-embed-text`, `ollama pull llama2`
- Set OLLAMA_HOST if not default localhost:11434

</verification>

<success_criteria>
Provider abstraction ready when:
- [ ] OpenAIEmbeddingProvider implements EmbeddingProvider with batching, tiktoken truncation, rate limiting
- [ ] LocalEmbeddingProvider implements EmbeddingProvider using Ollama /api/embed
- [ ] ClaudeLLMProvider implements LLMProvider with Anthropic streaming and citation instructions
- [ ] LocalLLMProvider implements LLMProvider using Ollama /api/generate with NDJSON parsing
- [ ] ProviderFactory selects correct provider based on EMBEDDING_PROVIDER and LLM_PROVIDER env vars
- [ ] ProviderModule provides all providers and exports ProviderFactory (global)
- [ ] All providers handle errors and log appropriately
- [ ] `npx tsc --noEmit` passes for all provider files
- [ ] Default providers: OpenAI (embeddings) and Claude (LLM) for MVP

**Next:** Wire ProviderModule into AppModule (Plan 02f) and then use in DocumentsModule/ChatModule.

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-02e-PLAN-02e-summary.md`
</output>
