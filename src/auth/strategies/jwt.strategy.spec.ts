import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from '../auth.service';
import { UnauthorizedException } from '@nestjs/common';
import { JwtPayload } from '../types/jwt-payload.interface';
import { User } from '../types/user.entity';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authService: AuthService;

  const mockAuthService = {
    validateUser: jest.fn(),
  };

  const mockUser: User = {
    id: 1,
    email: 'test@example.com',
    tenant_id: 1,
    email_verified: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const validPayload: JwtPayload = {
    sub: 1,
    email: 'test@example.com',
    tenant_id: 1,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 15 * 60,
  };

  beforeEach(async () => {
    // Set JWT_SECRET for testing
    process.env.JWT_SECRET = 'test-secret-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  it('should extend PassportStrategy with jwt options', () => {
    expect(strategy).toBeDefined();
  });

  it('should validate JWT payload and return user info', async () => {
    mockAuthService.validateUser.mockResolvedValue(mockUser);

    const result = await strategy.validate({} as any, validPayload);

    expect(mockAuthService.validateUser).toHaveBeenCalledWith(validPayload.sub);
    expect(result).toEqual({
      userId: 1,
      email: 'test@example.com',
      tenantId: 1,
    });
  });

  it('should throw UnauthorizedException if payload missing tenant_id', async () => {
    const payloadWithoutTenant: any = {
      sub: 1,
      email: 'test@example.com',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 15 * 60,
    };

    await expect(strategy.validate({} as any, payloadWithoutTenant)).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('should throw UnauthorizedException if user not found', async () => {
    mockAuthService.validateUser.mockResolvedValue(null);

    await expect(strategy.validate({} as any, validPayload)).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('should throw UnauthorizedException if tenant_id mismatch', async () => {
    const differentTenantUser: User = {
      ...mockUser,
      tenant_id: 2,
    };
    mockAuthService.validateUser.mockResolvedValue(differentTenantUser);

    await expect(strategy.validate({} as any, validPayload)).rejects.toThrow(
      UnauthorizedException
    );
  });
});
