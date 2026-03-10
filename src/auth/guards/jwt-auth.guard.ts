import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: any): Promise<boolean> {
    const isAuthenticated = (await super.canActivate(context)) as boolean;
    if (!isAuthenticated) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { email_verified?: boolean };

    if (user.email_verified === false) {
      throw new UnauthorizedException(
        'Email verification required. Please verify your email address before continuing.',
      );
    }

    return true;
  }
}
