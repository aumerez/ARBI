import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../shared/database/database.module';
import { RedisModule } from '../shared/infrastructure/redis.module';
import { QdrantModule } from '../shared/infrastructure/qdrant.module';
import { ProviderModule } from '../shared/infrastructure/providers/provider.module';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { ChatModule } from '../chat/chat.module';
import { EncryptionService } from '../shared/infrastructure/encryption.service';
import { AuditLoggingService } from '../shared/services/audit-logging.service';
import { RateLimiterService } from '../shared/infrastructure/rate-limiter.service';
import { AuditMiddleware } from '../shared/middleware/audit.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    RedisModule,
    QdrantModule,
    ProviderModule,
    AuthModule,
    DocumentsModule,
    ChatModule,
  ],
  providers: [
    EncryptionService,
    AuditLoggingService,
    RateLimiterService,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuditMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.GET },
        { path: 'favicon.ico', method: RequestMethod.ALL }
      )
      .forRoutes('*');
  }
}
