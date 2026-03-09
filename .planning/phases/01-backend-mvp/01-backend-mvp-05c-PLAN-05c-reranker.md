---
phase: 01-backend-mvp
plan: 05c
type: execute
wave: 15
depends_on:
  - 05b
files_modified:
  - src/chat/retrieval/reranker.service.ts
  - src/chat/retrieval/hybrid-search.service.ts
autonomous: true
requirements:
  - CHAT-02
user_setup: []
must_haves:
  truths:
    - "RerankerService.rerank(chunks: RetrievedChunk[], query: string, topK: number): Promise<RetrievedChunk[]> re-ranks retrieved chunks using cross-encoder or exact cosine similarity"
    - "Reranker computes precise relevance score between query and chunk content, overriding initial retrieval score"
    - "Reranker returns topK chunks sorted by refined score"
    - "HybridSearchService.search integrates reranker: after initial hybrid fusion, takes top 20, reranks, returns final topK"
    - "Reranker is stateless and can be replaced with different model later"
    - "Service handles errors (e.g., model load failure) by falling back to original scores"
  artifacts:
    - path: "src/chat/retrieval/reranker.service.ts"
      provides: "Reranking service using cross-encoder or cosine similarity"
      min_lines: 40
      exports:
        - "rerank(chunks, query, topK): Promise<RetrievedChunk[]>"
    - path: "src/chat/retrieval/hybrid-search.service.ts"
      provides: "Updated to include reranking step"
      min_lines: 60 (original) + modifications
  key_links:
    - from: "HybridSearchService.search"
      to: "RerankerService.rerank"
      via: "this.reranker.rerank(hybridResults, query, topK)"
      pattern: "reranker.rerank"
    - from: "RerankerService"
      to: "EmbeddingProvider (for query embedding)"
      via: "generateEmbeddings([query]) to compute cosine"
      pattern: "embeddingProvider.generateEmbeddings"
    - from: "RerankerService"
      to: "Chunk embeddings (from Qdrant payload or DB)"
      via: "need chunk embedding vector to compute cosine similarity"
      pattern: "chunk.embedding"

---

<objective>
Implement reranker service to refine retrieval results

Purpose: Re-rank the top retrieved chunks from hybrid search using a more precise (but expensive) relevance computation. For MVP, uses exact cosine similarity between query embedding and stored chunk embeddings; cross-encoder model placeholder for future.

Output: RerankerService integrated into HybridSearchService

</objective>

<execution_context>
@/Users/franciscoegloff/projects/metacortex/ops-ai-platform/.planning/workflows/execute-plan.md
@/Users/franciscoegloff/projects/metacortex/ops-ai-platform/.planning/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/01-backend-mvp/01-CONTEXT.md
@.planning/phases/01-backend-mvp/01-RESEARCH.md

# Reranker requirement (from CHAT-02 retrieval):
- "Retrieval: top-k chunks (k=10-20) with reranking via cross-encoder (ms-marco-MiniLM-L-6v2)"
- Cross-encoder is a model that scores query-chunk pairs; slower but more accurate than embedding cosine.
- For MVP, we can implement simple reranking using exact cosine similarity on embeddings because we already have embeddings stored. That's not cross-encoder but still improves ranking over approximate NN. We'll structure to allow future replacement.

# Implementation approach:
- RerankerService.constructor injects EmbeddingProvider (or can use the same provider for query embedding).
- Method: async rerank(chunks: RetrievedChunk[], query: string, topK: number): Promise<RetrievedChunk[]>
  Steps:
  1. Ensure each chunk has embedding vector (need to fetch from Qdrant if not already present). HybridSearchService initially retrieved chunks from Qdrant already have payload.embedding? In our QdrantService we can store embedding as vector; but payload may not contain the embedding unless we explicitly request it. Qdrant search results return points with payload and vector if withVector: true. We'll modify hybrid search to include vectors.
  2. Compute query embedding via embeddingProvider.generateEmbeddings([query])[0].
  3. For each chunk, compute cosine similarity: dot(queryEmbedding, chunkEmbedding) / (norm(q)*norm(chunkEmbedding)).
  4. Sort descending by cosine score.
  5. Return topK chunks with updated score (or keep hybrid score? We could replace with cosine or blend).
- Alternatively, if we want to use cross-encoder, we'd call a local model. Not needed now.

# Integration:
- In HybridSearchService.search, after we get hybridFusedResults (say top 20), we call reranker.rerank with those chunks and query, topK=final limit, then return.

# Files to modify:
- src/chat/retrieval/reranker.service.ts (new)
- src/chat/retrieval/hybrid-search.service.ts (existing from 05b) — add injection of RerankerService and call it.

