import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { JwtPayload } from '../types/jwt-payload.interface';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;

    if (!user || !user.tenant_id) {
      throw new ForbiddenException('Tenant context missing from authenticated user');
    }

    // Attach tenant_id to request for easy access in controllers
    request.tenant_id = user.tenant_id;
    return true;
  }
}
