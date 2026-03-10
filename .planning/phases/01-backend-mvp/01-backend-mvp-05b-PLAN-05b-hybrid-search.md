---
phase: 01-backend-mvp
plan: 05b
type: execute
wave: 5
depends_on:
  - 05a
files_modified:
  - prisma/migrations/002-add-fulltext-documentchunk.sql
  - src/chat/retrieval/qdrant.service.ts
  - src/chat/retrieval/hybrid-search.service.ts
autonomous: true
requirements:
  - CHAT-02
user_setup: []
must_haves:
  truths:
    - "Migration adds generated tsvector column content_tsv to DocumentChunk using to_tsvector('english', content)"
    - "Migration creates GIN index on content_tsv for efficient BM25 ranking"
    - "QdrantService provides searchByVector(collection, vector, limit, filters) that queries Qdrant with tenant isolation"
    - "HybridSearchService implements hybrid search: generates query embedding via ProviderFactory, performs vector search (Qdrant) and BM25 search (PostgreSQL ts_rank), fuses results with Reciprocal Rank Fusion (weights: semantic 0.7, lexical 0.3, k=60)"
    - "HybridSearchService returns topK chunks with content, document_id, documentName, pageNumber, score respecting tenant_id filter"
  artifacts:
    - path: "prisma/migrations/002-add-fulltext-documentchunk.sql"
      provides: "SQL migration adding generated tsvector column and GIN index"
      contains:
        - "ALTER TABLE \"DocumentChunk\" ADD COLUMN content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', \"content\")) STORED"
        - "CREATE INDEX document_chunk_content_tsv_idx ON \"DocumentChunk\" USING GIN (content_tsv)"
    - path: "src/chat/retrieval/qdrant.service.ts"
      provides: "Qdrant client wrapper with searchByVector method"
      min_lines: 40
    - path: "src/chat/retrieval/hybrid-search.service.ts"
      provides: "Orchestration of dual-modal search with RRF fusion"
      min_lines: 60
  key_links:
    - from: "HybridSearchService"
      to: "QdrantService.searchByVector"
      pattern: "qdrant.searchByVector"
    - from: "HybridSearchService"
      to: "PostgreSQL tsvector search"
      via: "prisma.$queryRaw SELECT chunk_id, ts_rank... ORDER BY ts_rank DESC"
      pattern: "ts_rank"
    - from: "HybridSearchService"
      to: "ProviderFactory"
      pattern: "embeddingProvider.generateEmbeddings"
    - from: "HybridSearchService"
      to: "tenant_id filter"
      pattern: "tenant_id.*filters"

---

<objective>
Implement hybrid search combining semantic (dense vector) and BM25 (lexical) retrieval with RRF fusion

Purpose: Achieve high-recall document chunk retrieval by combining vector similarity (OpenAI embeddings) with lexical matching (PostgreSQL BM25), fusing rankings via Reciprocal Rank Fusion while enforcing tenant isolation. Core for RAG pipeline (CHAT-02).

Output: Migration to enable BM25, QdrantService for vector search, HybridSearchService orchestrating RRF

</objective>

<execution_context>
@/Users/franciscoegloff/.claude/get-shit-done/workflows/execute-plan.md
@/Users/franciscoegloff/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/PROJECT.md
@.planning/phases/01-backend-mvp/01-CONTEXT.md
@.planning/phases/01-backend-mvp/01-RESEARCH.md

# Research insights (from 01-RESEARCH.md):
- Hybrid search: semantic weight 0.7, BM25 weight 0.3, fusion via RRF (k=60)
- Qdrant for dense vector search (cosine similarity, topK ~20)
- BM25 via PostgreSQL full-text search with tsvector and ts_rank
- Two-phase retrieval: get top-N from each modality, then re-rank by RRF score

# Existing infrastructure:
- 02d created RedisService, Qdrant client infrastructure (shared)
- 02e created EmbeddingProvider (OpenAI and Local)
- 04a created DocumentUploadWorker that upserts vectors to Qdrant with metadata
- 04c created DocumentsService that manages DocumentChunk records in Postgres
- 05a created Chat conversation CRUD

