/**
 * Mock Qdrant Service for testing vector search operations
 * Simulates Qdrant vector database with tenant-scoped collections
 */

export interface SearchResult {
  id: string;
  score: number;
  payload: any;
}

export class MockQdrantService {
  private collections: Map<string, Map<string, any>> = new Map();

  /**
   * Get collection name for a tenant
   */
  private collectionName(tenantId: number): string {
    return `tenant_${tenantId}`;
  }

  /**
   * Initialize collection for a tenant (no-op for mock)
   */
  async ensureCollection(tenantId: number, vectorSize: number = 3072): Promise<void> {
    const name = this.collectionName(tenantId);
    if (!this.collections.has(name)) {
      this.collections.set(name, new Map());
      console.log(`MockQdrant: Created collection ${name} with vector size ${vectorSize}`);
    }
  }

  /**
   * Upsert vectors into a tenant's collection
   * Simulates Qdrant's upsert endpoint with point structures
   */
  async upsertVectors(
    tenantId: number,
    documentId: number,
    chunks: string[],
    embeddings: number[][]
  ): Promise<void> {
    const name = this.collectionName(tenantId);
    if (!this.collections.has(name)) {
      await this.ensureCollection(tenantId, embeddings[0]?.length || 3072);
    }

    const collection = this.collections.get(name)!;

    chunks.forEach((chunk, index) => {
      const pointId = `${documentId}:${index}`;
      collection.set(pointId, {
        id: pointId,
        vector: embeddings[index],
        payload: {
          tenant_id: tenantId,
          document_id: documentId,
          chunk_index: index,
          content: chunk,
          indexed_at: new Date().toISOString(),
        },
      });
    });

    console.log(`MockQdrant: Upserted ${chunks.length} vectors to ${name}`);
  }

  /**
   * Search for similar vectors with tenant filtering
   * Simulates hybrid search (semantic only for mock; BM25 would require text index)
   */
  async search(
    tenantId: number,
    vector: number[],
    limit: number = 10,
    threshold?: number,
    useHybrid?: boolean
  ): Promise<SearchResult[]> {
    const name = this.collectionName(tenantId);
    const collection = this.collections.get(name);

    if (!collection) {
      return [];
    }

    // Simple cosine similarity mock (in real Qdrant, this uses HNSW index)
    const results: SearchResult[] = [];
    collection.forEach(point => {
      // Enforce tenant isolation - skip points from other tenants
      if (point.payload.tenant_id !== tenantId) {
        return;
      }

      // Mock similarity score (cosine similarity approximation)
      const score = this.cosineSimilarity(vector, point.vector);
      if (!threshold || score >= threshold) {
        results.push({
          id: point.id,
          score: score,
          payload: point.payload,
        });
      }
    });

    // Sort by score descending (most similar first)
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * BM25 lexical search simulation (simplified keyword matching)
   * In real Qdrant, this uses payload text indexing
   */
  async bm25Search(
    tenantId: number,
    query: string,
    limit: number = 10
  ): Promise<SearchResult[]> {
    const name = this.collectionName(tenantId);
    const collection = this.collections.get(name);

    if (!collection) {
      return [];
    }

    const queryTerms = query.toLowerCase().split(/\s+/);
    const results: SearchResult[] = [];

    collection.forEach(point => {
      if (point.payload.tenant_id !== tenantId) {
        return;
      }

      const content = point.payload.content.toLowerCase();
      const matchCount = queryTerms.filter(term => content.includes(term)).length;
      if (matchCount > 0) {
        // Simple TF-like score
        results.push({
          id: point.id,
          score: matchCount / queryTerms.length, // Normalized 0-1
          payload: point.payload,
        });
      }
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Reciprocal Rank Fusion (RRF) for combining semantic + lexical results
   */
  async hybridSearch(
    tenantId: number,
    vector: number[],
    query: string,
    k: number = 10,
    semanticWeight: number = 0.7,
    bm25Weight: number = 0.3
  ): Promise<SearchResult[]> {
    // Get results from both methods with larger candidate pool
    const semanticResults = await this.search(tenantId, vector, k * 2);
    const lexicalResults = await this.bm25Search(tenantId, query, k * 2);

    // RRF fusion
    const kConstant = 60;
    const scores = new Map<string, number>();

    semanticResults.forEach((result, rank) => {
      const current = scores.get(result.id) || 0;
      scores.set(result.id, current + semanticWeight * (1 / (kConstant + rank)));
    });

    lexicalResults.forEach((result, rank) => {
      const current = scores.get(result.id) || 0;
      scores.set(result.id, current + bm25Weight * (1 / (kConstant + rank)));
    });

    // Sort by fused score and return top-k
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, k)
      .map(([id]) => {
        // Find the original result (prefer semantic result as it has vector)
        return semanticResults.find(r => r.id === id) || lexicalResults.find(r => r.id === id);
      })
      .filter(Boolean) as SearchResult[];
  }

  /**
   * Delete all vectors for a tenant (used for cleanup)
   */
  async clearCollection(tenantId: number): Promise<void> {
    const name = this.collectionName(tenantId);
    this.collections.delete(name);
    console.log(`MockQdrant: Cleared collection ${name}`);
  }

  /**
   * Calculate cosine similarity between two vectors
   * Simulates Qdrant's HNSW similarity search
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get collection statistics (for debugging)
   */
  getCollectionStats(tenantId: number): any {
    const name = this.collectionName(tenantId);
    const collection = this.collections.get(name);
    if (!collection) {
      return { exists: false, pointCount: 0 };
    }
    return {
      exists: true,
      pointCount: collection.size,
      tenantId: tenantId,
    };
  }
}
