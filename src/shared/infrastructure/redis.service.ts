import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');

    this.client = new Redis(url, {
      retryStrategy: (times) => {
        this.logger.warn(`Redis connection attempt ${times}, retrying...`);
        return Math.min(times * 200, 2000); // Exponential backoff: 200ms, 400ms, 600ms... max 2000ms
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis client error', err);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis client connected');
    });

    this.client.on('close', () => {
      this.logger.warn('Redis client closed');
    });
  }

  async onModuleInit() {
    await this.client.connect();
    // Health check
    const pong = await this.client.ping();
    if (pong !== 'PONG') {
      throw new Error('Redis health check failed');
    }
    this.logger.log('Redis service ready');
  }

  getConnection(): Redis {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis connection closed');
  }
}
