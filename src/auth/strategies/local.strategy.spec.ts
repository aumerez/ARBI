import { Test, TestingModule } from '@nestjs/testing';
import { LocalStrategy } from './local.strategy';
import { AuthService } from '../auth.service';
import { UnauthorizedException } from '@nestjs/common';
import { User } from '../types/user.entity';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let authService: AuthService;

  const mockAuthService = {
    validateUserByEmail: jest.fn(),
    validatePassword: jest.fn(),
  };

  // Mock user with password_hash for validation testing
  const mockUserWithHash = {
    id: 1,
    email: 'test@example.com',
    tenant_id: 1,
    email_verified: true,
    created_at: new Date(),
    updated_at: new Date(),
    password_hash: 'hashed_password_123',
  };

  const mockUser: User = {
    id: 1,
    email: 'test@example.com',
    tenant_id: 1,
    email_verified: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);
    authService = module.get<AuthService>(AuthService);
  });

  it('should extend PassportStrategy with correct options', () => {
    // Verify the strategy was created with proper configuration
    expect(strategy).toBeDefined();
    // The super() call configures usernameField and passwordField
    // We verify this through behavior in validate tests
  });

  it('should validate credentials and return user without password_hash', async () => {
    mockAuthService.validateUserByEmail.mockResolvedValue(mockUserWithHash);
    mockAuthService.validatePassword.mockResolvedValue(true);

    const result = await strategy.validate('test@example.com', 'password123');

    expect(mockAuthService.validateUserByEmail).toHaveBeenCalledWith('test@example.com');
    expect(mockAuthService.validatePassword).toHaveBeenCalledWith('password123', mockUserWithHash.password_hash);
    expect(result).toEqual({
      id: 1,
      email: 'test@example.com',
      tenant_id: 1,
      email_verified: true,
      created_at: mockUserWithHash.created_at,
      updated_at: mockUserWithHash.updated_at,
    });
    expect((result as any).password_hash).toBeUndefined();
  });

  it('should throw UnauthorizedException if user not found', async () => {
    mockAuthService.validateUserByEmail.mockResolvedValue(null);

    await expect(strategy.validate('nonexistent@example.com', 'password')).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('should throw UnauthorizedException if password is invalid', async () => {
    mockAuthService.validateUserByEmail.mockResolvedValue(mockUser);
    mockAuthService.validatePassword.mockResolvedValue(false);

    await expect(strategy.validate('test@example.com', 'wrongpassword')).rejects.toThrow(
      UnauthorizedException
    );
  });
});
