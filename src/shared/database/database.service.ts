import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma: PrismaClient;
  private readonly logger = new Logger(DatabaseService.name);

  constructor() {
    this.prisma = new PrismaClient();
  }

  async setTenantContext(tenantId: number): Promise<void> {
    this.logger.debug(`Setting tenant context: ${tenantId}`);
    await this.prisma.$executeRaw`SET app.current_tenant = ${tenantId}`;
  }

  async clearTenantContext(): Promise<void> {
    this.logger.debug('Clearing tenant context');
    await this.prisma.$executeRaw`RESET app.current_tenant`;
  }

  async getCurrentTenant(): Promise<number | null> {
    try {
      const result = await this.prisma.$queryRaw<{ current_setting: string }[]>`
        SELECT current_setting('app.current_tenant', true) as current_setting
      `;
      if (result.length > 0 && result[0].current_setting) {
        const parsed = parseInt(result[0].current_setting, 10);
        return isNaN(parsed) ? null : parsed;
      }
      return null;
    } catch (error) {
      // If setting not set, returns null
      this.logger.debug('No tenant context set');
      return null;
    }
  }

  getPrismaClient(): PrismaClient {
    return this.prisma;
  }

  onModuleInit() {
    this.logger.log('DatabaseService initialized');
    this.prisma.$connect().catch(err => this.logger.error('DB connection failed', err));
  }

  onModuleDestroy() {
    this.prisma.$disconnect();
  }
}
