import { Test, TestingModule } from '@nestjs/testing';
import { LoggingInterceptor } from './logging.interceptor';
import { of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { lastValueFrom } from 'rxjs';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  const createMockRequest = (overrides = {}) => ({
    method: 'GET',
    url: '/api/test',
    ...overrides,
  } as any);

  const createMockResponse = (statusCode: number = 200) => ({
    statusCode,
    get: jest.fn((header: string) => {
      if (header === 'content-length') return '456';
      return null;
    }),
  } as any);

  const createMockNext = (statusCode: number = 200) => ({
    handle: jest.fn(() => {
      return of({}).pipe(
        tap({
          next: () => {
            // Simulate the response having a status code
          },
        })
      );
    }),
  });

  const createMockContext = (req: any, res: any) => ({
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as any);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggingInterceptor,
      ],
    }).compile();

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    it('should log structured data with method, url, status, duration, user_id, tenant_id', async () => {
      // Arrange
      const req = createMockRequest({
        method: 'POST',
        url: '/api/chat',
        user: { sub: 123 },
        tenant: { id: 1, name: 'Acme Corp' },
      });
      const res = createMockResponse(200);
      const next = createMockNext(200);

      // Spy on console.log since Logger.log uses console
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Act - intercept returns an Observable, we need to subscribe to trigger tap
      const observable = interceptor.intercept(createMockContext(req, res), next as any);
      await lastValueFrom(observable);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const callArgs = consoleLogSpy.mock.calls[0];
      const message = callArgs[0];
      const logData = callArgs[1];

      expect(message).toContain('HTTP request completed');
      expect(logData).toMatchObject({
        method: 'POST',
        url: '/api/chat',
        status: 200,
        duration_ms: expect.any(Number),
        content_length: 456,
        user_id: 123,
        tenant_id: 1,
      });

      consoleLogSpy.mockRestore();
    });

    it('should capture duration and status code correctly', async () => {
      // Arrange
      const req = createMockRequest({
        method: 'GET',
        url: '/api/documents',
      });
      const res = createMockResponse(201);

      const next = {
        handle: jest.fn(() => {
          return of({}).pipe(
            tap({
              next: () => {
                res.statusCode = 201;
              },
            })
          );
        }),
      };

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Act
      const observable = interceptor.intercept(createMockContext(req, res), next as any);
      await lastValueFrom(observable);

      // Assert
      const callArgs = consoleLogSpy.mock.calls[0];
      const logData = callArgs[1];

      expect(logData.status).toBe(201);
      expect(typeof logData.duration_ms).toBe('number');
      expect(logData.duration_ms).toBeGreaterThanOrEqual(0);

      consoleLogSpy.mockRestore();
    });

    it('should include tenant_id and user_id from request context', async () => {
      // Arrange
      const req = createMockRequest({
        user: { sub: 42 },
        tenant: { id: 7 },
      });
      const res = createMockResponse(200);

      const next = createMockNext(200);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Act
      const observable = interceptor.intercept(createMockContext(req, res), next as any);
      await lastValueFrom(observable);

      // Assert
      const callArgs = consoleLogSpy.mock.calls[0];
      const logData = callArgs[1];

      expect(logData.user_id).toBe(42);
      expect(logData.tenant_id).toBe(7);

      consoleLogSpy.mockRestore();
    });

    it('should handle missing user/tenant gracefully without errors', async () => {
      // Arrange
      const req = createMockRequest({
        user: undefined,
        tenant: undefined,
      });
      const res = createMockResponse(200);

      const next = createMockNext(200);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Act
      const observable = interceptor.intercept(createMockContext(req, res), next as any);
      await lastValueFrom(observable);

      // Assert
      const callArgs = consoleLogSpy.mock.calls[0];
      const logData = callArgs[1];

      expect(logData.user_id).toBeUndefined();
      expect(logData.tenant_id).toBeUndefined();

      consoleLogSpy.mockRestore();
    });

    it('should extract content_length from response header when present', async () => {
      // Arrange
      const req = createMockRequest({
        method: 'POST',
        url: '/api/test',
      });
      const res = {
        statusCode: 200,
        get: jest.fn((header: string) => {
          if (header === 'content-length') return '1234';
          return null;
        }),
      } as any;

      const next = {
        handle: jest.fn(() => {
          return of({}).pipe(
            tap({
              next: () => {
                // no-op
              },
            })
          );
        }),
      };

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Act
      const observable = interceptor.intercept(createMockContext(req, res), next as any);
      await lastValueFrom(observable);

      // Assert
      const callArgs = consoleLogSpy.mock.calls[0];
      const logData = callArgs[1];

      expect(logData.content_length).toBe(1234);

      consoleLogSpy.mockRestore();
    });
  });
});
