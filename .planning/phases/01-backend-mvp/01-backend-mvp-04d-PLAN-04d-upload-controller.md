---
phase: 01-backend-mvp
plan: 04d
type: execute
wave: 16
depends_on:
  - 04c
files_modified:
  - src/documents/documents.controller.ts
  - src/documents/dto/upload.dto.ts
  - src/documents/dto/status-query.dto.ts
autonomous: true
requirements:
  - DOC-01
  - DOC-03
  - DOC-05
user_setup: []
must_haves:
  truths:
    - "POST /documents/upload endpoint accepts multipart/form-data with file, requires authentication (JWT guard + tenant guard)"
    - "Controller validates file (size, mimetype) and user payload (if any)"
    - "Upload returns 201 with DocumentResponseDto (id, filename, status, etc.) immediately after queueing"
    - "GET /documents/:id/status returns DocumentStatusResponseDto with current status and error_message if failed"
    - "GET /documents returns paginated list of user's documents (scoped by tenant and user)"
    - "DELETE /documents/:id deletes document (calls service delete) and returns 204"
    - "All endpoints enforce tenant isolation via guards (JwtAuthGuard + TenantGuard)"
  artifacts:
    - path: "src/documents/documents.controller.ts"
      provides: "NestJS controller with upload, status, list, delete endpoints"
      min_lines: 80
    - path: "src/documents/dto/upload.dto.ts"
      provides: "Upload request DTO (file field only)"
      min_lines: 5
    - path: "src/documents/dto/status-query.dto.ts"
      provides: "Query params DTO for pagination"
      min_lines: 10
  key_links:
    - from: "src/documents/documents.controller.ts"
      to: "src/documents/documents.service.ts"
      via: "constructor(private readonly documentsService: DocumentsService)"
      pattern: "documentsService"
    - from: "POST /documents/upload"
      to: "DocumentsService.uploadFile"
      via: "await this.documentsService.uploadFile(userId, tenantId, file)"
      pattern: "uploadFile"
    - from: "GET /documents/:id/status"
      to: "DocumentsService.getDocumentStatus"
      pattern: "getDocumentStatus"
    - from: "JwtAuthGuard, TenantGuard"
      to: "all endpoints"
      via: "@UseGuards(JwtAuthGuard, TenantGuard)"
      pattern: "UseGuards.*JwtAuthGuard.*TenantGuard"
    - from: "FileInterceptor('file')"
      to: "upload endpoint"
      via: "multer file validation before service call"
      pattern: "FileInterceptor"

---

<objective>
Create DocumentsController with RESTful endpoints for document management

Purpose: Expose HTTP API for document upload, status polling, listing, and deletion. Apply authentication and tenant guards. Use Multer for multipart file handling.

Output: Fully wired NestJS controller with file upload handling

</objective>

<execution_context>
@/Users/franciscoegloff/projects/metacortex/ops-ai-platform/.planning/workflows/execute-plan.md
@/Users/franciscoegloff/projects/metacortex/ops-ai-platform/.planning/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/01-backend-mvp/01-CONTEXT.md
@.planning/phases/01-backend-mvp/01-RESEARCH.md

# Controller design (NestJS):
- Use @Controller('documents')
- Endpoints:
  - POST /upload → uploadFile(file, user from JWT, tenant from guard)
  - GET /:id/status → getDocumentStatus(id, user, tenant)
  - GET / → listDocuments(user, tenant, query params: page?, limit?)
  - DELETE /:id → deleteDocument(id, user, tenant)

# Guards:
- JwtAuthGuard: validates JWT, attaches user payload to request.user
- TenantGuard: extracts tenant_id from JWT payload (req.user.tenant_id) and attaches to request.tenant (or use custom decorator)
- Apply both to all routes

# File upload:
- Use Multer with memory storage (since we write to disk ourselves in service)
- @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
- Additional mimetype validation in service

# DTOs:
- UploadDto: not needed if only file field; Multer gives file as argument
- StatusQueryDto: for pagination (take, skip)
- Use class-validator on query DTO

# Responses:
- POST /upload → 201 Created with DocumentResponseDto
- GET /:id/status → 200 OK with DocumentStatusResponseDto
- GET / → 200 OK with { data: DocumentResponseDto[], total: number, page, pages }
- DELETE /:id → 204 No Content

