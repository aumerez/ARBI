import { Test, TestingModule } from '@nestjs/testing';
import { AuditLoggingService } from './audit-logging.service';
import { DatabaseService } from '../database/database.service';

describe('AuditLoggingService', () => {
  let service: AuditLoggingService;
  let databaseService: DatabaseService;
  let mockPrismaClient: any;

  beforeEach(async () => {
    mockPrismaClient = {
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLoggingService,
        {
          provide: DatabaseService,
          useValue: {
            getPrismaClient: jest.fn().mockReturnValue(mockPrismaClient),
            getCurrentTenant: jest.fn().mockResolvedValue(123),
            setTenantContext: jest.fn(),
            clearTenantContext: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuditLoggingService>(AuditLoggingService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should create audit log with event_type and payload', async () => {
      // Arrange
      const eventType = 'user.action';
      const payload = { action: 'login', ip: '127.0.0.1' };
      const userId = 123;
      const tenantId = 456;

      (databaseService.getCurrentTenant as jest.Mock).mockResolvedValue(tenantId);

      // Act
      await service.log(eventType, payload, userId);

      // Assert
      expect(mockPrismaClient.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: tenantId,
          event_type: eventType,
          payload,
          user_id: userId,
        }),
      });
    });

    it('should use tenant context from DatabaseService', async () => {
      // Arrange
      const eventType = 'http.request';
      const payload = { method: 'GET', path: '/api/test' };
      const tenantId = 789;

      (databaseService.getCurrentTenant as jest.Mock).mockResolvedValue(tenantId);

      // Act
      await service.log(eventType, payload);

      // Assert
      expect(mockPrismaClient.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: tenantId,
          event_type: eventType,
        }),
      });
    });

    it('should not log if tenant context is missing', async () => {
      // Arrange
      (databaseService.getCurrentTenant as jest.Mock).mockResolvedValue(null);

      // Act
      await service.log('test', {});

      // Assert
      expect(mockPrismaClient.auditLog.create).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully without throwing', async () => {
      // Arrange
      mockPrismaClient.auditLog.create = jest.fn().mockRejectedValue(new Error('DB error'));
      (databaseService.getCurrentTenant as jest.Mock).mockResolvedValue(123);

      // Act & Assert
      await expect(service.log('test', {})).resolves.not.toThrow();
      expect(mockPrismaClient.auditLog.create).toHaveBeenCalled();
    });
  });
});
