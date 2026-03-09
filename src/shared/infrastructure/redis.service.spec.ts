import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { ConfigService } from '@nestjs/config';

// Mock ioredis inline
jest.mock('ioredis', () => {
  const mockConnect = jest.fn().mockResolvedValue(undefined);
  const mockPing = jest.fn().mockResolvedValue('PONG');
  const mockQuit = jest.fn().mockResolvedValue(undefined);
  const mockOn = jest.fn();

  return {
    Redis: jest.fn().mockImplementation(() => ({
      connect: mockConnect,
      ping: mockPing,
      quit: mockQuit,
      on: mockOn,
    })),
  };
});

describe('RedisService', () => {
  let service: RedisService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('redis://localhost:6379'),
          },
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should inject ConfigService to read REDIS_URL', () => {
    expect(configService).toBeDefined();
    expect((configService.get as jest.Mock)).toHaveBeenCalledWith('REDIS_URL', 'redis://localhost:6379');
  });

  it('should create Redis client with connection options', () => {
    const Redis = require('ioredis').Redis;
    expect(Redis).toHaveBeenCalledWith(
      'redis://localhost:6379',
      expect.objectContaining({
        retryStrategy: expect.any(Function),
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      })
    );
  });

  it('should configure retryStrategy with exponential backoff', () => {
    const Redis = require('ioredis').Redis;
    const callArgs = Redis.mock.calls[0][1];
    const retryStrategy = callArgs.retryStrategy as Function;

    expect(retryStrategy(1)).toBe(200);
    expect(retryStrategy(2)).toBe(400);
    expect(retryStrategy(3)).toBe(600);
    expect(retryStrategy(15)).toBe(2000); // capped at 2000ms
  });

  it('should set up event handlers for error, connect, and close', () => {
    const Redis = require('ioredis').Redis;
    const instance = Redis.mock.results[0].value;

    // The on method should have been called during construction
    expect(instance.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(instance.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(instance.on).toHaveBeenCalledWith('close', expect.any(Function));
  });

  describe('onModuleInit', () => {
    it('should connect to Redis and perform health check', async () => {
      await service.onModuleInit();

      const Redis = require('ioredis').Redis;
      const instance = Redis.mock.results[0].value;

      expect(instance.connect).toHaveBeenCalled();
      expect(instance.ping).toHaveBeenCalled();
    });
  });

  describe('getConnection', () => {
    it('should return IORedis instance', () => {
      const connection = service.getConnection();
      expect(connection).toBeDefined();
    });
  });

  describe('onModuleDestroy', () => {
    it('should gracefully shut down Redis connection', async () => {
      await service.onModuleDestroy();

      const Redis = require('ioredis').Redis;
      const instance = Redis.mock.results[0].value;

      expect(instance.quit).toHaveBeenCalled();
    });
  });
});
