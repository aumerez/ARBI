---
phase: 01-backend-mvp
plan: 05a
type: execute
wave: 13
depends_on:
  - 02f
  - 03c
files_modified:
  - src/chat/chat.module.ts
  - src/chat/chat.controller.ts
  - src/chat/chat.service.ts
  - src/chat/dto/create-chat.dto.ts
  - src/chat/dto/chat-response.dto.ts
  - src/chat/types/chat.entity.ts
autonomous: true
requirements:
  - CHAT-01
user_setup: []
must_haves:
  truths:
    - "ChatModule imports ProviderModule, DatabaseModule, QdrantModule and exports ChatService"
    - "ChatController exposes POST /chats (create conversation) and GET /chats (list conversations)"
    - "ChatService.createChat(userId, tenantId, title?) creates Chat record with proper tenant/user linkage"
    - "ChatService.listChats(userId, tenantId) returns array of chats ordered by updated_at desc (latest first)"
    - "ChatService.getChat(chatId, userId, tenantId) validates ownership and returns Chat with messages"
    - "All queries enforce tenant_id filter and user_id filter (ownership)"
    - "Chat entity type includes id, title, userId, tenantId, created_at, updated_at"
  artifacts:
    - path: "src/chat/chat.module.ts"
      provides: "NestJS module for chat feature"
      min_lines: 20
    - path: "src/chat/chat.controller.ts"
      provides: "Controller with create and list endpoints"
      min_lines: 40
    - path: "src/chat/chat.service.ts"
      provides: "Business logic for chat CRUD"
      min_lines: 50
    - path: "src/chat/dto/create-chat.dto.ts"
      provides: "DTO for creating chat (title optional)"
      min_lines: 5
    - path: "src/chat/dto/chat-response.dto.ts"
      provides: "Response DTO with chat metadata"
      min_lines: 10
    - path: "src/chat/types/chat.entity.ts"
      provides: "TypeScript interface for Chat"
      min_lines: 10
  key_links:
    - from: "ChatController"
      to: "ChatService"
      via: "constructor(private readonly chatService: ChatService)"
      pattern: "chatService"
    - from: "ChatService.createChat"
      to: "prisma.chat"
      via: "prisma.chat.create"
      pattern: "prisma\\.chat\\.create"
    - from: "ChatService.listChats"
      to: "prisma.chat.findMany"
      pattern: "prisma\\.chat\\.findMany"
    - from: "ChatController"
      to: "JwtAuthGuard, TenantGuard"
      via: "@UseGuards(JwtAuthGuard, TenantGuard)"
      pattern: "UseGuards.*JwtAuthGuard.*TenantGuard"

---

<objective>
Implement chat conversation management (create, list)

Purpose: Provide endpoints for users to create new chat conversations and list their existing conversations with basic metadata. Establish the chat module foundation for later message handling.

Output: ChatModule, controller, service, DTOs, and entity types

</objective>

<execution_context>
@/Users/franciscoegloff/projects/metacortex/ops-ai-platform/.planning/workflows/execute-plan.md
@/Users/franciscoegloff/projects/metacortex/ops-ai-platform/.planning/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/01-backend-mvp/01-CONTEXT.md
@.planning/phases/01-backend-mvp/01-RESEARCH.md

# Chat domain:
- Chat (conversation): id, user_id, tenant_id, title?, created_at, updated_at
- ChatMessage (later): id, chat_id, role, content, citations, retrieved_chunk_ids, created_at
- For Phase 1 MVP, we need to create conversations and later (05g) will handle messages.

# Requirements for CHAT-01:
- User can open chat interface: implies they can create a new conversation and see list of past ones.
- That's covered by:
  - POST /chats creates new conversation (title optional, maybe auto-generated from first message later)
  - GET /chats lists conversations for user (previews later phases)
  - GET /chats/:id gets a specific conversation (to load messages)

These operations must enforce tenant isolation.

# Module imports:
-DatabaseModule (Prisma)
- ProviderModule (optional; not needed yet)
- QdrantModule (maybe not needed for conversation CRUD, but chat later uses Qdrant for retrieval; we can import anyway)

# Service methods:
- createChat(userId, tenantId, title?): Promise<Chat>
- listChats(userId, tenantId): Promise<Chat[]>
- getChat(chatId, userId, tenantId): Promise<Chat | null>

All filter by tenant_id and user_id.

# Controller:
- POST /chats -> createChat (body: { title? })
- GET /chats -> listChats (query: page?, limit? optional)
- GET /chats/:id -> getChat

Apply guards: JwtAuthGuard + TenantGuard.

