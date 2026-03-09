import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { RedisService } from './redis.service';

@Injectable()
export class RateLimiterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly limiter: RateLimiterRedis;
  private readonly redisClient: Redis;
  private readonly defaultWindow: number;
  private readonly defaultPoints: number;

  constructor(
    private readonly config: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.defaultWindow = this.config.get<number>('RATE_LIMIT_WINDOW', 60);
    this.defaultPoints = this.config.get<number>('RATE_LIMIT_MAX', 60);

    this.redisClient = this.redisService.getConnection();

    this.limiter = new RateLimiterRedis({
      storeClient: this.redisClient,
      points: this.defaultPoints,
      duration: this.defaultWindow,
      blockDuration: this.defaultWindow, // Block for full window when limit exceeded
    });
  }

  async onModuleInit() {
    // Verify Redis connection works
    try {
      await this.redisClient.ping();
      this.logger.log('Rate limiter ready');
    } catch (error) {
      this.logger.error('Failed to connect to Redis for rate limiting', error);
      throw error;
    }
  }

  /**
   * Check if a user has exceeded their rate limit
   * @param userId - The user identifier
   * @param points - Number of points to consume (default: 1)
   * @param duration - Time window in seconds (default: configured default)
   * @returns Promise<boolean> - true if within limit, false if exceeded
   */
  async checkLimit(
    userId: number,
    points: number = 1,
    duration: number = this.defaultWindow,
  ): Promise<boolean> {
    const key = `rate-limit:${userId}`;

    try {
      // Temporarily override limiter config if duration differs
      const originalDuration = this.limiter.duration;
      const originalPoints = this.limiter.points;

      if (duration !== this.defaultWindow || points !== this.defaultPoints) {
        this.limiter.duration = duration;
        this.limiter.points = points;
      }

      try {
        await this.limiter.consume(key);
        return true; // Consumed successfully
      } catch (error: any) {
        // If error is a RateLimiterRes, limit was exceeded
        if (error && error.remainingPoints !== undefined) {
          return false; // Limit exceeded
        }
        // Other errors: fail open
        this.logger.warn(
          `Rate limiter error for user ${userId}, allowing request (fail open): ${error}`,
        );
        return true;
      } finally {
        // Restore original config
        if (duration !== this.defaultWindow || points !== this.defaultPoints) {
          this.limiter.duration = originalDuration;
          this.limiter.points = originalPoints;
        }
      }
    } catch (error) {
      // Fail open: if rate limiter fails (Redis down, etc.), allow request
      this.logger.warn(
        `Rate limiter error for user ${userId}, allowing request (fail open): ${error}`,
      );
      return true;
    }
  }

  /**
   * Get remaining rate limit points for a user
   * @param userId - The user identifier
   * @param points - Points to check against (default: configured max)
   * @param duration - Time window in seconds (default: configured window)
   * @returns Remaining points available
   */
  async getRemaining(
    userId: number,
    points: number = this.defaultPoints,
    duration: number = this.defaultWindow,
  ): Promise<number> {
    const key = `rate-limit:${userId}`;

    try {
      const rateLimit = await this.limiter.get(key, {
        points,
        duration,
      });

      if (!rateLimit) {
        return points; // No consumption recorded yet
      }

      return rateLimit.remainingPoints;
    } catch (error) {
      this.logger.warn(`Failed to get remaining rate limit: ${error}`);
      return points; // Return full quota on error
    }
  }

  /**
   * Reset rate limit for a user (admin operation)
   * @param userId - The user identifier
   */
  async resetLimit(userId: number): Promise<void> {
    const key = `rate-limit:${userId}`;
    try {
      await this.redisClient.del(key);
      this.logger.log(`Rate limit reset for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to reset rate limit for user ${userId}`, error);
    }
  }

  async onModuleDestroy() {
    // RateLimiterRedis doesn't need explicit cleanup
    this.logger.log('Rate limiter shutting down');
  }
}
