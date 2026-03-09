import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { QdrantService } from './qdrant.service';
import { ProviderFactory } from '../../shared/infrastructure/providers/provider.factory';
import { DatabaseService } from '../../shared/database/database.service';

export interface SearchResult {
  chunkId: number;
  documentId: number;
  documentName: string;
  pageNumber: number;
  content: string;
  score: number;
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

    // Step 2: Vector search
    const vectorResults = await this.qdrantService.searchByVector(
      'document_chunks',
      queryEmbedding,
      topK * this.topKExtension,
      { tenant_id: tenantId }
    );

    // Step 3: BM25 search
    const bm25Results = await this.bm25Search(query, tenantId, topK * this.topKExtension);

    // Step 4: RRF fusion
    const fusedResults = await this.rerankWithRRF(vectorResults, bm25Results, tenantId);

    // Step 5: Return topK
    return fusedResults.slice(0, topK);
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
    denseResults: Array<{ id: string; score: number; payload: any }> = [],
    sparseResults: Array<{ chunk_id: number; document_id: number; content: string; page_number?: number; score: number }> = [],
    tenantId: number
  ): Promise<SearchResult[]> {
    this.logger.debug(`RRF: dense=${denseResults.length}, sparse=${sparseResults.length}`);

    const denseRankMap = new Map<number, number>();
    const sparseRankMap = new Map<number, number>();

    denseResults.forEach((result, index) => {
      const chunkId = result.payload?.chunk_id ? Number(result.payload.chunk_id) : Number(result.id.split(':')[1]);
      if (chunkId && !isNaN(chunkId)) {
        denseRankMap.set(chunkId, index + 1);
      }
    });

    sparseResults.forEach((result, index) => {
      sparseRankMap.set(result.chunk_id, index + 1);
    });

    const allChunkIds = new Set<number>([
      ...Array.from(denseRankMap.keys()),
      ...Array.from(sparseRankMap.keys()),
    ]);

    const scoredResults: Array<SearchResult & { rrfScore: number }> = [];

    allChunkIds.forEach(chunkId => {
      const denseRank = denseRankMap.get(chunkId);
      const sparseRank = sparseRankMap.get(chunkId);

      const denseScore = denseRank ? SEMANTIC_WEIGHT / (denseRank + RRF_K) : 0;
      const sparseScore = sparseRank ? LEXICAL_WEIGHT / (sparseRank + RRF_K) : 0;
      const rrfScore = denseScore + sparseScore;

      scoredResults.push({
        chunkId,
        documentId: 0,
        documentName: '',
        pageNumber: 0,
        content: '',
        score: rrfScore,
        rrfScore,
      });
    });

    scoredResults.sort((a, b) => b.rrfScore - a.rrfScore);

    await this.populateDocumentMetadata(scoredResults, tenantId);

    return scoredResults
      .filter(r => r.content)
      .map(({ rrfScore, ...rest }) => ({ ...rest, score: rrfScore }))
      .sort((a, b) => b.score - a.score);
  }

  private async populateDocumentMetadata(
    results: Array<SearchResult & { rrfScore: number }>,
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
