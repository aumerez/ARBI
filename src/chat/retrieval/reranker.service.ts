import { Injectable, Logger } from '@nestjs/common';
import { ProviderFactory } from '../../shared/infrastructure/providers/provider.factory';
import { RetrievedChunk } from '../../shared/types/providers.interface';

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
