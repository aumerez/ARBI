---
phase: 01-backend-mvp
plan: 02d
type: execute
wave: 7
depends_on:
  - 02c
files_modified:
  - src/shared/infrastructure/redis.service.ts
  - src/shared/infrastructure/qdrant.service.ts
  - src/shared/infrastructure/qdrant.module.ts
autonomous: true
requirements:
  - DOC-04
  - DOC-08
  - CHAT-02
user_setup: []
must_haves:
  truths:
    - "RedisService provides connected IORedis instance with connection pooling"
    - "RedisService handles reconnection with exponential backoff"
    - "RedisService gracefully shuts down via onModuleDestroy"
    - "QdrantService creates tenant-scoped collections (tenant_{id}) with proper HNSW config"
    - "QdrantService.upsertVectors stores points with payload (tenant_id, document_id, chunk_index, content, indexed_at)"
    - "QdrantService.search performs vector similarity search with tenant_id filter"
    - "Qdrant collections use 3072 dimensions and Cosine distance for OpenAI embeddings"
  artifacts:
    - path: "src/shared/infrastructure/redis.service.ts"
      provides: "Redis connection provider for BullMQ"
      min_lines: 40
      contains:
        - "getConnection(): Redis"
        - "retryStrategy"
        - "connection event handlers"
    - path: "src/shared/infrastructure/qdrant.service.ts"
      provides: "Qdrant client with tenant-scoped operations"
      min_lines: 60
      exports:
        - "createCollection(tenantId: number): Promise<void>"
        - "upsertVectors(tenantId, documentId, chunks, embeddings): Promise<void>"
        - "search(tenantId, vector, k, filter?): Promise<SearchResult[]>"
        - "deleteCollection(tenantId): Promise<void>"
    - path: "src/shared/infrastructure/qdrant.module.ts"
      provides: "NestJS module for Qdrant service"
      min_lines: 10
  key_links:
    - from: "src/shared/infrastructure/redis.service.ts"
      to: "BullMQ workers"
      via: "redisService.getConnection() passed to Worker constructor"
      pattern: "new Worker.*redisService.getConnection"
    - from: "src/shared/infrastructure/qdrant.service.ts"
      to: "DocumentsModule (indexing)"
      via: "qdrantService.upsertVectors in worker"
      pattern: "upsertVectors"
    - from: "src/shared/infrastructure/qdrant.service.ts"
      to: "ChatModule (retrieval)"
      via: "qdrantService.search in HybridSearchService"
      pattern: "qdrant.search"
    - from: "QdrantService.createCollection"
      to: "tenant-scoped collections"
      via: "collection name = tenant_{tenantId}"
      pattern: "tenant_\${tenantId}"

---

<objective>
Create Redis and Qdrant infrastructure services

Purpose: Establish external service clients needed for async job processing (Redis for BullMQ) and vector storage/search (Qdrant for RAG retrieval). Redis must support BullMQ requirements. Qdrant must create collections with proper HNSW configuration for 3072-dim OpenAI embeddings.

Output: Working RedisService and QdrantService with connection management, error handling, and tenant-scoped operations

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

