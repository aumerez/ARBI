import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../shared/database/database.module';
import { RedisModule } from '../shared/infrastructure/redis.module';
import { QdrantModule } from '../shared/infrastructure/qdrant.module';
import { ProviderModule } from '../shared/infrastructure/providers/provider.module';

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
    // Feature modules will be added here in later waves
  ],
})
export class AppModule {}
