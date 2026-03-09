import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../shared/database/database.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { Chat } from './types/chat.entity';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly database: DatabaseService) {}

  async createChat(userId: number, tenantId: number, dto: CreateChatDto): Promise<ChatResponseDto> {
    const prisma = this.database.getPrismaClient();
    const chat = await prisma.chat.create({
      data: {
        user_id: userId,
        tenant_id: tenantId,
        title: dto.title,
      },
    });
    this.logger.log(`Chat created: id=${chat.id} user=${userId} tenant=${tenantId}`);
    return chat as ChatResponseDto;
  }

  async listChats(userId: number, tenantId: number): Promise<ChatResponseDto[]> {
    const prisma = this.database.getPrismaClient();
    const chats = await prisma.chat.findMany({
      where: { user_id: userId, tenant_id: tenantId },
      orderBy: { updated_at: 'desc' },
    });
    return chats as ChatResponseDto[];
  }

  async getChat(chatId: number, userId: number, tenantId: number): Promise<Chat> {
    const prisma = this.database.getPrismaClient();
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, user_id: userId, tenant_id: tenantId },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    return chat as Chat;
  }
}
