import { Test, TestingModule } from '@nestjs/testing';
import { HttpExceptionFilter } from './http-exception.filter';
import { ArgumentsHost, HttpException } from '@nestjs/common';

// Mock console.log to capture output in tests
const originalConsoleLog = console.log;

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  const createMockHttpException = (status: number, message: string) => {
    // Use actual HttpException for proper instanceof checking
    return new HttpException(message, status);
  };

  const createMockResponse = (status?: number, jsonResult?: any) => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnValue(jsonResult),
    } as any;
    if (status !== undefined) {
      res.statusCode = status;
    }
    return res;
  };

  const createMockHost = (response: any) => {
    const host: ArgumentsHost = {
      getArgByIndex: jest.fn(),
      getRequest: jest.fn(),
      getResponse: jest.fn(() => response),
      switchToHttp: () => ({
        getRequest: jest.fn(),
        getResponse: jest.fn(() => response),
      }),
    } as any;
    return host;
  };

  beforeEach(async () => {
    // Spy on console.log
    jest.spyOn(console, 'log').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HttpExceptionFilter,
      ],
    }).compile();

    filter = module.get<HttpExceptionFilter>(HttpExceptionFilter);
  });

  afterEach(() => {
    (console.log as jest.Mock).mockRestore();
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  describe('catch', () => {
    it('should catch HttpException and return JSON with statusCode and message', () => {
      // Arrange
      const exception = createMockHttpException(400, 'Bad request');
      const response = createMockResponse(400);
      const host = createMockHost(response);

      // Act
      filter.catch(exception, host);

      // Assert
      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith({
        statusCode: 400,
        message: 'Bad request',
      });
    });

    it('should include stack trace in development mode', () => {
      // Arrange - set NODE_ENV to development
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const exception = new Error('Test error');
      (exception as any).getStatus = () => 500;
      (exception as any).response = { status: 500, message: 'Test error' };

      const response = createMockResponse(500);
      const host = createMockHost(response);

      // Act
      filter.catch(exception, host);

      // Assert
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Test error',
          error: expect.any(String), // stack trace
        })
      );

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });

    it('should NOT include stack trace in production mode', () => {
      // Arrange - set NODE_ENV to production
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const exception = new Error('Test error');
      (exception as any).getStatus = () => 500;
      (exception as any).response = { status: 500, message: 'Test error' };

      const response = createMockResponse(500);
      const host = createMockHost(response);

      // Act
      filter.catch(exception, host);

      // Assert
      expect(response.status).toHaveBeenCalledWith(500);
      const jsonArg = response.json.mock.calls[0][0];
      expect(jsonArg).toEqual({
        statusCode: 500,
        message: 'Test error',
      });

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });

    it('should return 500 for unknown exceptions without getStatus method', () => {
      // Arrange
      const exception = new Error('Unknown error');
      // No getStatus or response property
      const response = createMockResponse(500);
      const host = createMockHost(response);

      // Act
      filter.catch(exception, host);

      // Assert
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Internal server error',
      });
    });

    it('should return 500 with generic message for generic errors', () => {
      // Arrange - completely unknown error
      const exception = new Error('Something broke');
      const response = createMockResponse(500);
      const host = createMockHost(response);

      // Act
      filter.catch(exception, host);

      // Assert
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Internal server error',
      });
    });
  });
});
