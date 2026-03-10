import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../src/auth/auth.service';
import { EmailService } from '../../src/shared/infrastructure/email.service';
import { DatabaseService } from '../../src/shared/database/database.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';

// Mock Prisma-like interface
const createMockPrisma = () => ({
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  verificationToken: {
    create: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
});

describe('AuthService - Email Verification (AUTH-01)', () => {
  let service: AuthService;
  let emailService: jest.Mocked<EmailService>;
  let databaseService: jest.Mocked<DatabaseService>;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    tenant_id: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    mockPrisma = createMockPrisma();

    emailService = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    } as any;

    databaseService = {
      getPrismaClient: jest.fn(() => mockPrisma as any),
    } as any;

    const jwtService = {
      sign: jest.fn(() => 'mock.jwt.token'),
    } as any;

    const configService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          JWT_SECRET: 'test-secret',
        };
        return config[key];
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: EmailService, useValue: emailService },
        { provide: DatabaseService, useValue: databaseService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should create user with email_verified=false', async () => {
      mockPrisma.user.findUnique.mockResolve(null);
      mockPrisma.user.create.mockResolvedValue({ ...mockUser, email_verified: false });

      const result = await service.register({
        email: 'test@example.com',
        password: 'Password123',
        tenant_id: 1,
      });

      expect(result).toBeDefined();
      expect((result as any).email_verified).toBe(false);
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          tenant_id: 1,
          email_verified: false,
        }),
      );
    });

    it('should generate verification token and send email', async () => {
      mockPrisma.user.findUnique.mockResolve(null);
      mockPrisma.user.create.mockResolvedValue({ ...mockUser, email_verified: false });
      mockPrisma.verificationToken.create.mockResolvedValue({} as any);

      await service.register({
        email: 'test@example.com',
        password: 'Password123',
        tenant_id: 1,
      });

      expect(mockPrisma.verificationToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUser.id,
          tenant_id: mockUser.tenant_id,
          token: expect.any(String),
          expires_at: expect.any(Date),
        }),
      );
      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String),
      );
    });
  });

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      const verificationRecord = {
        id: 1,
        token: 'valid-token',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // future
        user: mockUser,
      };
      mockPrisma.verificationToken.findFirst.mockResolvedValue(verificationRecord as any);

      const result = await service.verifyEmail('valid-token');

      expect(result.message).toBe('Email verified successfully');
      expect(result.verified).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { email_verified: true },
      });
      expect(mockPrisma.verificationToken.delete).toHaveBeenCalledWith({
        where: { id: verificationRecord.id },
      });
    });

    it('should reject invalid or expired token', async () => {
      mockPrisma.verificationToken.findFirst.mockResolvedValue(null);

      await expect(service.verifyEmail('invalid-token')).rejects.toThrow(NotFoundException);
    });

    it('should handle already verified user', async () => {
      const verificationRecord = {
        id: 1,
        token: 'valid-token',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        user: { ...mockUser, email_verified: true },
      };
      mockPrisma.verificationToken.findFirst.mockResolvedValue(verificationRecord as any);

      const result = await service.verifyEmail('valid-token');

      expect(result.message).toBe('Email already verified');
      expect(result.verified).toBe(true);
    });
  });
});