# Redis requirements (BullMQ):
- Client: IORedis from 'ioredis' (BullMQ recommends ioredis over node-redis)
- Config: REDIS_URL from env (default: redis://localhost:6379)
- Connection pooling: BullMQ manages connections; service just provides getConnection()
- Retry: exponential backoff strategy for transient failures
- Graceful shutdown: onModuleDestroy calls redis.quit()
- Event handlers: on('error'), on('connect'), on('close') for logging

# Qdrant requirements:
- Client: @qdrant/js-client-rest QdrantClient (REST over HTTP)
- Config: QDRANT_URL and QDRANT_API_KEY from env
- Collection name pattern: `tenant_{tenantId}` (isolated per tenant)
- Collection parameters:
  * vectors.size = 3072 (OpenAI text-embedding-3-large)
  * distance = Cosine
  * hnsw_config: m=32, ef_construct=200 (per RESEARCH for high dimensions)
  * payload: must index tenant_id, document_id, chunk_index, indexed_at
- Methods:
  * createCollection(tenantId): creates collection if not exists
  * upsertVectors(tenantId, documentId, chunks, embeddings): map chunks→points with payload, call client.upsert
  * search(tenantId, vector, k, filter?): client.search with filter on tenant_id
  * deleteCollection(tenantId): for cleanup/testing

# Error handling:
- Qdrant: catch QdrantHTTPError, log with context, rethrow or return empty results
- Redis: connection errors logged; service retries

# Configuration:
- ENV vars documented in .env.example (created in Plan 01d)
- ConfigModule provides get() methods

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create RedisService</name>
  <files>
    src/shared/infrastructure/redis.service.ts
  </files>
  <behavior>
    - Test 1: RedisService injects ConfigService to read REDIS_URL
    - Test 2: getConnection() returns IORedis instance
    - Test 3: Connection configured with retryStrategy (exponential backoff)
    - Test 4: Service connects on construction and logs status
    - Test 5: onModuleDestroy calls redis.quit() for graceful shutdown
    - Test 6: Event handlers: on('error') logs error, on('connect') logs connected
  </behavior>
  <action>
    Implement RedisService:

    ```typescript
    import { Injectable, OnModuleDestroy, Logger, OnModuleInit } from '@nestjs/common';
    import { Redis } from 'ioredis';
    import { ConfigService } from '@nestjs/config';

    @Injectable()
    export class RedisService implements OnModuleInit, OnModuleDestroy {
      private readonly logger = new Logger(RedisService.name);
      private readonly client: Redis;

      constructor(private readonly config: ConfigService) {
        const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');

        this.client = new Redis(url, {
          retryStrategy: (times) => {
            this.logger.warn(`Redis connection attempt ${times}, retrying...`);
            return Math.min(times * 200, 2000); // Exponential backoff: 200ms, 400ms, 600ms... max 2000ms
          },
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });

        this.client.on('error', (err) => {
          this.logger.error('Redis client error', err);
        });

        this.client.on('connect', () => {
          this.logger.log('Redis client connected');
        });

        this.client.on('close', () => {
          this.logger.warn('Redis client closed');
        });
      }

      async onModuleInit() {
        await this.client.connect();
        // Health check
        const pong = await this.client.ping();
        if (pong !== 'PONG') {
          throw new Error('Redis health check failed');
        }
        this.logger.log('Redis service ready');
      }

      getConnection(): Redis {
        return this.client;
      }

      async onModuleDestroy() {
        await this.client.quit();
        this.logger.log('Redis connection closed');
      }
    }
    ```

    Verify: Service connects to Redis (ensure Redis running locally or will retry).
  </action>
  <verify>
    <automated>
      grep -q "getConnection" src/shared/infrastructure/redis.service.ts &&
      grep -q "ioredis" src/shared/infrastructure/redis.service.ts &&
      grep -q "OnModuleDestroy" src/shared/infrastructure/redis.service.ts &&
      echo "RedisService structure defined"
    </automated>
  </verify>
  <done>RedisService with connection management and reconnection logic ready</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create QdrantModule</name>
  <files>
    src/shared/infrastructure/qdrant.module.ts
  </files>
  <behavior>
    - Test 1: QdrantModule provides QdrantService as singleton
    - Test 2: Module is global or can be imported by feature modules
    - Test 3: No external dependencies beyond ConfigModule
  </behavior>
  <action>
    Create QdrantModule:

    ```typescript
    import { Global, Module } from '@nestjs/common';
    import { ConfigModule } from '@nestjs/config';
    import { QdrantService } from './qdrant.service';

    @Global()
    @Module({
      imports: [ConfigModule],
      providers: [QdrantService],
      exports: [QdrantService],
    })
    export class QdrantModule {}
    ```

    Rationale: QdrantService needs ConfigService to get QDRANT_URL, so import ConfigModule.

    Verify: Module structure correct; can be imported without additional providers.
  </action>
  <verify>
    <automated>grep -q "QdrantModule" src/shared/infrastructure/qdrant.module.ts && grep -q "exports: \\[QdrantService\\]" src/shared/infrastructure/qdrant.module.ts && echo "QdrantModule defined"</automated>
  </verify>
  <done>QdrantModule created for dependency injection</done>
</task>

<task type="auto" tdd="true">
  <name="Task 3: Implement QdrantService with tenant-scoped operations"]
  <files>
    src/shared/infrastructure/qdrant.service.ts
  </files>
  <behavior>
    - Test 1: QdrantService injects ConfigService and creates QdrantClient with URL and API key
    - Test 2: createCollection(tenantId) creates collection named `tenant_{tenantId}` with vector config: size=3072, distance=Cosine, hnsw_config.m=32, ef_construct=200
    - Test 3: createCollection creates payload indexes for tenant_id, document_id, chunk_index, indexed_at
    - Test 4: upsertVectors(tenantId, documentId, chunks, embeddings) maps to PointStruct[] with id `${documentId}:${index}` and payload including tenant_id, document_id, chunk_index, content, indexed_at
    - Test 5: upsertVectors calls client.upsert with wait=true
    - Test 6: search(tenantId, vector, k, filter) calls client.search with filter on tenant_id and passed filter, returns SearchResult[] with id, score, payload
    - Test 7: deleteCollection(tenantId) removes collection (for cleanup)
    - Test 8: Error handling: QdrantHTTPError caught, logged, rethrown
  </behavior>
  <action>
    Implement QdrantService:

    ```typescript
    import { Injectable, Logger, NotFoundException } from '@nestjs/common';
    import { QdrantClient, PointStruct, SearchResult, SearchParams } from '@qdrant/js-client-rest';
    import { ConfigService } from '@nestjs/config';

    @Injectable()
    export class QdrantService {
      private readonly logger = new Logger(QdrantService.name);
      private readonly client: QdrantClient;
      private readonly collectionPrefix = 'tenant_';

      constructor(private readonly config: ConfigService) {
        const url = this.config.get<string>('QDRANT_URL', 'http://localhost:6333');
        const apiKey = this.config.get<string>('QDRANT_API_KEY', undefined);

        this.client = new QdrantClient({
          url,
          apiKey: apiKey || undefined,
        });

        this.logger.log(`Qdrant client initialized: ${url}`);
      }

      async createCollection(tenantId: number): Promise<void> {
        const collectionName = this.collectionName(tenantId);

        try {
          await this.client.createCollection(collectionName, {
            vectors: {
              size: 3072,
              distance: 'Cosine',
              hnsw_config: {
                m: 32,
                ef_construct: 200,
              },
            },
            payload: [
              { name: 'tenant_id', data_type: 'integer' },
              { name: 'document_id', data_type: 'integer' },
              { name: 'chunk_index', data_type: 'integer' },
              { name: 'indexed_at', data_type: 'datetime' },
            ],
          });
          this.logger.log(`Collection created: ${collectionName}`);
        } catch (error: any) {
          if (error.statusCode === 409) {
            this.logger.warn(`Collection already exists: ${collectionName}`);
          } else {
            this.logger.error(`Failed to create collection ${collectionName}`, error);
            throw error;
          }
        }
      }

      async upsertVectors(
        tenantId: number,
        documentId: number,
        chunks: string[],
        embeddings: number[][]
      ): Promise<void> {
        const collectionName = this.collectionName(tenantId);

        if (chunks.length !== embeddings.length) {
          throw new Error(`Chunks (${chunks.length}) and embeddings (${embeddings.length}) count mismatch`);
        }

        const points: PointStruct[] = chunks.map((chunk, index) => ({
          id: `${documentId}:${index}`,
          vector: embeddings[index],
          payload: {
            tenant_id: tenantId,
            document_id: documentId,
            chunk_index: index,
            content: chunk,
            indexed_at: new Date().toISOString(),
          },
        }));

        try {
          await this.client.upsert(collectionName, {
            points,
            wait: true, // Ensure points are indexed before returning
          });
          this.logger.debug(`Upserted ${points.length} vectors to ${collectionName}`);
        } catch (error) {
          this.logger.error(`Failed to upsert vectors to ${collectionName}`, error);
          throw error;
        }
      }

      async search(
        tenantId: number,
        vector: number[],
        k: number = 10,
        filter?: Record<string, any>
      ): Promise<SearchResult[]> {
        const collectionName = this.collectionName(tenantId);

        const searchFilter: any = {
          must: [
            { key: 'tenant_id', match: { value: tenantId } },
            ...(filter ? Object.entries(filter).map(([k, v]) => ({ key: k, match: { value: v } })) : []),
          ],
        };

        try {
          const results = await this.client.search(collectionName, {
            vector,
            limit: k,
            with_payload: true,
            filter: searchFilter,
            params: {
              hnsw_ef: 256, // Recall vs speed tradeoff
            },
          });

          return results.map(r => ({
            id: r.id,
            score: r.score,
            payload: r.payload,
          }));
        } catch (error) {
          this.logger.error(`Search failed in ${collectionName}`, error);
          throw error;
        }
      }

      async deleteCollection(tenantId: number): Promise<void> {
        const collectionName = this.collectionName(tenantId);
        try {
          await this.client.deleteCollection(collectionName);
          this.logger.log(`Collection deleted: ${collectionName}`);
        } catch (error) {
          this.logger.error(`Failed to delete collection ${collectionName}`, error);
          throw error;
        }
      }

      private collectionName(tenantId: number): string {
        return `${this.collectionPrefix}${tenantId}`;
      }
    }
    ```

    Verify: Service compiles; methods match expected signatures; uses correct Qdrant client API.
  </action>
  <verify>
    <automated>
      grep -q "createCollection" src/shared/infrastructure/qdrant.service.ts &&
      grep -q "upsertVectors" src/shared/infrastructure/qdrant.service.ts &&
      grep -q "search(tenantId" src/shared/infrastructure/qdrant.service.ts &&
      grep -q "tenant_\${tenantId}" src/shared/infrastructure/qdrant.service.ts &&
      echo "QdrantService methods defined"
    </automated>
  </verify>
  <done>QdrantService with tenant-scoped collection management implemented</done>
