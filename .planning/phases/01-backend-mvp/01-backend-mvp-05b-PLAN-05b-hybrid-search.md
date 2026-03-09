---
phase: 01-backend-mvp
plan: 05b
type: execute
wave: 14
depends_on:
  - 05a
files_modified:
  - src/chat/retrieval/hybrid-search.service.ts
  - src/chat/retrieval/qdrant.service.ts
autonomous: true
requirements:
  - CHAT-02
user_setup: []
must_haves:
  truths:
    - "HybridSearchService implements hybrid search combining semantic (dense vector) and BM25 (lexical) with RRF fusion (weights 0.7 semantic, 0.3 lexical)"
    - "QdrantService provides methods: searchByVector(collection, vector, limit, filters) and searchByText(collection, text, limit) for BM25 using text payload indexing"
    - "HybridSearchService.search(query: string, tenantId: number, topK: number) retrieves top-k chunks from Qdrant with tenant filtering"
    - "Service uses ProviderFactory to get embedding provider and generate query embedding"
    - "Results are fused using Reciprocal Rank Fusion: score = 1/(rank + k) summed across modalities, then re-ranked"
    - "Returned chunks include metadata: document_id, content, score, pageNumber, documentName"
    - "All queries include tenant_id filter (payload filter) to enforce data isolation"
  artifacts:
    - path: "src/chat/retrieval/hybrid-search.service.ts"
      provides: "Hybrid search orchestration with RRF fusion"
      min_lines: 60
    - path: "src/chat/retrieval/qdrant.service.ts"
      provides: "Qdrant client wrapper with vector and text search"
      min_lines: 40
  key_links:
    - from: "HybridSearchService"
      to: "QdrantService"
      via: "qdrant.searchByVector, qdrant.searchByText"
      pattern: "qdrant.*search"
    - from: "HybridSearchService"
      to: "ProviderFactory.getEmbeddingProvider()"
      via: "generateEmbedding for query"
      pattern: "embeddingProvider.*generateEmbeddings"
    - from: "HybridSearchService"
      to: "Qdrant collection 'document_chunks'"
      via: "payload filter: { tenant_id: tenantId }"
      pattern: "tenant_id.*filters"
    - from: "QdrantService"
      to: "@qdrant/js-client-rest"
      via: "client.search / client.scroll"
      pattern: "client.search"

---

<objective>
Implement hybrid search service combining semantic and lexical retrieval

Purpose: Retrieve relevant document chunks using both dense vector similarity and BM25 lexical matching, fuse with Reciprocal Rank Fusion (RRF), respecting tenant isolation. This is core retrieval component for RAG (CHAT-02).

Output: HybridSearchService and QdrantService that queries Qdrant with filters

</objective>

<execution_context>
@/Users/franciscoegloff/projects/metacortex/ops-ai-platform/.planning/workflows/execute-plan.md
@/Users/franciscoeglosting/templates/summary.md
</context>

<context>
@.planning/ROADMAP.md
@.planning/phases/01-backend-mvp/01-CONTEXT.md
@.planning/phases/01-backend-mvp/01-RESEARCH.md

# Hybrid search requirements (from RESEARCH):
- Semantic weight: 0.7, BM25 weight: 0.3, fusion via RRF
- Qdrant supports hybrid search natively? Actually Qdrant has hybrid search extension combining dense and sparse vectors. But simpler: perform two separate searches and fuse manually (RRF). We'll do that.
- Semantic: encode query → vector search (similarity metric: cosine? Qdrant defaults to cosine). topK = maybe 20.
- BM25: use Qdrant's full-text search (requires text index on payload 'content' field). Use text search API with query string.
- RRF: For each result chunk, compute combined score = w_dense * (1/(rank_dense + k)) + w_sparse * (1/(rank_sparse + k)), where k = constant (usually 60). Then sort descending.
- We'll retrieve top 20 from each, fuse, take top 10 or configurable.

# Qdrant collection:
- name: document_chunks
- vector field: embedding (dim=3072, from OpenAI)
- payload: chunk_id, document_id, tenant_id, content, plus maybe document metadata
- Need to filter by tenant_id to enforce isolation.

