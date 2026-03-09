import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { MockPostgresService } from '../mocks/postgres.service';

describe('JwtStrategy (AUTH-02)', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: 'PostgresService', useClass: MockPostgresService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  describe('validate token', () => {
    it('should validate token and extract tenant_id', async () => {
      // RED: Test to be implemented
      const payload = {
        sub: '1',
        tenant_id: 1,
        email: 'test@example.com',
      };
      const result = await strategy.validate(payload);
      expect(result).toBeDefined();
    });

    it('should reject expired token', async () => {
      // RED: Test to be implemented
    });

    it('should reject token with invalid signature', async () => {
      // RED: Test to be implemented
    });

    it('should throw if user not found in database', async () => {
      // RED: Test to be implemented
    });
  });
});