# Implementation approach:
- Reuse Qdrant client from shared if available; create a wrapper service in chat/retrieval focused on vector search
- Use Prisma raw queries for BM25: SELECT chunk_id FROM "DocumentChunk" WHERE tenant_id = $1 AND content_tsv @@ plainto_tsquery('english', $2) ORDER BY ts_rank(content_tsv, plainto_tsquery('english', $2)) DESC LIMIT $3
- Ensure all queries filter by tenant_id
- RRF: For each chunk appearing in either list, compute score = 0.7/(rank_dense+60) + 0.3/(rank_sparse+60), then sort descending.

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add full-text search support to DocumentChunk</name>
  <files>
    prisma/migrations/002-add-fulltext-documentchunk.sql
  </files>
  <action>
    - Generate a new Prisma migration: `npx prisma migrate dev --name add-fulltext-documentchunk`
    - Edit the generated migration to add a generated tsvector column and GIN index:
      ```sql
      ALTER TABLE "DocumentChunk" ADD COLUMN content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', "content")) STORED;
      CREATE INDEX document_chunk_content_tsv_idx ON "DocumentChunk" USING GIN (content_tsv);
      ```
    - Apply the migration: `npx prisma migrate deploy`
  </action>
  <verify>
    <automated>
      grep -q "content_tsv" prisma/schema.prisma && echo "Schema ready" && npx prisma migrate resolve --list | grep -q "002-add-fulltext-documentchunk.*(applied)" && echo "Migration applied"
    </automated>
  </verify>
  <done>DocumentChunk full-text search column and index added</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement QdrantService and HybridSearchService</name>
  <files>
    src/chat/retrieval/qdrant.service.ts
    src/chat/retrieval/hybrid-search.service.ts
  </files>
  <action>
    - Implement QdrantService with searchByVector(collection, vector, limit, filters) that calls Qdrant client.search with with_payload=true and tenant filter
    - Implement HybridSearchService:
      - Inject EmbeddingProvider (via ProviderFactory) and QdrantService
      - search(query, tenantId, topK=10):
        * Generate embedding for query
        * vectorResults = qdrant.searchByVector('document_chunks', embedding, topK*2, { tenant_id: tenantId })
        * bm25Results = prisma.$queryRaw`SELECT chunk_id, content, "documentId", "pageNumber", ts_rank(content_tsv, plainto_tsquery('english', ${query})) as score FROM "DocumentChunk" WHERE tenant_id = ${tenantId} AND content_tsv @@ plainto_tsquery('english', ${query}) ORDER BY score DESC LIMIT ${topK*2}`
        * Fuse both result sets using RRF: score = 0.7/(rank_dense+60) + 0.3/(rank_sparse+60)
        * Return topK chunks with content, documentName (join with Document table if needed), pageNumber, score
      - Handle ties and missing modalities (if a chunk appears only in one list, its score from the other is 0)
    - Write unit tests for both services mocking dependencies
    - Verify TypeScript compiles: `npx tsc --noEmit`
  </action>
  <verify>
    <automated>
      grep -q "searchByVector" src/chat/retrieval/qdrant.service.ts && grep -q "HybridSearchService" src/chat/retrieval/hybrid-search.service.ts && echo "Services implemented" && npx tsc --noEmit | grep -q "error" && echo "TS OK"
    </automated>
  </verify>
  <done>Hybrid search with RRF fusion operational</done>
</task>

</tasks>

<verification>
Wave 5b - Hybrid search complete

**Automated checks:**
1. Migration 002 exists and adds content_tsv + GIN index on DocumentChunk
2. Migration applied: `prisma migrate resolve --list` shows 002 applied
3. QdrantService.searchByVector implemented with tenant filter
4. HybridSearchService.search returns topK with RRF fusion (0.7 semantic, 0.3 BM25)
5. Queries filter by tenant_id (both vector and BM25 branches)
6. Unit tests for both services pass
7. TypeScript compiles without errors
8. CHAT-02 requirement satisfied

**Integration points:**
- DocumentsModule (04e) registers Qdrant service in global scope
- DocumentsWorker (04a) continues upserting to Qdrant
- ChatModule (05a) will depend on HybridSearchService for retrieval

**Performance:**
- Vector search uses topK*2 to ensure enough candidates for fusion
- BM25 query uses ts_rank with plainto_tsquery; index usage ensures sub-second latency
- RRF fusion complexity O(n log n) for n = up to 40 combined candidates

</verification>

<success_criteria>
Hybrid search ready when:
- [ ] Migration applied with content_tsv generated column and GIN index
- [ ] QdrantService.searchByVector uses Qdrant client with tenant filter
- [ ] HybridSearchService.search produces fused results using RRF (semantic weight=0.7, lexical weight=0.3, k=60)
- [ ] All database operations are tenant-scoped (tenant_id filter mandatory)
- [ ] Unit tests cover both vector and BM25 paths, plus RRF edge cases
- [ ] `npx tsc --noEmit` passes
- [ ] CHAT-02 requirement marked complete in REQUIREMENTS.md

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-05b-PLAN-05b-summary.md`
</output>