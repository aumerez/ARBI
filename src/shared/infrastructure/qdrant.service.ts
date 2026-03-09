import { Injectable, Logger } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { ConfigService } from '@nestjs/config';

interface SearchResult {
  id: string;
  score: number;
  payload: Record<string, any> | null;
}

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
      // Create collection with vector config
      await this.client.createCollection(collectionName, {
        vectors: {
          size: 3072,
          distance: 'Cosine',
          hnsw_config: {
            m: 32,
            ef_construct: 200,
          },
        },
      });
      this.logger.log(`Collection created: ${collectionName}`);

      // Create payload indexes for efficient filtering
      const fields = ['tenant_id', 'document_id', 'chunk_index', 'indexed_at'] as const;
      for (const field of fields) {
        try {
          await this.client.createPayloadIndex(collectionName, {
            field_name: field,
            field_schema: { type: 'keyword' }, // Use keyword for exact matches
            wait: true,
          });
          this.logger.debug(`Payload index created: ${collectionName}.${field}`);
        } catch (error) {
          this.logger.warn(`Failed to create payload index ${field} (may exist): ${error.message}`);
          // Continue - index may already exist
        }
      }
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

    const points = chunks.map((chunk, index) => ({
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
        wait: true,
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
          hnsw_ef: 256,
        },
      });

      return results.map(r => ({
        id: String(r.id),
        score: r.score,
        payload: r.payload ?? {},
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

  async upsertPoint(tenantId: number, pointId: number | string, vector: number[], payload: any): Promise<void> {
    const collectionName = this.collectionName(tenantId);
    try {
      await this.client.upsert(collectionName, {
        points: [{ id: pointId, vector, payload }],
        wait: true,
      });
      this.logger.debug(`Upserted point ${pointId} to ${collectionName}`);
    } catch (error) {
      this.logger.error(`Failed to upsert point ${pointId} to ${collectionName}`, error);
      throw error;
    }
  }

  private collectionName(tenantId: number): string {
    return `${this.collectionPrefix}${tenantId}`;
  }
}
