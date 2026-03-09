import { Injectable, Logger } from '@nestjs/common';
import { QdrantService as SharedQdrantService } from '../../shared/infrastructure/qdrant.service';

export interface SearchResult {
  id: string;
  score: number;
  payload: Record<string, any>;
}

@Injectable()
export class QdrantService {
  private readonly logger = new Logger(QdrantService.name);

  constructor(
    private readonly sharedQdrantService: SharedQdrantService,
  ) {
    this.logger.log('Chat retrieval QdrantService initialized');
  }

  /**
   * Search for similar vectors in Qdrant with tenant isolation
   * @param collection - Collection name (typically 'document_chunks')
   * @param vector - Query embedding vector
   * @param limit - Maximum number of results
   * @param filters - Additional filters (must include tenant_id)
   * @returns Array of search results with id, score, and payload
   */
  async searchByVector(
    collection: string,
    vector: number[],
    limit: number = 10,
    filters: { tenant_id: number } & Record<string, any>
  ): Promise<SearchResult[]> {
    try {
      // Use the shared QdrantService's search method
      // Note: SharedQdrantService.search(tenantId, vector, limit, filter)
      const results = await this.sharedQdrantService.search(
        filters.tenant_id,
        vector,
        limit,
        filters
      );

      this.logger.debug(`Vector search returned ${results.length} results`);
      return results;
    } catch (error) {
      this.logger.error(`Vector search failed for tenant ${filters.tenant_id}`, error);
      throw error;
    }
  }
}
