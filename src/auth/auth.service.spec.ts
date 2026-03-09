import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { DatabaseService } from '../shared/database/database.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from './types/user.entity';
import * as bcrypt from 'bcrypt';

// Mock PrismaClient (returned by DatabaseService.getPrismaClient())
const mockPrismaClient = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  passwordResetToken: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

// Mock DatabaseService that returns mockPrismaClient
const mockDatabaseService = {
  getPrismaClient: jest.fn().mockReturnValue(mockPrismaClient),
  setTenantContext: jest.fn(),
  clearTenantContext: jest.fn(),
};

// Mock JwtService
const mockJwtService = {
  sign: jest.fn(),
};

// Mock ConfigService
const mockConfigService = {
  get: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any; // mockPrismaClient
  let jwtService: JwtService;
  let config: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = mockDatabaseService.getPrismaClient();
    jwtService = module.get<JwtService>(JwtService);
    config = module.get<ConfigService>(ConfigService);

    // Clear mocks before each test
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue('test-secret');
  });

  describe('register', () => {
    it('should create a user with bcrypt hashed password and email_verified=false', async () => {
      const dto = { email: 'test@example.com', password: 'password123', tenant_id: 1 };
      const hashedPassword = '$2b$12$hashedpassword';
      const createdUser = {
        id: 1,
        email: dto.email,
        password_hash: hashedPassword,
        tenant_id: dto.tenant_id,
        email_verified: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      bcrypt.hash = jest.fn().mockResolvedValue(hashedPassword);
      mockPrismaClient.user.findUnique.mockResolvedValue(null);
      mockPrismaClient.user.create.mockResolvedValue(createdUser);

      const result = await service.register(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 12);
      expect(mockPrismaClient.user.create).toHaveBeenCalledWith({
        data: {
          email: dto.email,
          password_hash: hashedPassword,
          tenant_id: dto.tenant_id,
          email_verified: false,
        },
      });
      expect(result).toEqual({
        id: 1,
        email: dto.email,
        tenant_id: dto.tenant_id,
        email_verified: false,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
      expect(result).not.toHaveProperty('password_hash');
    });

    it('should throw BadRequestException if email already exists', async () => {
      const dto = { email: 'existing@example.com', password: 'password123', tenant_id: 1 };
      mockPrismaClient.user.findUnique.mockResolvedValue({ id: 1, email: dto.email });

      await expect(service.register(dto)).rejects.toThrow('Email already registered');
    });
  });

  describe('validateUserByEmail', () => {
    it('should return User without password_hash when user exists', async () => {
      const email = 'test@example.com';
      const user = {
        id: 1,
        email,
        password_hash: 'hash',
        tenant_id: 1,
        email_verified: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(user);

      const result = await service.validateUserByEmail(email);

      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({ where: { email } });
      expect(result).toEqual({
        id: 1,
        email,
        tenant_id: 1,
        email_verified: true,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
      expect(result).not.toHaveProperty('password_hash');
    });

    it('should return null when user does not exist', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);
      const result = await service.validateUserByEmail('nonexistent@example.com');
      expect(result).toBeNull();
    });
  });

  describe('validateUser', () => {
    it('should return User without password_hash when user exists', async () => {
      const userId = 1;
      const user = {
        id: userId,
        email: 'test@example.com',
        password_hash: 'hash',
        tenant_id: 1,
        email_verified: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(user);

      const result = await service.validateUser(userId);

      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({ where: { id: userId } });
      expect(result).toEqual({
        id: userId,
        email: user.email,
        tenant_id: 1,
        email_verified: true,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
      expect(result).not.toHaveProperty('password_hash');
    });

    it('should return null when user does not exist', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);
      const result = await service.validateUser(999);
      expect(result).toBeNull();
    });
  });

  describe('validatePassword', () => {
    it('should return true when password matches hash', async () => {
      bcrypt.compare = jest.fn().mockResolvedValue(true);
      const result = await service.validatePassword('plain', 'hash');
      expect(bcrypt.compare).toHaveBeenCalledWith('plain', 'hash');
      expect(result).toBe(true);
    });

    it('should return false when password does not match', async () => {
      bcrypt.compare = jest.fn().mockResolvedValue(false);
      const result = await service.validatePassword('wrong', 'hash');
      expect(result).toBe(false);
    });
  });

  describe('login', () => {
    it('should find user by email and tenant_id, validate password, and issue JWT tokens', async () => {
      const dto = { email: 'test@example.com', password: 'password123' };
      const tenantId = 1;
      const user = {
        id: 1,
        email: dto.email,
        password_hash: 'hashed',
        tenant_id: tenantId,
        email_verified: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaClient.user.findFirst.mockResolvedValue(user);
      bcrypt.compare = jest.fn().mockResolvedValue(true);
      mockJwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      bcrypt.hash = jest.fn().mockResolvedValue('hashed-refresh-token');
      mockPrismaClient.refreshToken.create.mockResolvedValue({});

      const result = await service.login(dto, tenantId);

      expect(mockPrismaClient.user.findFirst).toHaveBeenCalledWith({
        where: { email: dto.email, tenant_id: tenantId },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(dto.password, 'hashed');
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        1,
        { sub: user.id, email: user.email, tenant_id: user.tenant_id },
        { expiresIn: '15m', secret: 'test-secret' },
      );
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        2,
        { sub: user.id, email: user.email, tenant_id: user.tenant_id },
        { expiresIn: '7d', secret: 'test-secret' },
      );
      expect(bcrypt.hash).toHaveBeenCalledWith('refresh-token', 12);
      expect(mockPrismaClient.refreshToken.create).toHaveBeenCalledWith({
        data: {
          user_id: user.id,
          token_hash: 'hashed-refresh-token',
          expires_at: expect.any(Date),
          revoked: false,
        },
      });
      expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const dto = { email: 'nonexistent@example.com', password: 'password123' };
      mockPrismaClient.user.findFirst.mockResolvedValue(null);

      await expect(service.login(dto, 1)).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      const dto = { email: 'test@example.com', password: 'wrong' };
      const user = {
        id: 1,
        email: dto.email,
        password_hash: 'hashed',
        tenant_id: 1,
      };

      mockPrismaClient.user.findFirst.mockResolvedValue(user);
      bcrypt.compare = jest.fn().mockResolvedValue(false);

      await expect(service.login(dto, 1)).rejects.toThrow('Invalid credentials');
    });
  });

  describe('logout', () => {
    it('should revoke the refresh token by finding it via bcrypt.compare', async () => {
      const refreshToken = 'plain-token';
      const userId = 1;
      const storedToken1 = { id: 1, token_hash: 'hash1', revoked: false };
      const storedToken2 = { id: 2, token_hash: 'hash2', revoked: false };

      mockPrismaClient.refreshToken.findMany.mockResolvedValue([storedToken1, storedToken2]);
      bcrypt.compare = jest.fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await service.logout(refreshToken, userId);

      expect(mockPrismaClient.refreshToken.findMany).toHaveBeenCalledWith({
        where: { user_id: userId, revoked: false },
      });
      expect(mockPrismaClient.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { revoked: true },
      });
    });

    it('should throw UnauthorizedException if token not found', async () => {
      const refreshToken = 'plain-token';
      const userId = 1;
      mockPrismaClient.refreshToken.findMany.mockResolvedValue([]);

      await expect(service.logout(refreshToken, userId)).rejects.toThrow('Invalid refresh token');
    });

    it('should throw BadRequestException if refreshToken is empty', async () => {
      await expect(service.logout('', 1)).rejects.toThrow('Refresh token required');
    });
  });

  describe('requestPasswordReset', () => {
    it('should generate token, store as plain text in token_hash, and log', async () => {
      const email = 'test@example.com';
      const tenantId = 1;
      const user = {
        id: 1,
        email,
        tenant_id: tenantId,
      };

      mockPrismaClient.user.findFirst.mockResolvedValue(user);
      const mockUuid = 'generated-uuid';
      global.v4 = jest.fn().mockReturnValue(mockUuid);
      mockPrismaClient.passwordResetToken.create.mockResolvedValue({});

      await service.requestPasswordReset(email, tenantId);

      expect(mockPrismaClient.user.findFirst).toHaveBeenCalledWith({
        where: { email, tenant_id: tenantId },
      });
      expect(mockPrismaClient.passwordResetToken.create).toHaveBeenCalledWith({
        data: {
          user_id: user.id,
          token_hash: mockUuid,
          expires_at: expect.any(Date),
          used: false,
        },
      });
    });

    it('should return silently if user does not exist', async () => {
      mockPrismaClient.user.findFirst.mockResolvedValue(null);
      const mockUuid = 'generated-uuid';
      global.v4 = jest.fn().mockReturnValue(mockUuid);

      await service.requestPasswordReset('nonexistent@example.com', 1);

      expect(mockPrismaClient.passwordResetToken.create).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should verify token, update password, mark token used, and revoke all refresh tokens', async () => {
      const token = 'reset-token';
      const newPassword = 'newPassword123';
      const tenantId = 1;
      const user = {
        id: 1,
        email: 'test@example.com',
        tenant_id: tenantId,
        password_hash: 'old-hash',
      };
      const resetRecord = {
        id: 1,
        user_id: user.id,
        token_hash: token,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
        used: false,
        user,
      };

      mockPrismaClient.passwordResetToken.findFirst.mockResolvedValue(resetRecord);
      bcrypt.hash = jest.fn().mockResolvedValue('new-hash');
      mockPrismaClient.user.update.mockResolvedValue({});
      mockPrismaClient.refreshToken.updateMany.mockResolvedValue({});

      await service.resetPassword(token, newPassword, tenantId);

      expect(mockPrismaClient.passwordResetToken.findFirst).toHaveBeenCalledWith({
        where: {
          token_hash: token,
          used: false,
          expires_at: { gt: expect.any(Date) },
        },
        include: { user: true },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { password_hash: 'new-hash' },
      });
      expect(mockPrismaClient.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: resetRecord.id },
        data: { used: true },
      });
      expect(mockPrismaClient.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { user_id: user.id, revoked: false },
        data: { revoked: true },
      });
    });

    it('should throw UnauthorizedException if token not found or expired', async () => {
      mockPrismaClient.passwordResetToken.findFirst.mockResolvedValue(null);

      await expect(service.resetPassword('token', 'newPass', 1)).rejects.toThrow('Invalid or expired password reset token');
    });

    it('should throw UnauthorizedException if user tenant_id does not match', async () => {
      const token = 'reset-token';
      const user = { id: 1, tenant_id: 2 };
      const resetRecord = {
        id: 1,
        token_hash: token,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
        used: false,
        user,
      };

      mockPrismaClient.passwordResetToken.findFirst.mockResolvedValue(resetRecord);

      await expect(service.resetPassword(token, 'newPass', 1)).rejects.toThrow('Tenant mismatch for password reset');
    });
  });
});