# Error handling:
- Let service throw exceptions; NestJS exception filters (global) handle them
- For file validation, if Multer intercepts size limit, returns 413; that's acceptable
- For unsupported mimetype, service throws 400

# Imports:
- Controller, Get, Post, Delete, Param, Query, UseGuards, UseInterceptors from @nestjs/common
- JwtAuthGuard from auth/guards (to be created in 03)
- TenantGuard from shared/guards or middleware (need to decide implementation - likely from 03b or 02c). We'll assume TenantGuard exists with @UseGuards(TenantGuard). If not, we may need to create or use global middleware. But guard simpler. In revision context they have TenantGuard in 02c? Actually 02c is DatabaseService; 03b is auth strategies. TenantGuard likely created in 03b alongside JwtAuthGuard. Since 04d depends on 03c and 03c completes auth, we expect guards to exist. We'll reference them as if available.

# File structure:
- src/documents/documents.controller.ts
- src/documents/dto/upload.dto.ts (empty? Actually we don't need DTO for body if only file. But for consistency we can define)
- src/documents/dto/status-query.dto.ts

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create DTOs and controller</name>
  <files>
    src/documents/dto/upload.dto.ts
    src/documents/dto/status-query.dto.ts
    src/documents/documents.controller.ts
  </files>
  <action>
    **upload.dto.ts:** (Optional, but we can define for validation of any additional fields)
    ```typescript
    export class UploadDto {}
    ```

    **status-query.dto.ts:**
    ```typescript
    import { IsInt, IsOptional, Min, Max } from 'class-validator';

    export class StatusQueryDto {
      @IsOptional()
      @IsInt()
      @Min(1)
      page?: number = 1;

      @IsOptional()
      @IsInt()
      @Min(1)
      @Max(100)
      limit?: number = 20;
    }
    ```

    **documents.controller.ts:**
    ```typescript
    import { Controller, Get, Post, Delete, Param, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
    import { FileInterceptor } from '@nestjs/platform-express';
    import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
    import { TenantGuard } from '../shared/guards/tenant.guard'; // adjust path
    import { DocumentsService } from './documents.service';
    import { DocumentResponseDto } from './dto/document-response.dto';
    import { DocumentStatusResponseDto } from './dto/document-status.dto';
    import { StatusQueryDto } from './dto/status-query.dto';

    @Controller('documents')
    @UseGuards(JwtAuthGuard, TenantGuard)
    export class DocumentsController {
      constructor(private readonly documentsService: DocumentsService) {}

      @Post('upload')
      @UseInterceptors(FileInterceptor('file', {
        limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
      }))
      async upload(@UploadedFile() file: Express.Multer.File): Promise<DocumentResponseDto> {
        if (!file) {
          throw new BadRequestException('File is required');
        }

        // userId and tenantId from guards (attached to request)
        // Assuming guards set req.user and req.tenant
        // But typical: JwtAuthGuard sets req.user; TenantGuard sets req.tenant_id
        // We'll need to get them from request context; Service may need them injected? Better: controller passes them from request.
        // Option: Use custom decorators: @CurrentUser(), @CurrentTenant().
        // Simpler: Have service method expect userId, tenantId as args, and we extract from request viaExecutionContext.
        // Unfortunately, guard data is on request object. We can access via request (ctx.switchToHttp().getRequest()).
        // But cleaner: inject a TenantAwareService or use a helper.

        // Given we are planning, we'll assume we can get them from request in controller method.
        // Actually, with guards, request.user is set by JwtAuthGuard, and TenantGuard may attach tenant_id to request.user or request.tenant.
        // Let's assume JwtAuthGuard attaches { userId, tenantId } to request.user.
        // Or we could have TenantGuard set request.tenant = { id: number }.
        // We'll need to check 03b to see how tenant_id is propagated. But for plan we can abstract:
        // The controller method can have signatures like:
        // async upload(@UploadedFile() file: Express.Multer.File, @Req() req: Request): Promise<DocumentResponseDto>
        // and then extract: const userId = req.user['userId']; const tenantId = req.user['tenantId'];
        // Because JWT payload contains sub and tenant_id. So request.user should have those.

        // We'll use @Req() to get request. But we don't need to specify in plan details exactly; just illustrate.

        // To avoid overcomplicating, we'll assume service will be called with user ID and tenant ID derived from request.user.
        const userId = (req as any).user.userId;
        const tenantId = (req as any).user.tenantId;

        return this.documentsService.uploadFile(userId, tenantId, file);
      }

      @Get(':id/status')
      async getStatus(
        @Param('id') id: string,
        @Req() req: any,
      ): Promise<DocumentStatusResponseDto> {
        const userId = req.user.userId;
        const tenantId = req.user.tenantId;
        return this.documentsService.getDocumentStatus(parseInt(id, 10), userId, tenantId);
      }

      @Get()
      async list(
        @Query() query: StatusQueryDto,
        @Req() req: any,
      ): Promise<{ data: DocumentResponseDto[]; total: number }> {
        const userId = req.user.userId;
        const tenantId = req.user.tenantId;
        const { page = 1, limit = 20 } = query;
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
          this.documentsService.listDocuments(userId, tenantId, { take: limit, skip }),
          this.prisma.document.count({
            where: { user_id: userId, tenant_id: tenantId },
          }),
        ]);

        return { data, total };
      }

      @Delete(':id')
      async delete(@Param('id') id: string, @Req() req: any): Promise<void> {
        const userId = req.user.userId;
        const tenantId = req.user.tenantId;
        return this.documentsService.deleteDocument(parseInt(id, 10), userId, tenantId);
      }
    }
    ```

    Note: Need to import Request from 'express' and PrismaService in controller? Actually we need total count; we could have service method return total or another method. Simpler: service.listDocuments returns array; we could also have service.countDocuments(userId, tenantId). Or we can just return array without total. For MVP, pagination total not critical; can omit total. Simpler: listDocuments returns array. Keep it simple.

    Revised: list endpoint returns just array. No need for total count.

    So adjust:
    ```typescript
    @Get()
    async list(@Query() query: StatusQueryDto, @Req() req: any): Promise<DocumentResponseDto[]> {
      const userId = req.user.userId;
      const tenantId = req.user.tenantId;
      const { page = 1, limit = 20 } = query;
      const skip = (page - 1) * limit;
      return this.documentsService.listDocuments(userId, tenantId, { take: limit, skip });
    }
    ```

    Controller should also inject PrismaService if we want count? Not needed if we simplify.

    We'll keep it simple.

    Verify: Controller compiles, routes defined, guards applied.
  </action>
  <verify>
    <automated>
      grep -q "@Controller('documents')" src/documents/documents.controller.ts &&
      grep -q "upload(" src/documents/documents.controller.ts &&
      grep -q "list(" src/documents/documents.controller.ts &&
      grep -q "delete(" src/documents/documents.controller.ts &&
      grep -q "UseGuards(JwtAuthGuard, TenantGuard)" src/documents/documents.controller.ts &&
      echo "DocumentsController structure correct"
    </automated>
  </verify>
  <done>DocumentsController with upload, status, list, delete endpoints created</done>
</task>

</tasks>

<verification>
Wave 3d - DocumentsController complete

**Automated checks:**
1. Controller file exists with @Controller('documents')
2. Endpoints: POST /upload (FileInterceptor), GET /:id/status, GET /, DELETE /:id
3. Controller uses JwtAuthGuard and TenantGuard on all routes (@UseGuards)
4. Controller injects DocumentsService
5. Controller extracts userId and tenantId from request (user from JWT)
6. DTOs created for pagination (StatusQueryDto) and responses
7. TypeScript compiles without errors

**Requirements coverage:**
- DOC-01: Upload endpoint implemented ✓
- DOC-03: Status endpoint for polling ✓
- DOC-05: List endpoint to show documents with status ✓

**Integration points:**
- Controller → DocumentsService (04c)
- DocumentsService → BullMQ queue (04a)
- Multer for file upload

**Next:** 04e to wire DocumentsModule and register BullMQ queues.

</verification>

<success_criteria>
Upload controller ready when:
- [ ] Controller with 4 endpoints created
- [ ] JwtAuthGuard and TenantGuard applied
- [ ] FileInterceptor configured with 50MB limit
- [ ] Controller methods pass userId, tenantId to service
- [ ] Response DTOs used for typed responses
- [ ] TypeScript compilation successful

**Deliverable:** RESTful API for document management.

**Output:** `.planning/phases/01-backend-mvp/01-backend-mvp-04d-PLAN-04d-summary.md`

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-04d-PLAN-04d-summary.md`
