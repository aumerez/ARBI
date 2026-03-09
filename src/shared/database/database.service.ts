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
