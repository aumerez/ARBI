import { Module } from '@nestjs/common';
import { DatabaseModule } from '../shared/database/database.module';
import { ProviderModule } from '../shared/infrastructure/providers/provider.module';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { StreamingService } from './generation/streaming.service';
import { CitationValidatorService } from './validation/citation-validator.service';

@Module({
  imports: [DatabaseModule, ProviderModule],
  controllers: [ChatController],
  providers: [ChatService, StreamingService, CitationValidatorService],
  exports: [ChatService, StreamingService, CitationValidatorService],
})
export class ChatModule {}
