import { Controller, Get, Post, Param, Body, UseGuards, Req, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { Chat } from './types/chat.entity';

@Controller('chats')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async create(@Body() dto: CreateChatDto, @Req() req: any): Promise<ChatResponseDto> {
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;
    return this.chatService.createChat(userId, tenantId, dto);
  }

  @Get()
  async list(@Req() req: any): Promise<ChatResponseDto[]> {
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;
    return this.chatService.listChats(userId, tenantId);
  }

  @Get(':id')
  async get(@Param('id') id: string, @Req() req: any): Promise<Chat> {
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;
    return this.chatService.getChat(parseInt(id, 10), userId, tenantId);
  }
}
