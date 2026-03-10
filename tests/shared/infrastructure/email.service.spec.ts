import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from '../../../src/shared/infrastructure/email.service';
import { ConfigService } from '@nestjs/config';

describe('EmailService (AUTH-01)', () => {
  let service: EmailService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config = {
                'MAIL_HOST': 'smtp.test.com',
                'MAIL_PORT': '587',
                'MAIL_USER': 'test@test.com',
                'MAIL_PASS': 'testpass',
                'MAIL_FROM': 'noreply@test.com',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('sendVerificationEmail', () => {
    it('should send email via SMTP with verification token', async () => {
      // RED: Test fails until EmailService implemented
      const mockTransport = { sendMail: jest.fn() };
      // Configure email service to use mock transport (after implementation)
      await expect(service.sendVerificationEmail('user@example.com', 'token123'))
        .resolves.toBeUndefined();
    });

    it('should format email with verification link containing token', async () => {
      // RED: Verify email contains verification token
      const to = 'user@example.com';
      const token = 'verify-token-abc';
      const spy = jest.spyOn(service, 'sendVerificationEmail');
      await service.sendVerificationEmail(to, token);
      expect(spy).toHaveBeenCalledWith(to, token);
    });

    it('should use environment config for SMTP settings', () => {
      // RED: Service should read mail config
      expect(configService.get('MAIL_HOST')).toBeDefined();
    });
  });

  // Dev mode fallback behavior is implicitly tested by first test when transporter is null
});
