import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AuditLoggingService {
  private readonly logger = new Logger(AuditLoggingService.name);

  constructor(private readonly database: DatabaseService) {}

  /**
   * Log an audit event
   * @param eventType - Type of event (e.g., 'http.request', 'user.login', 'document.upload')
   * @param payload - Event data (will be stored as JSON)
   * @param userId - Optional user ID who performed the action
   */
  async log(
    eventType: string,
    payload: Record<string, any>,
    userId?: number
  ): Promise<void> {
    try {
      const prisma = this.database.getPrismaClient();
      const tenantId = await this.database.getCurrentTenant();

      if (!tenantId) {
        // Cannot log without tenant context - this is a serious issue
        this.logger.warn(`Cannot log audit event ${eventType}: no tenant context set`);
        return;
      }

      this.logger.debug(`Logging audit event: ${eventType}`, { tenantId, userId });

      await prisma.auditLog.create({
        data: {
          tenant_id: tenantId,
          user_id: userId,
          event_type: eventType,
          payload: payload as any,
          created_at: new Date(),
        },
      });
    } catch (error) {
      // Audit failures should NOT break the main request flow
      // Log the error but don't throw
      this.logger.error('Audit log failed', error);
    }
  }
}
