import { Test, TestingModule } from '@nestjs/testing';
import { RateLimiterService } from './rate-limiter.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import { RateLimiterRedis } from 'rate-limiter-flexible';

// Mock RateLimiterRedis with a factory that returns fresh mocks
const createRateLimiterMock = () => ({
  consume: jest.fn(),
  get: jest.fn(),
  points: 60,
  duration: 60,
});

jest.mock('rate-limiter-flexible', () => {
  return {
    RateLimiterRedis: jest.fn(),
  };
});

describe('RateLimiterService', () => {
  let service: RateLimiterService;
  let mockConfig: Partial<ConfigService>;
  let mockRedisService: ReturnType<typeof createMockRedisService>;
  let rateLimiterMock: ReturnType<typeof createRateLimiterMock>;

  const createMockRedisService = () => ({
    getConnection: jest.fn().mockReturnValue({}),
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
  });

  beforeEach(async () => {
    // Create fresh mock for each test
    rateLimiterMock = createRateLimiterMock();
    (RateLimiterRedis as jest.Mock).mockImplementation(() => rateLimiterMock);

    mockRedisService = createMockRedisService();

    mockConfig = {
      get: jest.fn().mockReturnValue(60), // Return 60 for both window and max
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimiterService,
        {
          provide: ConfigService,
          useValue: mockConfig,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<RateLimiterService>(RateLimiterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize RateLimiterRedis with correct default configuration', () => {
    expect(RateLimiterRedis).toHaveBeenCalledWith(
      expect.objectContaining({
        storeClient: expect.any(Object),
        points: 60,
        duration: 60,
        blockDuration: 60,
      }),
    );
  });

  describe('checkLimit', () => {
    it('should return true when consume succeeds', async () => {
      rateLimiterMock.consume.mockResolvedValue({
        remainingPoints: 50,
        consumedPoints: 10,
        msBeforeNext: 0,
        isFirstInDuration: true,
      });

      const result = await service.checkLimit(1, 10);

      expect(result).toBe(true);
      // consume called with key only, points set via limiter.points
      expect(rateLimiterMock.consume).toHaveBeenCalledWith('rate-limit:1');
      // Limiter points should be temporarily set to 10
      expect(rateLimiterMock.points).toBe(60); // Restored after call
    });

    it('should return false when limit is exceeded', async () => {
      const error = new Error('Rate limit exceeded') as any;
      error.remainingPoints = 0;
      error.consumedPoints = 60;
      error.msBeforeNext = 30000;
      error.isFirstInDuration = false;

      rateLimiterMock.consume.mockRejectedValue(error);

      const result = await service.checkLimit(1, 60);

      expect(result).toBe(false);
    });

    it('should fail open when RateLimiterRedis throws a non-rate-limit error', async () => {
      rateLimiterMock.consume.mockRejectedValue(new Error('Redis connection lost'));

      const result = await service.checkLimit(1, 60);

      expect(result).toBe(true); // Fail open
    });

    it('should handle custom points and duration', async () => {
      rateLimiterMock.consume.mockResolvedValue({
        remainingPoints: 90,
        consumedPoints: 10,
        msBeforeNext: 0,
        isFirstInDuration: true,
      });

      const result = await service.checkLimit(1, 10, 120);

      expect(result).toBe(true);
      expect(rateLimiterMock.consume).toHaveBeenCalledWith('rate-limit:1');
    });
  });

  describe('getRemaining', () => {
    it('should return remaining points for a user', async () => {
      rateLimiterMock.get.mockResolvedValue({
        remainingPoints: 30,
        consumedPoints: 30,
        msBeforeNext: 15000,
        isFirstInDuration: false,
      });

      const remaining = await service.getRemaining(1, 60);

      expect(remaining).toBe(30);
      // get called with key and options object
      expect(rateLimiterMock.get).toHaveBeenCalledWith('rate-limit:1', { points: 60, duration: 60 });
    });

    it('should return full quota if no rate limit data exists', async () => {
      rateLimiterMock.get.mockResolvedValue(null);

      const remaining = await service.getRemaining(1, 60);

      expect(remaining).toBe(60);
    });
  });

  describe('resetLimit', () => {
    it('should reset rate limit for a user', async () => {
      const mockDel = jest.fn().mockResolvedValue(1);
      const customRedisClient = { del: mockDel };
      const customRedisService = {
        getConnection: jest.fn().mockReturnValue(customRedisClient),
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RateLimiterService,
          {
            provide: ConfigService,
            useValue: mockConfig,
          },
          {
            provide: RedisService,
            useValue: customRedisService,
          },
        ],
      }).compile();

      const testService = module.get<RateLimiterService>(RateLimiterService);
      await testService.resetLimit(1);

      expect(customRedisClient.del).toHaveBeenCalledWith('rate-limit:1');
    });

    it('should log error if reset fails', async () => {
      const customRedisClient = {
        del: jest.fn().mockRejectedValue(new Error('Redis error')),
      };
      const customRedisService = {
        getConnection: jest.fn().mockReturnValue(customRedisClient),
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RateLimiterService,
          {
            provide: ConfigService,
            useValue: mockConfig,
          },
          {
            provide: RedisService,
            useValue: customRedisService,
          },
        ],
      }).compile();

      const testService = module.get<RateLimiterService>(RateLimiterService);
      // Should not throw
      await expect(testService.resetLimit(1)).resolves.toBeUndefined();
    });
  });
});
