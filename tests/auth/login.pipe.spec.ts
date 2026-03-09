import { Test, TestingModule } from '@nestjs/testing';
import { LoginPipe } from '../src/auth/login.pipe';
import { classValidatorValidate } from '../conftest';

describe('LoginPipe', () => {
  let pipe: LoginPipe;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoginPipe],
    }).compile();

    pipe = module.get<LoginPipe>(LoginPipe);
  });

  describe('transform', () => {
    it('should validate email format', async () => {
      // RED: Test to be implemented using class-validator
      const invalidEmail = { email: 'invalid-email', password: 'any' };
      await expect(pipe.transform(invalidEmail)).rejects.toThrow();
    });

    it('should validate password presence', async () => {
      // RED: Test to be implemented
      const noPassword = { email: 'test@example.com' };
      await expect(pipe.transform(noPassword)).rejects.toThrow();
    });

    it('should accept valid login credentials', async () => {
      // RED: Test to be implemented
      const validData = { email: 'test@example.com', password: 'password123' };
      const result = await pipe.transform(validData);
      expect(result).toBeDefined();
    });
  });
});
