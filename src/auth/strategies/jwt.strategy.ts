import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { JwtPayload } from '../types/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          // Extract from httpOnly cookie or Authorization header
          return req?.cookies?.access_token ??
            (req?.headers?.authorization?.split(' ')[1] ?? null);
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any): Promise<{ userId: number; email: string; tenantId: number; email_verified: boolean }> {
    this.logger.debug('Validating JWT token', { sub: payload.sub });

    // Ensure payload has tenant_id
    if (!payload.tenant_id) {
      throw new UnauthorizedException('Missing tenant context in token');
    }

    // Verify user exists (active)
    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Additional check: ensure user.tenant_id matches payload.tenant_id (tampering check)
    if (user.tenant_id !== payload.tenant_id) {
      throw new UnauthorizedException('Tenant mismatch');
    }

    return {
      userId: user.id,
      email: user.email,
      tenantId: user.tenant_id,
      email_verified: user.email_verified,
    };
  }
}
