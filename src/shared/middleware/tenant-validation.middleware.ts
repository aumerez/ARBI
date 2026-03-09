import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../database/database.service';
import { PrismaClient } from '@prisma/client';

interface TenantWithSelect {
  id: number;
  name: string;
  plan?: string | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class TenantValidationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantValidationMiddleware.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Extract tenant_id from JWT payload (set by JwtAuthGuard)
    // The JWT payload is attached to req.user by the authentication guard
    const user = req.user as { sub: number } | undefined;

    // If no user context (public route), skip tenant validation and continue
    if (!user || !user.sub) {
      this.logger.debug('No user context - skipping tenant validation for public route');
      return next();
    }

    const tenantId = user.sub;
    const prisma = this.databaseService.getPrismaClient();

    try {
      // Verify tenant exists using DatabaseService (defense-in-depth)
      // Query: db.tenant.findUnique({ where: { id: tenantId } })
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          plan: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!tenant) {
        this.logger.warn(`Tenant not found: ${tenantId}`);
        res.status(404).json({
          statusCode: 404,
          message: 'Tenant not found',
        });
        return;
      }

      // Set tenant context for RLS policies
      await this.databaseService.setTenantContext(tenantId);

      // Attach tenant to request for downstream services
      (req as any).tenant = tenant;

      this.logger.debug(`Tenant validated: ${tenantId}`);
      next();
    } catch (error) {
      this.logger.error('Tenant validation failed', error);
      res.status(404).json({
        statusCode: 404,
        message: 'Tenant not found',
      });
    }
  }
}
