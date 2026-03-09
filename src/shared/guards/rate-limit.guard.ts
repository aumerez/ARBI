import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
  CanActivate,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimiterService } from '../infrastructure/rate-limiter.service';

export const RATE_LIMIT_METADATA = 'rate_limit';
export interface RateLimitOptions {
  points: number;
  duration: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly rateLimiterService: RateLimiterService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Extract user from request (set by JWT auth guard)
    const user = request.user;
    if (!user || !user.userId) {
      this.logger.warn('RateLimitGuard: No user found in request, skipping');
      return true; // Allow if no user (public routes should use different guard)
    }

    // Get rate limit options from route metadata
    const rateLimitOptions = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_METADATA,
      context.getHandler(),
    );

    const points = rateLimitOptions?.points ?? 60;
    const duration = rateLimitOptions?.duration ?? 60;

    // Synchronous check (we await the result)
    return this.checkLimitSynchronously(user.userId, points, duration, response);
  }

  private async checkLimitSynchronously(
    userId: number,
    points: number,
    duration: number,
    response: any,
  ): Promise<boolean> {
    try {
      const withinLimit = await this.rateLimiterService.checkLimit(
        userId,
        points,
        duration,
      );

      if (!withinLimit) {
        // Get remaining to calculate retry after
        const remaining = await this.rateLimiterService.getRemaining(
          userId,
          points,
          duration,
        );

        // Set retry after header (duration in seconds)
        response.setHeader('Retry-After', duration.toString());
        response.setHeader('X-RateLimit-Limit', points.toString());
        response.setHeader('X-RateLimit-Remaining', remaining.toString());

        throw new UnauthorizedException(
          `Rate limit exceeded. Maximum ${points} requests per ${duration} seconds.`,
        );
      }

      return true;
    } catch (error) {
      // If it's our rate limit error, rethrow it
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // Other errors: fail open (allow request)
      this.logger.warn(
        `Rate limiter error for user ${userId}, allowing request (fail open): ${error}`,
      );
      return true;
    }
  }
}
