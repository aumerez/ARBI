import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../src/auth/auth.service';
import { MockPostgresService } from '../mocks/postgres.service';
import { UserBuilder } from '../conftest';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: 'PostgresService', useClass: MockPostgresService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register (AUTH-01)', () => {
    it('should create user with hashed password', async () => {
      // RED: Write failing test first
    });

    it('should set email_verified=false on new user', async () => {
      // RED: Test email_verified is false
    });

    it('should generate and store verification token', async () => {
      // RED: Test verification token creation
    });

    it('should send verification email via EmailService', async () => {
      // RED: Test email is sent
    });
  });

  describe('login (AUTH-02)', () => {
    it('should issue JWT tokens (15m access, 7d refresh)', async () => {
      // RED: Test to be implemented
    });

    it('should reject invalid credentials', async () => {
      // RED: Test to be implemented
    });

    it('should set httpOnly cookie with refresh token', async () => {
      // RED: Test to be implemented
    });
  });

  describe('logout (AUTH-03)', () => {
    it('should invalidate refresh token', async () => {
      // RED: Test to be implemented
    });

    it('should clear refresh cookie', async () => {
      // RED: Test to be implemented
    });
  });

  describe('password reset (AUTH-04)', () => {
    it('should generate reset token with expiry', async () => {
      // RED: Test to be implemented
    });

    it('should allow password update with valid token', async () => {
      // RED: Test to be implemented
    });

    it('should reject expired reset tokens', async () => {
      // RED: Test to be implemented
    });
  });

  describe('email verification (AUTH-01)', () => {
    it('should verify email with valid token', async () => {
      // RED: verifyEmail marks user.email_verified=true
    });

    it('should reject invalid or expired token', async () => {
      // RED: 404 on bad token
    });

    it('should handle already verified user gracefully', async () => {
      // RED: 200 with "Already verified" message
    });
  });
});
