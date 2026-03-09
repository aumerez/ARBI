import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';
import { PasswordResetRequestDto, PasswordResetConfirmDto } from './password-reset.dto';

describe('Auth DTOs Validation', () => {
  describe('LoginDto', () => {
    it('should validate correct email and password', async () => {
      const dto = plainToInstance(LoginDto, {
        email: 'test@example.com',
        password: 'securepassword123',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid email', async () => {
      const dto = plainToInstance(LoginDto, {
        email: 'invalid-email',
        password: 'securepassword123',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isEmail');
    });

    it('should reject password shorter than 8 characters', async () => {
      const dto = plainToInstance(LoginDto, {
        email: 'test@example.com',
        password: 'short',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('should reject missing email', async () => {
      const dto = plainToInstance(LoginDto, {
        password: 'securepassword123',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
    });

    it('should reject missing password', async () => {
      const dto = plainToInstance(LoginDto, {
        email: 'test@example.com',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('password');
    });
  });

  describe('RegisterDto', () => {
    it('should validate correct registration data', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'securepassword123',
        tenant_id: 42,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid email', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'not-an-email',
        password: 'securepassword123',
        tenant_id: 1,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject password shorter than 8 characters', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'short',
        tenant_id: 1,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject missing tenant_id', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'securepassword123',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('tenant_id');
    });

    it('should reject tenant_id that is not an integer', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'securepassword123',
        tenant_id: 'abc',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('tenant_id');
    });
  });

  describe('PasswordResetRequestDto', () => {
    it('should validate correct email', async () => {
      const dto = plainToInstance(PasswordResetRequestDto, {
        email: 'test@example.com',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid email', async () => {
      const dto = plainToInstance(PasswordResetRequestDto, {
        email: 'invalid',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('PasswordResetConfirmDto', () => {
    it('should validate correct data', async () => {
      const dto = plainToInstance(PasswordResetConfirmDto, {
        token: 'reset-token-123',
        newPassword: 'newsecurepassword123',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject newPassword shorter than 8 characters', async () => {
      const dto = plainToInstance(PasswordResetConfirmDto, {
        token: 'reset-token-123',
        newPassword: 'short',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject missing token', async () => {
      const dto = plainToInstance(PasswordResetConfirmDto, {
        newPassword: 'newsecurepassword123',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
