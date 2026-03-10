import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CanActivate, ExecutionContext } from '@nestjs/common';

/**
 * VerifiedGuard
 *
 * Ensures that the authenticated user has a verified email address.
 * Blocks access to protected endpoints if email_verified is false.
 *
 * Usage: Apply to routes that require verified accounts, or globally for all protected routes.
 */
@Injectable()
export class VerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Ensure user exists (JwtAuthGuard should have set this)
    if (!request.user) {
      throw new UnauthorizedException('Authentication required');
    }

    const { email_verified } = request.user as { email_verified?: boolean };

    if (email_verified === false) {
      throw new UnauthorizedException('Email verification required. Please verify your email address before continuing.');
    }

    return true;
  }
}