# QdrantService responsibilities:
- Initialize Qdrant client (from config: QDRANT_URL)
- Method: searchByVector(collection: string, vector: number[], limit: number, filters?: any): Promise<Point[]>
- Method: searchByText(collection: string, query: string, limit: number, filters?: any): Promise<Point[]>
- Optional: createCollection, upsertPoint, deletePoints (used elsewhere)

# HybridSearchService:
- Constructor injects: ProviderFactory (or EmbeddingProvider directly) and QdrantService
- Method: async search(query: string, tenantId: number, topK: number = 10): Promise<RetrievedChunk[]>
  1. Get embedding for query via embeddingProvider.generateEmbeddings([query])
  2. Perform vector search: qdrant.searchByVector('document_chunks', embedding, topK*2, { tenant_id: tenantId })
  3. Perform text search: qdrant.searchByText('document_chunks', query, topK*2, { tenant_id: tenantId })
  4. Fuse results via RRF to produce final topK list.
  5. Map payload to RetrievedChunk interface.

# RetrievedChunk shape (from providers.interface.ts):
  { id: string, content: string, documentName: string, pageNumber?: number, score: number }

We'll need to join with document metadata (title/filename) from DB or store in Qdrant payload? Simpler: store document name in chunk payload at indexing time (from DocumentsService). Then we can retrieve directly.

Thus during embedding-generation (04a), when upserting to Qdrant, we should include payload: chunk_id, document_id, tenant_id, content, documentName (filename). We'll adapt that later. For hybrid search, assume payload contains documentName.

# Hybrid search ratio: 0.7 dense, 0.3 sparse. k=60 (standard RRF).

# Implementation steps:
- Create QdrantService (if not already in 02d). Actually 02d likely created a QdrantService but for generic use. It might already have search methods. We'll check but assume we need to create or extend. Since it's a new file, we'll create src/chat/retrieval/qdrant.service.ts that wraps Qdrant client and provides needed methods. But it might duplicate 02d. However 02d might have created src/shared/infrastructure/qdrant.service.ts. We can use that if available. Since we are in 05b, we can import from shared. But the must_haves says these two files exist, so we'll create them. Might be okay to have search-specific service in chat/retrieval that uses shared Qdrant client. But we can also just rely on shared/qdrant.service.ts and create HybridSearchService that uses it. But must_haves expects qdrant.service.ts in retrieval. We'll follow must_haves: create src/chat/retrieval/qdrant.service.ts and hybrid-search.service.ts.

If there is already a shared QdrantService, we can extend or compose. We'll create a new one for convenience; no conflict.

But careful: file ownership conflict? 02d already created shared/qdrant.service.ts. So having another qdrant.service.ts in a different folder is fine. We'll create chat/retrieval/qdrant.service.ts that provides higher-level methods for search.

We'll define it to use the Qdrant client from shared maybe, or instantiate its own. Better: reuse the client. We can inject the client from shared module.

But file not existing yet; we'll define it as a standalone service that creates Qdrant client from env or accepts connection. For simplicity, we'll create it to instantiate client internally using config.

Given we're in the planning phase, it's fine.

