import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../../auth/types/jwt-payload.interface';

export const Tenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;

    if (!user || !user.tenant_id) {
      throw new Error('Tenant context missing from authenticated user');
    }

    return user.tenant_id;
  }
);
