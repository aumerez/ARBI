import { Test, TestingModule } from '@nestjs/testing';
import {
  RateLimitGuard,
  RATE_LIMIT_METADATA,
} from './rate-limit.guard';
import { Reflector } from '@nestjs/core';
import { RateLimiterService } from '../infrastructure/rate-limiter.service';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';

// Mock the services with jest.fn() for tracking calls
const mockCheckLimit = jest.fn();
const mockGetRemaining = jest.fn();
const mockReflectorGet = jest.fn();

const mockRateLimiterService = {
  checkLimit: mockCheckLimit,
  getRemaining: mockGetRemaining,
};

const mockReflector = {
  get: mockReflectorGet,
};

const createMockHttpContext = (user?: { userId: number }) => {
  const response = { setHeader: jest.fn() };
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => response,
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    getType: jest.fn(),
    switchToWs: jest.fn(),
  } as unknown as ExecutionContext;
};

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitGuard,
        {
          provide: RateLimiterService,
          useValue: mockRateLimiterService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<RateLimitGuard>(RateLimitGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow when user has rate limit remaining', async () => {
      mockCheckLimit.mockResolvedValue(true);
      mockReflectorGet.mockReturnValue(undefined); // Use defaults (60/60)

      const context = createMockHttpContext({ userId: 123 });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockCheckLimit).toHaveBeenCalledWith(123, 60, 60);
    });

    it('should throw 429 when rate limit exceeded', async () => {
      mockCheckLimit.mockResolvedValue(false);
      mockGetRemaining.mockResolvedValue(0);
      mockReflectorGet.mockReturnValue(undefined);

      const context = createMockHttpContext({ userId: 123 });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockCheckLimit).toHaveBeenCalledWith(123, 60, 60);
    });

    it('should apply custom rate limits from metadata', async () => {
      mockCheckLimit.mockResolvedValue(true);
      const customOptions = { points: 10, duration: 30 };
      mockReflectorGet.mockReturnValue(customOptions);

      const context = createMockHttpContext({ userId: 123 });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockCheckLimit).toHaveBeenCalledWith(123, 10, 30);
    });

    it('should allow request when checkLimit throws non-rate-limit error', async () => {
      mockCheckLimit.mockResolvedValue(true);
      mockReflectorGet.mockReturnValue(undefined);

      const context = createMockHttpContext({ userId: 123 });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should skip rate limiting when no user in request', async () => {
      const context = createMockHttpContext(undefined); // No user

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockCheckLimit).not.toHaveBeenCalled();
    });

    it('should set response headers when rate limit exceeded', async () => {
      mockCheckLimit.mockResolvedValue(false);
      mockGetRemaining.mockResolvedValue(5);
      mockReflectorGet.mockReturnValue(undefined);

      const context = createMockHttpContext({ userId: 123 });
      const response = context.switchToHttp().getResponse();

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '60');
      expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '60');
      expect(response.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        '5',
      );
    });
  });
});
