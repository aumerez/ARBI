import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { QdrantService } from './qdrant.service';
import { ProviderFactory } from '../../shared/infrastructure/providers/provider.factory';
import { DatabaseService } from '../../shared/database/database.service';
import { RerankerService } from './reranker.service';
import { RetrievedChunk } from '../../shared/types/providers.interface';

export interface SearchResult {
  chunkId: number; // Database chunk ID
  documentId: number;
  documentName: string;
  pageNumber: number;
  content: string;
  score: number;
  embedding?: number[];
}

const RRF_K = 60;
const SEMANTIC_WEIGHT = 0.7;
const LEXICAL_WEIGHT = 0.3;

@Injectable()
export class HybridSearchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HybridSearchService.name);
  private readonly topKExtension = 2;

  constructor(
    private readonly qdrantService: QdrantService,
    private readonly providerFactory: ProviderFactory,
    private readonly databaseService: DatabaseService,
    private readonly reranker: RerankerService,
  ) {}

  onModuleInit() {
    this.logger.log('HybridSearchService initialized');
  }

  onModuleDestroy() {
    this.logger.log('HybridSearchService destroyed');
  }

  async search(
    query: string,
    tenantId: number,
    topK: number = 10,
  ): Promise<SearchResult[]> {
    this.logger.log(`Hybrid search: query="${query}", tenantId=${tenantId}, topK=${topK}`);

    // Step 1: Generate query embedding
    const embeddingProvider = this.providerFactory.getEmbeddingProvider();
    const embeddings = await embeddingProvider.generateEmbeddings([query]);
    const queryEmbedding = embeddings[0];

    // Step 2: Vector search with vectors returned (for reranker)
    const vectorResults = await this.qdrantService.searchByVector(
      'document_chunks',
      queryEmbedding,
      topK * this.topKExtension,
      { tenant_id: tenantId },
      true // withVector: true
    );

    // Step 3: BM25 search
    const bm25Results = await this.bm25Search(query, tenantId, topK * this.topKExtension);

    // Step 4: RRF fusion
    const fusedResults = await this.rerankWithRRF(vectorResults, bm25Results, tenantId);

    // Step 5: Ensure all fused chunks have embeddings needed for reranking
    // Vector results already have embeddings in the payload.vector
    // BM25 results may not - we need to fetch them from Qdrant
    const chunksNeedingEmbeddings = fusedResults.filter(r => !r.embedding);
    if (chunksNeedingEmbeddings.length > 0) {
      const pointIds = chunksNeedingEmbeddings.map(r => r.chunkId);
      try {
        const points = await this.qdrantService.getPoints(tenantId, pointIds);
        const embeddingMap = new Map<number, number[]>();
        points.forEach(p => {
          if (p.vector) {
            const pointChunkId = Number(p.id.split(':')[1]); // Extract chunk index from "docId:chunkIdx"
            embeddingMap.set(pointChunkId, p.vector);
          }
        });
        // Attach embeddings to chunks
        fusedResults.forEach(r => {
          if (!r.embedding && embeddingMap.has(r.chunkId)) {
            r.embedding = embeddingMap.get(r.chunkId);
          }
        });
      } catch (error) {
        this.logger.warn(`Failed to fetch missing embeddings for ${chunksNeedingEmbeddings.length} chunks`, error);
      }
    }

    // Step 6: Convert SearchResult[] to RetrievedChunk[] for reranker
    const retrievedChunks: RetrievedChunk[] = fusedResults.map(r => ({
      id: String(r.chunkId),
      content: r.content,
      documentName: r.documentName,
      pageNumber: r.pageNumber,
      score: r.score,
      embedding: r.embedding,
    }));

    // Step 7: Rerank using RerankerService to get final topK
    const reranked = await this.reranker.rerank(retrievedChunks, query, topK);

    // Step 8: Resolve reranked chunk IDs back to SearchResult objects with full metadata
    const rerankedChunkIds = new Set(reranked.map(c => parseInt(c.id)));
    const finalResults: SearchResult[] = fusedResults
      .filter(r => rerankedChunkIds.has(r.chunkId))
      .sort((a, b) => {
        const aIdx = reranked.findIndex(c => c.id === String(a.chunkId));
        const bIdx = reranked.findIndex(c => c.id === String(b.chunkId));
        return aIdx - bIdx; // Maintain reranker order
      });

    // Ensure all required SearchResult fields are present (some may be undefined if not populated)
    return finalResults.map(r => ({
      chunkId: r.chunkId,
      documentId: r.documentId!,
      documentName: r.documentName!,
      pageNumber: r.pageNumber!,
      content: r.content!,
      score: r.score,
      embedding: r.embedding,
    }));
  }

  private async bm25Search(
    query: string,
    tenantId: number,
    limit: number
  ): Promise<Array<{ chunk_id: number; document_id: number; content: string; page_number?: number; score: number }>> {
    const prisma = this.databaseService.getPrismaClient();

    // Use parameterized query for security
    const sql = `
      SELECT
        dc.id as chunk_id,
        dc.document_id,
        dc.content,
        dc."pageNumber" as page_number,
        ts_rank(dc.content_tsv, plainto_tsquery('english', $1)) as score
      FROM "DocumentChunk" dc
      WHERE dc.tenant_id = $2
        AND dc.content_tsv @@ plainto_tsquery('english', $1)
      ORDER BY score DESC
      LIMIT $3
    `;

    try {
      const results = await prisma.$queryRawUnsafe(sql, query, tenantId, limit);
      return results as any[];
    } catch (error) {
      this.logger.error(`BM25 search failed for tenant ${tenantId}`, error);
      throw error;
    }
  }

  private async rerankWithRRF(
    denseResults: Array<{ id: string; score: number; payload: any; vector?: number[] }> = [],
    sparseResults: Array<{ chunk_id: number; document_id: number; content: string; page_number?: number; score: number }> = [],
    tenantId: number
  ): Promise<SearchResult[]> {
    this.logger.debug(`RRF: dense=${denseResults.length}, sparse=${sparseResults.length}`);

    const denseRankMap = new Map<number, { rank: number; embedding?: number[] }>();
    const sparseRankMap = new Map<number, number>();

    denseResults.forEach((result, index) => {
      const chunkId = result.payload?.chunk_id ? Number(result.payload.chunk_id) : Number(result.id.split(':')[1]);
      if (chunkId && !isNaN(chunkId)) {
        denseRankMap.set(chunkId, { rank: index + 1, embedding: result.vector });
      }
    });

    sparseResults.forEach((result, index) => {
      sparseRankMap.set(result.chunk_id, index + 1);
    });

    const allChunkIds = new Set<number>([
      ...Array.from(denseRankMap.keys()),
      ...Array.from(sparseRankMap.keys()),
    ]);

    const scoredResults: SearchResult[] = Array.from(allChunkIds).map(chunkId => {
      const denseData = denseRankMap.get(chunkId);
      const sparseRank = sparseRankMap.get(chunkId);

      const denseScore = denseData ? SEMANTIC_WEIGHT / (denseData.rank + RRF_K) : 0;
      const sparseScore = sparseRank ? LEXICAL_WEIGHT / (sparseRank + RRF_K) : 0;
      const rrfScore = denseScore + sparseScore;

      return {
        chunkId,
        documentId: 0,
        documentName: '',
        pageNumber: 0,
        content: '',
        score: rrfScore,
        embedding: denseData?.embedding,
      };
    });

    scoredResults.sort((a, b) => b.score - a.score);

    await this.populateDocumentMetadata(scoredResults, tenantId);

    return scoredResults.filter(r => r.content);
  }

  private async populateDocumentMetadata(
    results: SearchResult[],
    tenantId: number
  ): Promise<void> {
    const prisma = this.databaseService.getPrismaClient();

    const chunkIds = results.map(r => r.chunkId).filter(id => id > 0);
    if (chunkIds.length === 0) return;

    try {
      const chunks = await prisma.documentChunk.findMany({
        where: {
          id: { in: chunkIds },
          tenant_id: tenantId,
        },
        include: {
          document: {
            select: {
              id: true,
              filename: true,
            },
          },
        },
      });

      const chunkMap = new Map<number, typeof chunks[0]>();
      chunks.forEach(chunk => chunkMap.set(chunk.id, chunk));

      results.forEach(result => {
        const chunkData = chunkMap.get(result.chunkId);
        if (chunkData) {
          result.documentId = chunkData.document_id;
          result.documentName = chunkData.document.filename;
          result.content = chunkData.content;
          result.pageNumber = chunkData.chunk_index;
        }
      });
    } catch (error) {
      this.logger.error('Failed to populate document metadata', error);
    }
  }
}