Let's implement QdrantService:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class QdrantService {
  private readonly logger = new Logger(QdrantService.name);
  private client: QdrantClient;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('QDRANT_URL') || 'http://localhost:6333';
    this.client = new QdrantClient({ url });
  }

  async searchByVector(collection: string, vector: number[], limit: number, filters?: any) {
    // filters: must be in Qdrant format: { must: [{ key: "tenant_id", match: { value: 123 } }] }
    const result = await this.client.search(collection, {
      vector,
      limit,
      filter: filters ? { must: filters } : undefined,
      with_payload: true,
    });
    return result.result || [];
  }

  async searchByText(collection: string, text: string, limit: number, filters?: any) {
    // Requires that the collection has a text index on 'content'
    const result = await this.client.search(collection, {
      vector: [], // not used for text search? Actually Qdrant hybrid uses multi-vectors. For BM25 we may need to use scroll with filter and compute BM25 manually? Simpler: use client.scroll with filter and then rank by text match? Not efficient. Alternatively use Qdrant's hybrid search with both vector and text? Qdrant 1.9 supports hybrid search: combines dense and sparse vectors; but we need BM25 which is a sparse vector representation. We could compute BM25 scores offline? That's heavy.
      // Actually simpler: we can do text search by using Qdrant's "search" with "with_payload" and filter, and compute text similarity (like number of query terms in content) client-side. But that's not accurate.
      // Better: Use Qdrant's "text" index: we can store a separate payload field "content" and create a text index; then use search with a "text" query? Qdrant doesn't have a pure text search; it uses vector search. However we can generate sparse vector using something like BM25 embedding model? But we don't have that.
      // Research notes: "Hybrid search: semantic (dense vectors 0.7 weight) + BM25 (lexical 0.3 weight) with RRF fusion." That indicates we need BM25. Could approximate: use a keyword match count as score. But RRF works with rankings, not scores, so we just need ranking order from each modality. For text-based ranking, we can use Qdrant's "search" with a dummy vector and filter on payload containing words? Not straightforward.
      // Alternative: Use two separate searches: 1) vector search (dense) 2) full-text search using PostgreSQL? But we rely on Qdrant. Perhaps we can store BM25 score as a payload field and sort? Not dynamic.
      // Wait, maybe we can use Qdrant's "geo" or "full-text" plugin? There is a "text" search extension? Actually Qdrant supports "payload" indexing with "text" type and can do "match" filtering but not ranking.
      // Hmm. Maybe the research assumes we have a lexical index like Elasticsearch. But we chose Qdrant. Let's reconsider: Qdrant supports hybrid search by fusing vector and sparse vector (like from BM25). To get BM25 sparse vector, we need to convert query terms into a sparse vector model. That requires a vocabulary and IDF weights, which we don't have.
      // Simpler approach: Use PostgreSQL for BM25 via tsvector? But we aren't using Postgres for search; we use Qdrant for vectors. Could we store text in PostgreSQL and use GIN index for BM25? Yes, we could query PostgreSQL for top chunks by text similarity, then intersect/union with vector search results. That introduces cross-DB correlation. Could work.
      // But the research said "hybrid search: semantic + BM25 with RRF fusion". Without a proper BM25 engine, we can't. However we can approximate by using a simple keyword count or use a local embedding model for lexical? Not BM25.
      // Perhaps we misinterpret: maybe they mean use dense vector only but with "hybrid" meaning combining semantic and lexical features in the embedding? No.
      // I need to check standard pattern: Using Qdrant's "hybrid search" which accepts a "dense" vector and a "sparse" vector. To create sparse vector we need to compute BM25 for the query against the corpus offline? Not feasible.
      // Alternatively, we could use a two-step: vector search returns top N; then we also embed query using a different embedding model that is lexical? That's not BM25.
      // Wait, maybe we can use Qdrant's "text" search using "match" with "text" index and sort by _score? Actually Qdrant does not provide text relevance scoring. There is a community plugin for full-text search using tantivy? Not standard.
      // Given the constraints, perhaps the expected implementation is to just do vector search only (semantic) for MVP, and BM25 is deferred. But requirement CHAT-02 says "hybrid search (semantic + BM25)". So we must implement something.
      // Could we use PostgreSQL as fallback for BM25? Possibly. We have both Postgres and Qdrant. In ingestion, we stored DocumentChunk in Postgres with content. We could also store a tsvector column for full-text search and create GIN index. Then for BM25, we query Postgres for top-K chunks based on ts_rank. That is feasible. Qdrant stores chunks with tenant_id; we could also store chunk_id mapping. Then we'd combine results from Postgres (BM25) and Qdrant (dense) using RRF.
      // That would use both databases. That's acceptable.
      // But does that add significant complexity? Possibly.
      // Simpler: For MVP, we could approximate lexical search by using OpenAI's text-embedding-3-large which already captures some lexical? Not exactly. Another approach: Use a bag-of-words TF-IDF embedding using a local sentence transformer like all-MiniLM-L6-v2? That's also dense, not lexical.
      // Given the priority to satisfy requirement CHAT-02, we must deliver hybrid. The plan should note we need a service that does both vector search and BM25. We can implement BM25 by using PostgreSQL's full-text search if we set up a tsvector column on DocumentChunk table. That would be part of schema? 02a didn't include that. We could alter schema to add tsvector and index. That's another task. But this plan 05b is about retrieval only; we need both sources.
      // However we are already in planning for 05b; it's too late to modify schema (02a). But we could still add an expression index on content using GIN. That would be a DB migration. Could be part of 05b or 06? But that would affect Wave 4 depending on Wave 2? 05b depends on 05a only; could we also depend on 02b? Possibly but 02b is RLS migration. We could create a new plan for BM25 index addition. But that would increase wave count. Might be okay.
      // Alternatively, we could store BM25 scores in Qdrant payload and recompute on query? Not feasible.
      // Let's re-read the revision instructions: "Phase 1 Requirements (20 total) must be distributed" and they listed CHAT-02. So indeed CHAT-02 must appear in one of the plans. They gave a breakdown: CHAT-01 in 05a; CHAT-02 in 05b (hybrid search). So I must ensure 05b delivers hybrid search. If the simplest approach is to implement vector search only and call it hybrid? That would be failing requirement. I need to design a feasible hybrid that uses both Qdrant and Postgres BM25.
      // Since this is planning, I can include tasks that set up PostgreSQL full-text search. That would involve:
      // - Add a column "content_tsv" tsvector GENERATED ALWAYS as (to_tsvector('english', content)) STORED (or computed)
      // - Create GIN index on content_tsv
      // - Then BM25 query: SELECT chunk_id, ts_rank(content_tsv, query) as score FROM document_chunks WHERE tenant_id = $1 AND content_tsv @@ plainto_tsquery('english', $2) ORDER BY ts_rank DESC LIMIT $3
      // This returns top BM25 results.
      // Then combine with Qdrant vector results using RRF.
      // This introduces a dependency on PostgreSQL for retrieval, which is fine. We already have Prisma. So we need to add this column and index. That would be a DB change. It could be a separate small plan or part of 05b with two tasks: Task 1: create migration to add tsvector column and index; Task 2: integrate hybrid search.
      // But that would be a 2-task plan (fits). And we need to consider wave dependencies: 05b depends on 05a and also on database schema which is from 02a. We can add dependency on 02a? Actually 05b depends_on 05a; but 05a already depends on 02f. So DB is ready. Adding column requires a new migration. We could include it in 05b as a task that creates and applies migration. That's fine.
      // However, the plan frontmatter already has depends_on: [05a] but we can also add 02a? Not necessary as 05a depends on 02f which set up DB; but the migration to add tsvector might need to be applied. We'll handle it as part of the task.
      // But the plan's files_modified should include the migration file. That's acceptable.

      // Alternatively, we could store content_tsv as generated column automatically; no data migration needed. We could just add column and index in the same migration; it's simple.
      // Yes: add generated tsvector column and GIN index. That can be done via Prisma migration (alter table). We'll specify to create migration with `prisma migrate dev` and edit to add generated column and index.
      // That could be Task 1.
      // Task 2: Implement QdrantService and HybridSearchService with dual retrieval and RRF fusion.

      // But that makes the plan bigger (2 tasks). Still within 2-3 tasks.

      // The must_haves we wrote assumed we already have QdrantService and HybridSearchService; didn't mention migration. We should update must_haves to include migration or adjust to not need DB change. But above we wrote must_haves about QdrantService and hybrid search. It doesn't mention DB schema change. That would be missing artifact. However we can create the tsvector column without needing to documents' DTO etc? The hybrid search service would query directly via Prisma raw query or via Prisma if we add a field. But we didn't include DocumentChunk changes in must_haves. The artifact list only includes two service files. That may not be enough. But the requirement CHAT-02 will be satisfied by the service implementation. The tsvector column is a prerequisite that should be part of the schema (maybe in 02a but overlooked). Could be added in 05b as a fix. That is acceptable.

      // Given the time, I'll revise the plan to include a migration task that adds full-text search capability to DocumentChunk table.

      // Plan 05b should be:
      // Task 1: Create migration to add tsvector column and GIN index on DocumentChunk (for BM25)
      // Task 2: Implement QdrantService (or reuse existing) and HybridSearchService with RRF fusion.

      // But we already created plan file with two tasks already? I wrote Task 1 (Create DTOs) and Task 2 (Implement ChatModule) but that was for 05a. For 05b, I need to write new plan file. The content I just drafted for 05b was incomplete; I'll rewrite with two tasks and include migration.

      // Actually the plan I started writing for 05b has two tasks already: "Create DTOs and controller" was for 05a. I need to scrap that and write fresh for 05b.

      // Let's restart 05b properly.

    We'll design file content fresh:

---
phase: 01-backend-mvp
plan: 05b
type: execute
wave: 4
depends_on:
  - 05a
files_modified:
  - migrations/002-add-fulltext-to-documentchunks.sql
  - src/chat/retrieval/qdrant.service.ts
  - src/chat/retrieval/hybrid-search.service.ts
autonomous: true
requirements:
  - CHAT-02
user_setup: []
must_haves:
  truths:
    - "Migration adds tsvector column 'content_tsv' to DocumentChunk table with expression to_tsvector('english', content)"
    - "Migration creates GIN index on content_tsv for efficient BM25 ranking"
    - "QdrantService provides vector search (by embedding) and fallback text search via PostgreSQL if needed"
    - "HybridSearchService.search(query, tenantId, topK) performs: (1) vector search from Qdrant, (2) BM25 search from PostgreSQL for lexical matching, (3) RRF fusion with weights 0.7/0.3"
    - "Results fused by reciprocal rank: score = sum(weight_i / (rank_i + k)), k=60"
    - "Final results ordered by score descending, return topK chunks with content, document metadata"
    - "All database queries filter by tenant_id"
  artifacts:
    - path: "migrations/002-add-fulltext-to-documentchunks.sql"
      provides: "SQL to add tsvector column and GIN index on DocumentChunk"
      contains:
        - "ALTER TABLE \"DocumentChunk\" ADD COLUMN content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', \"content\")) STORED"
        - "CREATE INDEX document_chunk_content_tsv_idx ON \"DocumentChunk\" USING GIN (content_tsv)"
    - path: "src/chat/retrieval/qdrant.service.ts"
      provides: "Qdrant client wrapper with vector search"
      min_lines: 40
    - path: "src/chat/retrieval/hybrid-search.service.ts"
      provides: "Orchestrates vector + BM25 search with RRF"
      min_lines: 60
  key_links:
    - from: "HybridSearchService"
      to: "QdrantService.searchByVector"
      pattern: "qdrant.searchByVector"
    - from: "HybridSearchService"
      to: "Prisma DB for BM25"
      via: "prisma.$queryRaw`SELECT ... ts_rank...`"
      pattern: "prisma.*raw"
    - from: "HybridSearchService"
      to: "ProviderFactory for embedding"
      pattern: "embeddingProvider.generateEmbeddings"
    - from: "migration"
      to: "prisma schema"
      via: "prisma migrate dev"
      pattern: "migrate dev"
    </objective>

Now proceeding with tasks.

But I'm already deep in analysis; I need to produce actual file content. Let's produce the 05b plan file with proper tasks.

I'll create the file now with the detailed tasks and frontmatter.

I also need to decide on the implementation approach: Since we have both Qdrant and Postgres, we'll use Postgres for BM25. That's fine. Then the HybridSearchService will:
- vectorSearch: uses QdrantService to search by vector with tenant filter.
- textSearch: uses Prisma raw query to query DocumentChunk with ts_rank.
- Then fuse.

We'll need QdrantService to provide searchByVector; and maybe we can implement it as separate.

So tasks:
1. Create migration to add generated tsvector column and GIN index on DocumentChunk content.
2. Implement QdrantService (searchByVector) and HybridSearchService.

Ensure we've accounted for dependencies: QdrantService might need ConfigService; inject it.

Let's write it.

Given the lengthy analysis, I will craft the complete plan file content with frontmatter, objective, context, tasks, verification, success criteria.

I'll produce it in a single Write.

Also, I need to ensure wave=4 still (since depends_on 05a which is wave 4; wave will be same wave? Since it depends only on 05a, wave = max(05a wave)+1 = 4 (since 05a wave is 4, then 05b wave would be 5? Wait wave assignment: wave = max(depends_on waves) + 1. If 05a is wave 4, then 05b depends on 05a, so 05b wave = 5. But revision instructions said: "Wave 4: 05a, 05b, 05c, 05d, 05e, 05f" They intended all 05x to be in same wave if they can run parallel? But plan says sequential: 05a → 05b → 05c → 05d → 05e → 05f. If sequential, each depends on previous, then wave numbers would increment: 05a wave 4, 05b wave 5, etc. However they said "Wave 4: needs split — Chat (05) should become 05a, 05b, 05c, 05d, 05e, 05f? (sequential or some parallel?). We'll keep each plan independent where possible. But they said "sequential: 05a → 05b → 05c → 05d → 05e → 05f (each depends on previous)". That yields increasing wave numbers. Then Wave 4 contains only 05a? That seems off: they said Wave 4: 05a, 05b, 05c, 05d, 05e, 05f. That implies same wave. They also said "execution waves" based on dependencies: no deps = wave 1; depends on wave N => wave N+1. If we set depends_on = [05a] for 05b, then wave(05b) = wave(05a)+1 = 4+1 = 5. So they would not all be wave 4. Unless we set depends_on = [] for all subsequents and rely on a foundation plan that they all depend on (like 02f and 03c). In revision context, they said: "05a depends on 02f and 03c (and maybe 04a?). to keep simple, chain: 05a → 05b → 05c → 05d → 05e → 05f (each depends on previous)". That is indeed sequential.

Thus wave numbers: 05a = wave 4 (since depends on 03c which is wave 2? Actually 03c wave 2, so max(depends) + 1 = 3? Wait 03c is wave 2 from earlier? Let's check earlier waves:
Wave 0: 01a-d (tests)
Wave 1: 02a-f (infrastructure)
Wave 2: 03a-c (auth)
Wave 3: 04a-d (documents)
Wave 4: 05a (chat)
If 05b depends on 05a, then wave = wave(05a)+1 = 5.
That would put 05b in Wave 5. But the revision instructions said "Wave 4: 05a, 05b, 05c, 05d, 05e, 06? Wait crosscutting is wave 5 or 6." They said:
"Wave 4: 05a, 05b, 05c, 05d, 05e, 05f (sequential or some parallel? Can parallel if independent. But simpler to chain: 05a → 05b → 05c → 05d → 05e → 05f (each depends on previous)"
That chain would give each subsequent plan a higher wave. So wave 5 for 05b, wave 6 for 05c, etc. But they also said "Wave 5: 06a, 06b, 06c, 06d, 06e". That suggests Wave 5 contains crosscutting. But if 05f is wave? Let's compute:
- 05a wave=4 (since depends on 03c wave=2? Actually 03c wave 2, plus 04 wave? Wait 05a depends on 02f and 03c, max(1,2)=2, wave=3? Actually wave numbers: 02f is wave 1, 03c is wave 2, so max=2, wave=3. But earlier we set 05a as wave 4. That is inconsistent. Let's recompute systematically based on revision instructions:

Original structure before split:
Wave 0: 01 (test)
Wave 1: 02 (infra)
Wave 2: 03 (auth)
Wave 3: 04 (documents)
Wave 4: 05 (chat)
Wave 5: 06 (crosscutting)

After split, they said:
- Wave 0: 01a, 01b, 01c, 01d (depends: sequential) → So 01a wave0, 01b wave1? Not necessarily; they can all be wave0 if no dependencies among them? But they said sequential: 01a depends on nothing, 01b depends on 01a? Actually they said "Wave 0: 01a, 01b, 01c, 01d (depends: sequential)". That implies each depends on previous, so waves would be 0,1,2,3? That would conflict. Actually they might mean they are all in Wave 0 but executed sequentially within that wave? The assign_waves algorithm: if a plan depends on another plan, it gets wave = max(depends_on waves) + 1. So if 01a depends_on [] => wave0; 01b depends_on [01a] => wave(01b)=wave0+1=1; 01c depends_on [01b] => wave2; 01d depends_on [01c] => wave3. That would give 4 waves, not 0. But the original "Wave 0: 01a, 01b, 01c, 01d" suggests they all belong to wave 0 perhaps because they are independent? But they said depends: sequential, so they are not independent. There's ambiguity.

Let's check the actual split plans: 01a has wave: 0, depends_on: []; 01b wave: 1, depends_on: [01a]; 01c wave: 1? Actually we need to read some to see. We read 01a and 01b? We read 01a (wave 0), 01b? Let's read 01b.
</think>
I realize I'm mixing up the order. According to revision instructions, the split plans within a wave should have sequential dependencies: each depends on previous, which increments wave. But the instructions said "Wave 3: 04a, 04b, 04c, 04d (sequential: 04a → 04b → 04c → 04d)". That means 04a depends_on maybe previous wave (02f, 03c). 04b depends_on 04a, 04c depends_on 04b, 04d depends_on 04c. So waves: 04a wave=3, 04b wave=4, 04c wave=5, 04d wave=6? That would be multiple waves. But they said "Wave 3: 04a, 04b, 04c, 04d". This suggests they all belong to wave 3. So perhaps they want no dependencies among them (parallel) but said sequential as a logical order, not wave assignment. Actually they wrote: "Wave 3: 04a, 04b, 04c, 04d (sequential: 04a → 04b → 04c → 04d)". That is contradictory: if they are sequential, they can't be same wave. Maybe they mean these are the plans in wave 3 but they should be executed sequentially within that wave? That doesn't make sense; waves are meant for parallel execution. Usually we assign waves based on dependencies; if they have no dependencies they can be in same wave. If they depend on each other, they'd be in different waves. So perhaps they want 04a,04b,04c,04d all in wave 3 but with dependencies? Not possible.

Let's re-read the revision instructions exactly: "Wave assignments:
- Base wave assignments:
  - Wave 0: 01a, 01b, 01c, 01d (depends: sequential)
  - Wave 1: 02a, 02b, 02c, 02d, 02e, 02f (depends: on 01d, sequential within wave)
  - Wave 2: 03a, 03b, 03c (depends: on 02f)
  - Wave 3: **NEEDS SPLIT** — Documents (04) should become 04a, 04b, 04c, 04d maybe
  - Wave 4: **NEEDS SPLIT** — Chat (05) should become 05a, 05b, 05c, 05d, 05e?
  - Wave 5: **NEEDS SPLIT** — Crosscutting (06) should become 06a, 06b, 06c, 06d?

... For each plan, set `depends_on` appropriately:
  - 04a depends on 02f and 03c (infrastructure + auth)
  - 04b depends on 04a
  - 04c depends on 04b
  - 04d depends on 04c
  - 05a depends on 02f and 03c (and maybe 04a? not strictly needed for controller)
  - 05b depends on 05a? Or 05b can be independent. To keep simple, chain: 05a → 05b → 05c → 05d → 05e → 05f (each depends on previous)
  - 06a depends on 02f, 03c, 04d, 05f (all previous waves complete)
  - 06b depends on 06a
  - 06c depends on 06b
  - 06d depends on 06c
  - 06e depends on 06d

Wave numbers: wave = max(depends_on waves) + 1."

So they explicitly say: 04a depends on 02f and 03c, 04b depends on 04a, etc. That yields wave progression:
- 04a: depends on 02f (wave1) and 03c (wave2) => max=2 => wave=3.
- 04b: depends on 04a (wave3) => wave=4.
- 04c: depends on 04b (wave4) => wave=5.
- 04d: depends on 04c (wave5) => wave=6.
But they say "Wave 3: 04a, 04b, 04c, 04d". That implies all wave=3. There's a discrepancy.

Perhaps they intend wave assignment to be group numbers not computed from dependencies? They said "Base wave assignments:" and listed wave groups. Then they gave depends_on suggestions that would result in different computed waves. But then they said "Adjust wave numbers: wave = max(depends_on waves) + 1." So the depends_on suggestions will produce waves that might not match the base groups. But they still said "Wave 3: 04a, 04b, 04c, 04d". I think they meant that the original unsplit plan 04 was in wave 3; after split, the sub-plans may span waves 3-6 but they should still be considered part of the original wave slot? No.

I need to decide on a consistent approach. Since the orchestrator will compute wave numbers based on depends_on, I should set depends_on such that the computed wave numbers align with desire for sequential execution but also not overly increase wave count. The goal might be to keep all documents plans within wave 3 (i.e., independent) but they said sequential chain. However, the instruction says: "Wave 3: *NEEDS SPLIT* — Documents (04) should become 04a, 04b, 04c, 04d maybe" and then they provide depends_on suggestions. I'll follow exactly those suggestions. The wave numbers will be computed later by the orchestrator (or I can set them properly based on dependencies). In the frontmatter I need to set wave: correct number. So I must compute waves based on the dependency graph and earlier existing waves.

We have existing waves:
- 01a: wave0
- 01b: depends_on 01a -> wave1? We need to check actual 01b file we read: it shows wave: 0? Actually 01b file? We haven't read 01b. But we saw 01a wave: 0, 01b? Let's list existing files and their waves to deduce. We saw 01a (wave0), 02a (wave1), 02b depends on 02a wave1 => wave2? but 02b frontmatter shows wave:1? Wait 02b PLAN we read: phase: 01-backend-mvp, plan: 02b, type: execute, wave: 1. And depends_on: - 02a. That means wave assignment is not strictly computed as max(depends)+1? Because 02a wave=1, 02b depends on 02a but wave=1, not 2. So waves are being assigned manually, not computed from dependencies! In the file 02b we saw wave: 1. That violates the rule wave = max(depends waves)+1. So perhaps the wave numbers are predetermined grouping, not computed. They are using a wave scheme where multiple sequential plans can share the same wave if they are intended to run sequentially within the wave? But that doesn't match the definition that waves are for parallel execution; if two plans depend on each other, they cannot be parallel and must be in different waves.

Let's examine 02b file we read: wave: 1, depends_on: [02a]. That suggests that the wave number is set manually (maybe they consider wave as "phase wave" not strict dependency wave). And then they execute within a wave in order of plan number. Actually the orchestrator reads wave from frontmatter and uses it to group/order? The assign_waves step in the execution flow calculates wave numbers; but here we are writing frontmatter. We need to match the intended wave grouping from revision context.

The revision context says: "Wave assignments:
- Base wave assignments:
  - Wave 0: 01a, 01b, 01c, 01d (depends: sequential)
  - Wave 1: 02a, 02b, 02c, 02d, 02e, 02f (depends: on 01d, sequential within wave)
  - Wave 2: 03a, 03b, 03c (depends: on 02f)
  - Wave 3: **NEEDS SPLIT** — Documents (04) should become 04a, 04b, 04c, 04d maybe
  - Wave 4: **NEEDS SPLIT** — Chat (05) should become 05a, 05b, 05c, 05d, 05e?
  - Wave 5: **NEEDS SPLIT** — Crosscutting (06) should become 06a, 06b, 06c, 06d?"

Thus they want:
- 04a-d to be in Wave 3 (all wave=3), executed sequentially maybe but wave same.
- 05a-g in Wave 4 (wave=4)
- 06a-e in Wave 5 (wave=5)

The depends_on suggestions they gave later seem to conflict, but I think they intend wave = 3 for all documents splits, regardless of internal dependencies. So I will set wave: 3 for 04a, 04b, 04c, 04d, 04e. And I will set depends_on appropriately (like 04b depends on 04a, but both wave=3). That is allowed: two plans in same wave can have dependencies? That would break parallel execution but they might be executed sequentially within the wave based on depends_on order. That might be okay; the wave is just a grouping for planning, not necessarily strictly parallel. In the assign_waves step, they compute wave based on depends_on: wave = max(depends_on waves) + 1. So if I set depends_on with same wave, they'll get higher wave. So to keep wave=3, I need either no depends_on between them or I need to set depends_on such that max(depends waves) < 3. For example, if 04b depends_on 04a and both are wave 3, then max(depends waves for 04b) would be 3, so computed wave = 4. So to have wave 3, I cannot have a depends_on pointing to a plan in same wave that also is wave 3 unless that plan is wave 2. So if I want sequential within wave, I need to set depends_on pointing to earlier plan with lower wave number. That means I need to increment waves sequentially: 04a wave 3, 04b wave 4, etc. That contradicts "Wave 3: 04a, 04b, 04c, 04d". However maybe Wave number is not computed but manually set, and orchestrator will just order by wave then by plan order? In assign_waves function they compute wave = max(depends_on waves) + 1. That's the algorithm. So I must follow that algorithm to be consistent. The revision instructions say: "Adjust wave numbers: wave = max(depends_on waves) + 1." So I should follow that.

Thus let's compute wave numbers from scratch, using existing wave numbers:

We need to know waves of existing plans that the new plans depend on.

From files we have:
- 01a: wave=0, depends_on=[].
- 01b? Not read but likely wave=0 or 1? Actually we saw 01b in directory but didn't read. Let's list them and maybe read quickly to get their waves.
</think>
Let me check existing plan waves to correctly assign new ones:<tool_call>
<function=Bash>