# Dependencies: same as 05b.

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create RerankerService with cosine reranking</name>
  <files>
    src/chat/retrieval/reranker.service.ts
  </files>
  <action>
    Implement RerankerService:

    ```typescript
    import { Injectable, Logger } from '@nestjs/common';
    import { ProviderFactory } from '../../shared/infrastructure/providers/provider.factory';
    import { RetrievedChunk } from '../types/chat.types';

    @Injectable()
    export class RerankerService {
      private readonly logger = new Logger(RerankerService.name);

      constructor(private readonly providerFactory: ProviderFactory) {}

      async rerank(
        chunks: RetrievedChunk[],
        query: string,
        topK: number,
      ): Promise<RetrievedChunk[]> {
        if (chunks.length === 0) {
          return [];
        }

        // Get query embedding using the configured embedding provider
        const embeddingProvider = this.providerFactory.getEmbeddingProvider();
        const [queryEmbedding] = await embeddingProvider.generateEmbeddings([query]);

        // Compute cosine similarity for each chunk (requires chunk embedding vector)
        const chunkWithScores = await Promise.all(
          chunks.map(async (chunk) => {
            if (!chunk.embedding) {
              // If vector not present, we cannot rerank; keep original order with score 0
              this.logger.warn(`Chunk ${chunk.id} missing embedding; skipping rerank`);
              return { chunk, score: chunk.score };
            }

            const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
            return { chunk, score: similarity };
          }),
        );

        // Sort by score descending
        const reranked = chunkWithScores
          .sort((a, b) => b.score - a.score)
          .slice(0, topK)
          .map((cs) => cs.chunk);

        return reranked;
      }

      private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
          throw new Error('Vector dimensions mismatch');
        }
        let dot = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
          dot += a[i] * b[i];
          normA += a[i] * a[i];
          normB += b[i] * b[i];
        }
        if (normA === 0 || normB === 0) {
          return 0;
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
      }
    }
    ```

    Note: The RetrievedChunk type must include embedding: number[] field. We'll extend it if not already defined. The hybrid search results need to include chunk embeddings. Modify QdrantService to request vectors when searching: in searchByVector, set withVector: true to retrieve points with vectors. Then payload should include embedding.

    Verify: Service compiles; cosine similarity function works.
  </action>
  <verify>
    <automated>
      npx tsc --noEmit src/chat/retrieval/reranker.service.ts &&
      echo "RerankerService compiled"
    </automated>
  </verify>
  <done>RerankerService with cosine similarity implemented</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Integrate reranker into HybridSearchService</name>
  <files>
    src/chat/retrieval/hybrid-search.service.ts
  </files>
  <action>
    Update HybridSearchService to inject RerankerService and use it after initial retrieval:

    ```typescript
    // Add to imports: RerankerService
    // Add to constructor: private readonly reranker: RerankerService

    async search(query: string, tenantId: number, topK: number = 10): Promise<RetrievedChunk[]> {
      // ... existing steps: generate query embedding, vector search, text search, fuse

      // After getting fused results (say top 20), apply reranker to get final topK
      const reranked = await this.reranker.rerank(fusedResults, query, topK);
      return reranked;
    }
    ```

    Also, ensure that when we call qdrant.searchByVector, we request vectors to be returned. In QdrantService.searchByVector, add option `withVector: true` in request, and map result to include vector in payload or separate field. We'll need to adjust the mapping:

    ```typescript
    // In QdrantService.searchByVector:
    const result = await this.client.search(collection, {
      vector,
      limit,
      filter: filters ? { must: filters } : undefined,
      with_payload: true,
      with_vector: true,  // add this
    });
    // Map points: { id, payload, vector }
    return result.result.map(point => ({
      id: point.id,
      ...point.payload,
      embedding: point.vector, // add for reranker
    }));
    ```

    Then the retrieved chunks will include embedding.

    Similarly, for text search (BM25) results we don't need vectors; but reranker only operates on the fused set which comes from both sources; we need embeddings for each unique chunk. Since BM25 results may not have vectors (if we didn't fetch vectors for text search), we could fetch them separately. Simpler: only vector search returns vectors; BM25 returns IDs and we need to fetch embeddings for those from DB or Qdrant. But we can also set text search to return vectors? It might not be efficient. Alternative: after fusion, we have a list of chunk IDs. We could fetch embeddings for all those chunks from Qdrant using scroll with filter and with_vector. Simpler: modify hybrid search to first gather all unique chunk IDs from both result sets, then fetch their vectors in a batch from Qdrant. Then apply reranker on those with vectors. That would be more accurate.

    Let's adjust: after we have vectorResults (with embeddings) and textResults (maybe without), we combine IDs, remove duplicates, then fetch points with vectors for those IDs via Qdrant scroll/search by ID list. Then compute rerank scores.

    But to keep MVP simpler, we can skip reranker for now and note it's a placeholder. However the requirement is there. We'll implement as above: ensure vector search returns vectors; for BM25 results, we could skip if no embedding, but that would degrade. Better: in hybrid search, we already have embeddings for vector results; for text results, we could fetch embeddings separately by calling qdrant.getPoints with those IDs (Qdrant has Get method). We'll add that step.

    This is getting complex but manageable within 2 tasks. We'll outline in action.

    For clarity, I'll provide a revised HybridSearchService implementation:

    ```typescript
    // Existing imports + RerankerService
    async search(query: string, tenantId: number, topK: number = 10): Promise<RetrievedChunk[]> {
      // 1. Get query embedding
      const embeddingProvider = this.providerFactory.getEmbeddingProvider();
      const [queryEmbedding] = await embeddingProvider.generateEmbeddings([query]);

      // 2. Vector search with vectors returned
      const vectorResults = await this.qdrant.searchByVector('document_chunks', queryEmbedding, topK * 2, {
        must: [{ key: 'tenant_id', match: { value: tenantId } }],
      });

      // 3. Text search (BM25) via PostgreSQL GIN index
      const textResults = await this.bm25Search(query, tenantId, topK * 2); // implement separate method using raw query

      // 4. Fuse using RRF (weights 0.7, 0.3)
      const fused = this.fuseRRF(vectorResults, textResults, topK * 2);

      // 5. Ensure all fused chunks have embeddings: vectorResults already have; textResults may not. Fetch missing embeddings via Qdrant get
      const missingIds = fused
        .filter(c => !c.embedding)
        .map(c => c.id);
      if (missingIds.length > 0) {
        const points = await this.qdrant.getPoints('document_chunks', missingIds);
        // Create map id->embedding
        const embeddingMap = new Map(points.map(p => [p.id, p.vector]));
        // Attach embeddings to chunks
        fused.forEach(c => {
          if (!c.embedding && embeddingMap.has(c.id)) {
            c.embedding = embeddingMap.get(c.id);
          }
        });
      }

      // 6. Rerank using RerankerService
      const reranked = await this.reranker.rerank(fused, query, topK);
      return reranked;
    }
    ```

    We'll need to implement bm25Search method in HybridSearchService or QdrantService that uses PostgreSQL. That method will execute a raw SQL query:

    ```typescript
    private async bm25Search(query: string, tenantId: number, limit: number): Promise<RetrievedChunk[]> {
      const sql = `
        SELECT id, content, document_id, ts_rank(content_tsv, plainto_tsquery('english', $1)) as score
        FROM "DocumentChunk"
        WHERE tenant_id = $2 AND content_tsv @@ plainto_tsquery('english', $1)
        ORDER BY score DESC
        LIMIT $3
      `;
      const results = await this.prisma.$queryRaw`
        SELECT id, content, document_id, ts_rank(content_tsv, plainto_tsquery('english', ${query})) as score
        FROM "DocumentChunk"
        WHERE tenant_id = ${tenantId} AND content_tsv @@ plainto_tsquery('english', ${query})
        ORDER BY score DESC
        LIMIT ${limit}
      `;
      // map to RetrievedChunk
      return results.map(r => ({
        id: r.id,
        content: r.content,
        documentId: r.document_id,
        score: r.score,
        // no embedding initially
      } as RetrievedChunk));
    }
    ```

    This uses the tsvector column we added in migration 05b. We'll need PrismaService injection.

    So modifications to HybridSearchService: add PrismaService injection (maybe already has?), add bm25Search method, add rerank step.

    That's a fair amount of change but doable.

    We'll note that this task modifies HybridSearchService from 05b.

    Verify: Updated service compiles; new imports; method calls.

  </action>
  <verify>
    <automated>
      grep -q "RerankerService" src/chat/retrieval/hybrid-search.service.ts &&
      grep -q "bm25Search" src/chat/retrieval/hybrid-search.service.ts &&
      grep -q "this.reranker.rerank" src/chat/retrieval/hybrid-search.service.ts &&
      echo "HybridSearchService integrated with reranker and BM25"
    </automated>
  </verify>
  <done>Reranker integrated into hybrid search pipeline</done>
