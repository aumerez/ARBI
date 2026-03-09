import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { DatabaseService } from '../../shared/database/database.service';
import { QdrantService } from '../../shared/infrastructure/qdrant.service';
import { OpenAIEmbeddingProvider } from '../../shared/infrastructure/providers/openai-embedding.provider';

export class EmbeddingGenerationWorker extends Worker {
  constructor(
    database: DatabaseService,
    qdrant: QdrantService,
    openai: OpenAIEmbeddingProvider,
    redis: Redis,
  ) {
    const databaseRef = database;
    const qdrantRef = qdrant;
    const openaiRef = openai;

    const processor = async (job: Job) => {
      const { chunkId } = job.data;
      const prisma = databaseRef.getPrismaClient();

      try {
        // Load chunk
        const chunk = await prisma.documentChunk.findUnique({
          where: { id: chunkId },
        });

        if (!chunk) {
          throw new Error(`Chunk ${chunkId} not found`);
        }

        // Generate embedding
        const embeddings = await openaiRef.generateEmbeddings([chunk.content]);
        const embedding = embeddings[0];

        // Upsert to Qdrant via service using upsertPoint
        await qdrantRef.upsertPoint(
          chunk.tenant_id,
          chunkId,
          embedding,
          {
            chunk_id: chunkId,
            document_id: chunk.document_id,
            tenant_id: chunk.tenant_id,
            content: chunk.content,
          }
        );

        job.updateProgress(100);
      } catch (error: any) {
        // Log error; could retry
        console.error(`Embedding generation failed for chunk ${chunkId}:`, error);
        throw error;
      }
    };

    super('embedding-generation', processor, {
      connection: redis as any,
      concurrency: 4,
    });
  }
}
