import { Test, TestingModule } from '@nestjs/testing';
import { AuditMiddleware } from './audit.middleware';
import { AuditLoggingService } from '../services/audit-logging.service';
import { DatabaseService } from '../database/database.service';

describe('AuditMiddleware', () => {
  let middleware: AuditMiddleware;
  let auditService: AuditLoggingService;

  const createMockResponse = () => {
    const res = {
      statusCode: 200,
      get: jest.fn(),
      on: jest.fn(),
      locals: {},
    } as any;
    return res;
  };

  const createMockRequest = (overrides = {}) => ({
    method: 'GET',
    path: '/api/test',
    query: {},
    headers: {},
    ...overrides,
  } as any);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditMiddleware,
        {
          provide: AuditLoggingService,
          useValue: {
            log: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: DatabaseService,
          useValue: {
            getCurrentTenant: jest.fn().mockResolvedValue(1),
          },
        },
      ],
    }).compile();

    middleware = module.get<AuditMiddleware>(AuditMiddleware);
    auditService = module.get<AuditLoggingService>(AuditLoggingService);
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  describe('use', () => {
    it('should log HTTP request with basic metadata', async () => {
      // Arrange
      const req = createMockRequest({
        method: 'POST',
        path: '/api/documents/upload',
      });
      const res = createMockResponse();
      let finishCallback: () => void;
      res.on = jest.fn((event: string, callback: () => void) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });
      const next = jest.fn();

      // Act
      middleware.use(req, res, next);

      // Simulate response finish
      if (finishCallback) {
        finishCallback();
      }

      // Wait for async
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(auditService.log).toHaveBeenCalledWith(
        'http.request',
        expect.objectContaining({
          method: 'POST',
          path: '/api/documents/upload',
          status: 200,
          duration_ms: expect.any(Number),
        }),
        undefined
      );
    });

    it('should extract user_id from request when available', async () => {
      // Arrange
      const req = createMockRequest({
        user: { sub: 123, tenant_id: 1 },
      });
      const res = createMockResponse();
      let finishCallback: () => void;
      res.on = jest.fn((event: string, callback: () => void) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });
      const next = jest.fn();

      // Act
      middleware.use(req, res, next);
      if (finishCallback) {
        finishCallback();
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(auditService.log).toHaveBeenCalledWith(
        'http.request',
        expect.any(Object),
        123
      );
    });

    it('should capture response size when content-length header set', async () => {
      // Arrange
      const req = createMockRequest();
      const res = createMockResponse();
      res.get = jest.fn((header: string) => {
        if (header === 'content-length') {
          return '1234';
        }
        return null;
      });
      let finishCallback: () => void;
      res.on = jest.fn((event: string, callback: () => void) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });
      const next = jest.fn();

      // Act
      middleware.use(req, res, next);
      if (finishCallback) {
        finishCallback();
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(auditService.log).toHaveBeenCalledWith(
        'http.request',
        expect.objectContaining({
          response_size: 1234,
        }),
        undefined
      );
    });

    it('should capture request body for chat API calls', async () => {
      // Arrange
      const req = createMockRequest({
        method: 'POST',
        path: '/api/chat',
        body: { message: 'Hello', chat_id: 'test' },
      });
      const res = createMockResponse();
      let finishCallback: () => void;
      res.on = jest.fn((event: string, callback: () => void) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });
      const next = jest.fn();

      // Act
      middleware.use(req, res, next);
      if (finishCallback) {
        finishCallback();
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(auditService.log).toHaveBeenCalledWith(
        'http.request',
        expect.objectContaining({
          request_body: { message: 'Hello', chat_id: 'test' },
        }),
        undefined
      );
    });
  });
});