</task>

</tasks>

<verification>
Wave 4c - Reranker service integrated

**Automated checks:**
1. RerankerService file exists, exports rerank method
2. HybridSearchService injects RerankerService and calls it in search()
3. Hybrid search now performs: vector search (with embeddings), BM25 from PostgreSQL (using tsvector from 05b migration), RRF fusion, rerank with cosine, return topK
4. QdrantService modified to return vectors (withVector: true) and maybe add getPoints method
5. PrismaService injected into HybridSearchService for BM25 query
6. Migration 05b applied before this plan runs
7. All TypeScript compiles

**Requirements coverage:**
- CHAT-02: Hybrid search (semantic + BM25) with reranking ✓ (though cross-encoder placeholder)

**Dependencies:**
- 05b (HybridSearchService base)
- 02c (Prisma)
- 02e (EmbeddingProvider)
- 02d (Qdrant)

**Next:** 05d for LLM generation streaming.

</verification>

<success_criteria>
Reranker complete when:
- [ ] RerankerService.rerank computes cosine similarity between query and chunk embeddings
- [ ] HybridSearchService.search includes BM25 search via PostgreSQL tsvector
- [ ] HybridSearchService calls reranker after fusion
- [ ] QdrantService.searchByVector returns vectors (withVector: true)
- [ ] HybridSearchService fetches missing embeddings via a getPoints call
- [ ] TypeScript compiles without errors

**Deliverable:** Refined retrieval with reranking.

**Output:** `.planning/phases/01-backend-mvp/01-backend-mvp-05c-PLAN-05c-summary.md`

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-05c-PLAN-05c-summary.md`