</task>

</tasks>

<verification>
Wave 1d - Redis & Qdrant services complete

**Automated checks:**
1. RedisService exists with getConnection(), retry strategy, OnModuleInit/OnModuleDestroy, event handlers
2. QdrantModule provides QdrantService globally
3. QdrantService methods: createCollection, upsertVectors, search, deleteCollection all defined
4. QdrantService uses correct config: QDRANT_URL, QDRANT_API_KEY
5. Collection config: size=3072, distance=Cosine, hnsw_config.m=32, ef_construct=200
6. upsertVectors builds PointStruct[] with payload (tenant_id, document_id, chunk_index, content, indexed_at)
7. search filters by tenant_id and returns SearchResult[] with id, score, payload
8. TypeScript compiles: `npx tsc --noEmit src/shared/infrastructure/*.ts`

**Integration dependencies:**
- RedisService → used by BullMQ workers (Plan 04) via `new Worker(..., { connection: redisService.getConnection() })`
- QdrantService → used by DocumentsModule (Plan 04 for indexing) and ChatModule (Plan 05 for retrieval)

**Configuration required (env):**
- REDIS_URL (default: redis://localhost:6379)
- QDRANT_URL (default: http://localhost:6333)
- QDRANT_API_KEY (optional)

**Manual verification (optional):**
- Start Redis: `redis-server`
- Start Qdrant: `docker run -p 6333:6333 qdrant/qdrant`
- Test connection: Node script calling qdrantService.createCollection(1) should succeed

</verification>

<success_criteria>
Infrastructure services ready when:
- [ ] src/shared/infrastructure/redis.service.ts complete with connection, retry, shutdown
- [ ] src/shared/infrastructure/qdrant.module.ts provides QdrantService globally
- [ ] src/shared/infrastructure/qdrant.service.ts implements all required methods
- [ ] Qdrant collections use 3072 dimensions and Cosine distance
- [ ] HNSW config: m=32, ef_construct=200
- [ ] Payload indexes on tenant_id, document_id, chunk_index, indexed_at
- [ ] `npx tsc --noEmit` passes for both services
- [ ] Services can be injected: `constructor(private redis: RedisService, private qdrant: QdrantService) {}`

**Next:** Create OpenAI and Anthropic provider services (Plan 02e) and wire AppModule (Plan 02f).

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-02d-PLAN-02d-summary.md`
</output>