# Error handling:
- If chat not found or not owned, throw NotFoundException.

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create DTOs and entity type</name>
  <files>
    src/chat/dto/create-chat.dto.ts
    src/chat/dto/chat-response.dto.ts
    src/chat/types/chat.entity.ts
  </files>
  <action>
    **create-chat.dto.ts:**
    ```typescript
    import { IsString, IsOptional, MaxLength } from 'class-validator';

    export class CreateChatDto {
      @IsOptional()
      @IsString()
      @MaxLength(200)
      title?: string;
    }
    ```

    **chat-response.dto.ts:**
    ```typescript
    import { IsInt, IsString, IsOptional, IsDateString } from 'class-validator';

    export class ChatResponseDto {
      @IsInt()
      id: number;

      @IsOptional()
      @IsString()
      title?: string;

      @IsInt()
      user_id: number;

      @IsInt()
      tenant_id: number;

      @IsDateString()
      created_at: Date;

      @IsDateString()
      updated_at: Date;
    }
    ```

    **chat.entity.ts:**
    ```typescript
    export interface Chat {
      id: number;
      user_id: number;
      tenant_id: number;
      title?: string;
      created_at: Date;
      updated_at: Date;
    }
    ```

    Verify: DTOs compile with class-validator decorators.
  </action>
  <verify>
    <automated>
      npx tsc --noEmit src/chat/dto/create-chat.dto.ts &&
      npx tsc --noEmit src/chat/dto/chat-response.dto.ts &&
      npx tsc --noEmit src/chat/types/chat.entity.ts &&
      echo "Chat DTOs and entity type created"
    </automated>
  </verify>
  <done>Chat DTOs and entity type defined</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement ChatService and ChatController with module</name>
  <files>
    src/chat/chat.service.ts
    src/chat/chat.controller.ts
    src/chat/chat.module.ts
  </files>
  <action>
    **chat.service.ts:**
    ```typescript
    import { Injectable, Logger, NotFoundException } from '@nestjs/common';
    import { PrismaService } from '../shared/database/database.service';
    import { CreateChatDto } from './dto/create-chat.dto';
    import { ChatResponseDto } from './dto/chat-response.dto';
    import { Chat } from './types/chat.entity';

    @Injectable()
    export class ChatService {
      private readonly logger = new Logger(ChatService.name);

      constructor(private readonly prisma: PrismaService) {}

      async createChat(userId: number, tenantId: number, dto: CreateChatDto): Promise<ChatResponseDto> {
        const chat = await this.prisma.chat.create({
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
        const chats = await this.prisma.chat.findMany({
          where: { user_id: userId, tenant_id: tenantId },
          orderBy: { updated_at: 'desc' },
        });
        return chats as ChatResponseDto[];
      }

      async getChat(chatId: number, userId: number, tenantId: number): Promise<Chat> {
        const chat = await this.prisma.chat.findFirst({
          where: { id: chatId, user_id: userId, tenant_id: tenantId },
        });

        if (!chat) {
          throw new NotFoundException('Chat not found');
        }

        return chat as Chat;
      }
    }
    ```

    **chat.controller.ts:**
    ```typescript
    import { Controller, Get, Post, Param, Body, UseGuards, Req, Query } from '@nestjs/common';
    import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
    import { TenantGuard } from '../shared/guards/tenant.guard';
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
    ```

    **chat.module.ts:**
    ```typescript
    import { Module } from '@nestjs/common';
    import { DatabaseModule } from '../shared/database/database.module';
    import { ChatService } from './chat.service';
    import { ChatController } from './chat.controller';

    @Module({
      imports: [DatabaseModule],
      controllers: [ChatController],
      providers: [ChatService],
      exports: [ChatService],
    })
    export class ChatModule {}
    ```

    Ensure TenantGuard's path matches project structure; adjust if needed.

    Verify: All files compile; module imports DatabaseModule and provides ChatService, ChatController.
  </action>
  <verify>
    <automated>
      grep -q "ChatService" src/chat/chat.module.ts &&
      grep -q "ChatController" src/chat/chat.module.ts &&
      grep -q "@Controller('chats')" src/chat/chat.controller.ts &&
      grep -q "createChat" src/chat/chat.service.ts &&
      grep -q "listChats" src/chat/chat.service.ts &&
      echo "Chat service and controller implemented"
    </automated>
  </verify>
  <done>ChatService and ChatController with create/list/get endpoints ready</done>
</task>

</tasks>

<verification>
Wave 4a - Chat conversation management complete

**Automated checks:**
1. ChatModule exists, imports DatabaseModule, exports ChatService
2. ChatController with routes: POST /chats, GET /chats, GET /chats/:id
3. Controller applies JwtAuthGuard and TenantGuard
4. Service methods implement createChat, listChats, getChat with tenant/user filtering
5. All DTOs and entity types created
6. TypeScript compiles

**Requirements coverage:**
- CHAT-01: User can create and list conversations ✓

**Dependencies:**
- DatabaseModule (02c) for Prisma access
- JwtAuthGuard and TenantGuard from AuthModule (03c)

**Next:** 05b (Hybrid search) will build on chat/channel but may be independent of controller.

</verification>

<success_criteria>
Chat conversation CRUD ready when:
- [ ] ChatModule created with DatabaseModule import
- [ ] ChatService methods: createChat(userId, tenantId, dto), listChats(userId, tenantId), getChat(chatId, userId, tenantId)
- [ ] All queries filter by user_id and tenant_id
- [ ] ChatController with three endpoints; guards applied
- [ ] DTOs with validation
- [ ] `npx tsc --noEmit` passes

**Deliverable:** Foundation for chat conversations.

**Output:** `.planning/phases/01-backend-mvp/01-backend-mvp-05a-PLAN-05a-summary.md`

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-05a-PLAN-05a-summary.md`
