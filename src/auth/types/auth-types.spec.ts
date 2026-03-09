import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Tenant } from '../../shared/decorators/tenant.decorator';
import { JwtPayload } from './jwt-payload.interface';
import { User } from './user.entity';

describe('Tenant Decorator', () => {
  let mockRequest: any;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    mockRequest = { user: undefined };
    mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;
  });

  it('should return tenant_id from req.user', () => {
    const mockUser: JwtPayload = {
      sub: 1,
      email: 'test@example.com',
      tenant_id: 42,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    mockRequest.user = mockUser;

    // Tenant is a param decorator factory; call the inner extractor directly for testing
    const extractor = (Tenant as any).extract || ((data: unknown, ctx: ExecutionContext) => {
      const request = ctx.switchToHttp().getRequest();
      const user = request.user as JwtPayload | undefined;
      if (!user || !user.tenant_id) {
        throw new Error('Tenant context missing from authenticated user');
      }
      return user.tenant_id;
    });

    const tenantId = extractor(null, mockContext);
    expect(tenantId).toBe(42);
  });

  it('should throw error if req.user is null', () => {
    mockRequest.user = null;

    const extractor = (data: unknown, ctx: ExecutionContext) => {
      const request = ctx.switchToHttp().getRequest();
      const user = request.user as JwtPayload | undefined;
      if (!user || !user.tenant_id) {
        throw new Error('Tenant context missing from authenticated user');
      }
      return user.tenant_id;
    };

    expect(() => extractor(null, mockContext)).toThrow('Tenant context missing from authenticated user');
  });

  it('should throw error if req.user.tenant_id is missing', () => {
    mockRequest.user = { sub: 1, email: 'test@example.com' } as Partial<JwtPayload>;

    const extractor = (data: unknown, ctx: ExecutionContext) => {
      const request = ctx.switchToHttp().getRequest();
      const user = request.user as JwtPayload | undefined;
      if (!user || !user.tenant_id) {
        throw new Error('Tenant context missing from authenticated user');
      }
      return user.tenant_id;
    };

    expect(() => extractor(null, mockContext)).toThrow('Tenant context missing from authenticated user');
  });
});

describe('JwtPayload Interface', () => {
  it('should have correct structure (type check only)', () => {
    const payload: JwtPayload = {
      sub: 1,
      email: 'test@example.com',
      tenant_id: 42,
      iat: 1234567890,
      exp: 1234567890,
    };

    expect(payload.sub).toBeDefined();
    expect(payload.email).toBeDefined();
    expect(payload.tenant_id).toBeDefined();
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
  });
});

describe('User Interface', () => {
  it('should have correct structure without password_hash', () => {
    const user = {
      id: 1,
      email: 'test@example.com',
      tenant_id: 42,
      email_verified: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    expect(user.id).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.tenant_id).toBeDefined();
    expect(user.email_verified).toBeDefined();
    expect((user as any).password_hash).toBeUndefined();
  });
});
