import { Test, TestingModule } from '@nestjs/testing';
import { TenantValidationMiddleware } from './tenant-validation.middleware';
import { DatabaseService } from '../database/database.service';

describe('TenantValidationMiddleware', () => {
  let middleware: TenantValidationMiddleware;
  let databaseService: DatabaseService;

  const createMockResponse = () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;
    return res;
  };

  const createMockRequest = (overrides = {}) => ({
    method: 'GET',
    path: '/api/test',
    user: { sub: 1 }, // JWT payload with tenant_id
    ...overrides,
  } as any);

  const createMockNext = () => jest.fn();

  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      tenant: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantValidationMiddleware,
        {
          provide: DatabaseService,
          useValue: {
            getCurrentTenant: jest.fn(),
            getPrismaClient: jest.fn(() => prismaMock),
            setTenantContext: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    middleware = module.get<TenantValidationMiddleware>(TenantValidationMiddleware);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  describe('use', () => {
    it('should extract tenant_id from JWT payload and validate tenant exists', async () => {
      // Arrange
      const req = createMockRequest({
        user: { sub: 123 },
      });
      const res = createMockResponse();
      const next = createMockNext();

      const mockTenant = { id: 123, name: 'Test Tenant', plan: 'basic', created_at: new Date(), updated_at: new Date() };
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant);

      // Act
      await middleware.use(req, res, next);

      // Assert
      expect(prismaMock.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 123 },
        select: {
          id: true,
          name: true,
          plan: true,
          created_at: true,
          updated_at: true,
        },
      });
      expect((req as any).tenant).toEqual(mockTenant);
      expect(next).toHaveBeenCalled();
    });

    it('should return 404 if tenant not found', async () => {
      // Arrange
      const req = createMockRequest({
        user: { sub: 999 },
      });
      const res = createMockResponse();
      const next = createMockNext();

      prismaMock.tenant.findUnique.mockResolvedValue(null);

      // Act
      await middleware.use(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        statusCode: 404,
        message: 'Tenant not found',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 404 if database query throws error', async () => {
      // Arrange
      const req = createMockRequest({
        user: { sub: 123 },
      });
      const res = createMockResponse();
      const next = createMockNext();

      prismaMock.tenant.findUnique.mockRejectedValue(new Error('DB error'));

      // Act
      await middleware.use(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        statusCode: 404,
        message: 'Tenant not found',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should attach tenant to request when valid', async () => {
      // Arrange
      const req = createMockRequest({
        user: { sub: 42 },
      });
      const res = createMockResponse();
      const next = createMockNext();

      const mockTenant = { id: 42, name: 'My Tenant', plan: 'basic', created_at: new Date(), updated_at: new Date() };
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant);

      // Act
      await middleware.use(req, res, next);

      // Assert
      expect((req as any).tenant).toBe(mockTenant);
    });

    it('should handle missing user in request (no JWT)', async () => {
      // Arrange
      const req = createMockRequest({
        user: undefined,
      });
      const res = createMockResponse();
      const next = createMockNext();

      prismaMock.tenant.findUnique.mockResolvedValue(null);

      // Act
      await middleware.use(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        statusCode: 404,
        message: 'Tenant not found',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
