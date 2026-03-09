import { Test, TestingModule } from '@nestjs/testing';
import { EncryptionService } from './encryption.service';
import { ConfigService } from '@nestjs/config';

describe('EncryptionService', () => {
  let service: EncryptionService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
              if (key === 'ENCRYPTION_KEY') return 'test-encryption-key-32-bytes-long!!';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encrypt', () => {
    it('should encrypt plaintext and return ciphertext with iv and auth tag', async () => {
      const plaintext = 'sensitive data';
      const ciphertext = await service.encrypt(plaintext);

      // Should return a base64 string containing iv, auth tag, and ciphertext
      expect(typeof ciphertext).toBe('string');
      expect(ciphertext.length).toBeGreaterThan(0);

      // Decode base64 to verify structure
      const decoded = Buffer.from(ciphertext, 'base64');
      // Should contain at least: 12-byte IV + 16-byte auth tag + ciphertext
      expect(decoded.length).toBeGreaterThan(28);
    });

    it('should produce different ciphertexts for same plaintext (IV randomization)', async () => {
      const plaintext = 'same data';
      const ciphertext1 = await service.encrypt(plaintext);
      const ciphertext2 = await service.encrypt(plaintext);

      expect(ciphertext1).not.toEqual(ciphertext2);
    });
  });

  describe('decrypt', () => {
    it('should decrypt ciphertext back to original plaintext', async () => {
      const plaintext = 'secret message';
      const ciphertext = await service.encrypt(plaintext);
      const decrypted = await service.decrypt(ciphertext);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle round-trip with various plaintexts', async () => {
      const testCases = [
        'simple text',
        'Special chars: !@#$%^&*()',
        'Unicode: 你好 مرحبا',
        'Long text: '.repeat(100),
        '', // empty string
      ];

      for (const plaintext of testCases) {
        const ciphertext = await service.encrypt(plaintext);
        const decrypted = await service.decrypt(ciphertext);
        expect(decrypted).toBe(plaintext);
      }
    });

    it('should throw error for corrupted ciphertext', async () => {
      await expect(service.decrypt('invalid-base64!!')).rejects.toThrow();
    });

    it('should throw error for ciphertext encrypted with different key', async () => {
      // Encrypt with service
      const plaintext = 'secret';
      const ciphertext = await service.encrypt(plaintext);

      // Create service with different key
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue('different-key-32-bytes-long!!'),
            },
          },
        ],
      }).compile();

      const otherService = module.get<EncryptionService>(EncryptionService);

      await expect(otherService.decrypt(ciphertext)).rejects.toThrow();
    });
  });

  describe('key derivation', () => {
    it('should derive key from ENCRYPTION_KEY env var', () => {
      // Access private method via type assertion for testing
      const serviceAny = service as any;
      expect(serviceAny.encryptionKey.length).toBe(32); // AES-256 key is 32 bytes
    });

    it('should use consistent key derivation for same env var', async () => {
      // Two services with same key should encrypt differently (IV) but decrypt correctly
      const plaintext = 'test data';
      const ciphertext1 = await service.encrypt(plaintext);

      // Create another service with same key
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue('test-encryption-key-32-bytes-long!!'),
            },
          },
        ],
      }).compile();

      const service2 = module.get<EncryptionService>(EncryptionService);
      const ciphertext2 = await service2.encrypt(plaintext);

      // Different IVs means different ciphertexts
      expect(ciphertext1).not.toEqual(ciphertext2);

      // But each can decrypt its own
      const decrypted1 = await service.decrypt(ciphertext1);
      const decrypted2 = await service2.decrypt(ciphertext2);
      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', async () => {
      const plaintext = '';
      const ciphertext = await service.encrypt(plaintext);
      const decrypted = await service.decrypt(ciphertext);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle large plaintext', async () => {
      const plaintext = 'a'.repeat(10000);
      const ciphertext = await service.encrypt(plaintext);
      const decrypted = await service.decrypt(ciphertext);
      expect(decrypted).toBe(plaintext);
    });
  });
});
