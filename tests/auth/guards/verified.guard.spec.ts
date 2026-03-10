import { Test, TestingModule } from '@nestjs/testing';
import { VerifiedGuard } from '../../../src/auth/guards/verified.guard';
import { UnauthorizedException } from '@nestjs/common';

describe('VerifiedGuard (AUTH-01)', () => {
  let guard: VerifiedGuard;

  const mockCanActivate = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerifiedGuard,
      ],
    }).compile();

    guard = module.get<VerifiedGuard>(VerifiedGuard);
  });

  it('should allow request when user.email_verified=true', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { email_verified: true, id: 1, email: 'test@test.com' },
        }),
      }),
    } as any;

    const result = await guard.canActivate(context as any);
    expect(result).toBe(true);
  });

  it('should block request when user.email_verified=false', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { email_verified: false, id: 2, email: 'unverified@test.com' },
        }),
      }),
    } as any;

    await expect(guard.canActivate(context as any)).rejects.toThrow(UnauthorizedException);
  });

  it('should handle missing user gracefully', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: null }),
      }),
    } as any;

    await expect(guard.canActivate(context as any)).rejects.toThrow();
  });
});
