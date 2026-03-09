import { Module } from '@nestjs/common';
import { DatabaseModule } from '../shared/database/database.module';
import { ProviderModule } from '../shared/infrastructure/providers/provider.module';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { StreamingService } from './generation/streaming.service';

@Module({
  imports: [DatabaseModule, ProviderModule],
  controllers: [ChatController],
  providers: [ChatService, StreamingService],
  exports: [ChatService, StreamingService],
})
export class ChatModule {}
