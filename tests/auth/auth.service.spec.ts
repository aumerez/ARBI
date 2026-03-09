import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../src/auth/auth.service';
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

    it('should prevent duplicate emails (case-insensitive)', async () => {
      // RED: Test to be implemented
    });

    it('should enforce password complexity rules', async () => {
      // RED: Test to be implemented
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
});
