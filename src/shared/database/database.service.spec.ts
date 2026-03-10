import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from './database.service';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient with a jest.fn that we can assert on
const mockExecuteRaw = jest.fn().mockResolvedValue(undefined);
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);
const mockQueryRaw = jest.fn();

const mockPrismaClient = {
  $executeRaw: mockExecuteRaw,
  $connect: mockConnect,
  $disconnect: mockDisconnect,
  $queryRaw: mockQueryRaw,
} as unknown as PrismaClient;

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [DatabaseService],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);

    // Replace the internal prisma instance with our mock
    (service as any).prisma = mockPrismaClient;
  });

  describe('setTenantContext', () => {
    it('should execute raw SQL to set tenant context', async () => {
      const tenantId = 123;
      await service.setTenantContext(tenantId);

      expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
      // Prisma template literal tag splits SQL and params
      expect(mockExecuteRaw).toHaveBeenCalledWith(
        ['SET app.current_tenant = ', ''],
        tenantId
      );
    });

    it('should accept different tenant IDs', async () => {
      await service.setTenantContext(42);
      expect(mockExecuteRaw).toHaveBeenCalledWith(
        ['SET app.current_tenant = ', ''],
        42
      );

      jest.clearAllMocks();
      await service.setTenantContext(999);
      expect(mockExecuteRaw).toHaveBeenCalledWith(
        ['SET app.current_tenant = ', ''],
        999
      );
    });
  });

  describe('clearTenantContext', () => {
    it('should execute raw SQL to clear tenant context', async () => {
      await service.clearTenantContext();

      expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
      expect(mockExecuteRaw).toHaveBeenCalledWith(
        ['RESET app.current_tenant']
      );
    });
  });

  describe('getPrismaClient', () => {
    it('should return PrismaClient instance', () => {
      const result = service.getPrismaClient();
      expect(result).toBe(mockPrismaClient);
    });
  });

  describe('onModuleInit', () => {
    it('should attempt to connect to database', async () => {
      await service.onModuleInit();
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect PrismaClient', async () => {
      await service.onModuleDestroy();
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCurrentTenant', () => {
    it('should return current tenant from database setting', async () => {
      mockQueryRaw.mockResolvedValue([{ current_setting: '123' }]);

      const result = await service.getCurrentTenant();

      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
      expect(result).toBe(123);
    });

    it('should return null when no tenant context set', async () => {
      mockQueryRaw.mockResolvedValue([{ current_setting: null }]);

      const result = await service.getCurrentTenant();

      expect(result).toBeNull();
    });

    it('should handle empty result gracefully', async () => {
      mockQueryRaw.mockResolvedValue([]);

      const result = await service.getCurrentTenant();

      expect(result).toBeNull();
    });

    it('should handle invalid numeric format', async () => {
      mockQueryRaw.mockResolvedValue([{ current_setting: 'abc' }]);

      const result = await service.getCurrentTenant();

      expect(result).toBeNull();
    });
  });
});
