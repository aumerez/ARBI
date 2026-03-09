import { Controller, Get, Post, Delete, Param, Query, UseGuards, UseInterceptors, UploadedFile, Req, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { DocumentsService } from './documents.service';
import { DocumentResponseDto } from './dto/document-response.dto';
import { DocumentStatusResponseDto } from './dto/document-status.dto';
import { StatusQueryDto } from './dto/status-query.dto';
import { Request } from 'express';
import { JwtPayload } from '../auth/types/jwt-payload.interface';

@Controller('documents')
@UseGuards(JwtAuthGuard, TenantGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  }))
  async upload(@UploadedFile() file: any, @Req() req: Request): Promise<DocumentResponseDto> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Extract user info from request (set by JwtAuthGuard and TenantGuard)
    const user = req.user as JwtPayload;
    const userId = user.sub;
    const tenantId = user.tenant_id;

    return this.documentsService.uploadFile(userId, tenantId, file);
  }

  @Get(':id/status')
  async getStatus(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<DocumentStatusResponseDto> {
    const user = req.user as JwtPayload;
    const userId = user.sub;
    const tenantId = user.tenant_id;

    const result = await this.documentsService.getDocumentStatus(parseInt(id, 10), userId, tenantId);
    return {
      documentId: parseInt(id, 10),
      status: result.status,
      error_message: result.error_message,
    };
  }

  @Get()
  async list(
    @Query() query: StatusQueryDto,
    @Req() req: Request,
  ): Promise<DocumentResponseDto[]> {
    const user = req.user as JwtPayload;
    const userId = user.sub;
    const tenantId = user.tenant_id;
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    return this.documentsService.listDocuments(userId, tenantId, { take: limit, skip });
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: Request): Promise<void> {
    const user = req.user as JwtPayload;
    const userId = user.sub;
    const tenantId = user.tenant_id;

    return this.documentsService.deleteDocument(parseInt(id, 10), userId, tenantId);
  }
}
