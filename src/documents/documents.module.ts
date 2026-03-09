import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../shared/database/database.module';
import { RedisModule } from '../shared/infrastructure/redis.module';
import { QdrantModule } from '../shared/infrastructure/qdrant.module';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DocumentUploadWorker } from './jobs/document-upload.worker';
import { EmbeddingGenerationWorker } from './jobs/embedding-generation.worker';
import { RedisService } from '../shared/infrastructure/redis.service';
import { Queue } from 'bullmq';

@Global()
@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    QdrantModule,
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    // Provide document-upload queue
    {
      provide: 'DOCUMENT_UPLOAD_QUEUE',
      useFactory: (redisService: RedisService) => {
        const redis = redisService.getConnection();
        return new Queue('document-upload', {
          connection: redis as any,
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          },
        });
      },
      inject: [RedisService],
    },
    // Provide embedding-generation queue
    {
      provide: 'EMBEDDING_QUEUE',
      useFactory: (redisService: RedisService) => {
        const redis = redisService.getConnection();
        return new Queue('embedding-generation', {
          connection: redis as any,
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 3000 },
          },
        });
      },
      inject: [RedisService],
    },
    DocumentUploadWorker,
    EmbeddingGenerationWorker,
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
