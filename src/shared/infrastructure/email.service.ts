import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * EmailService - Handles sending verification and password reset emails
 *
 * MVP: Uses SMTP via nodemailer. Falls back to console.log in development.
 * Future: Could integrate with SendGrid, SES, or other transactional email providers.
 */
@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly isDevelopment = process.env.NODE_ENV === 'development';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.initializeTransporter();
  }

  onModuleDestroy() {
    if (this.transporter) {
      this.transporter.close();
    }
  }

  /**
   * Send email verification message
   * Contains a link with token for the user to verify their email address
   */
  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const verificationUrl = `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/verify-email?token=${token}`;

    const mailOptions = {
      from: this.configService.get<string>('MAIL_FROM'),
      to,
      subject: 'Verify your email address',
      html: `
        <h1>Welcome! Please verify your email</h1>
        <p>Click the link below to verify your email address:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>This link will expire in 24 hours.</p>
      `,
      text: `Welcome! Please verify your email by visiting: ${verificationUrl}\nThis link will expire in 24 hours.`,
    };

    if (this.isDevelopment || !this.transporter) {
      // Mock mode: log to console instead of sending real email
      this.logger.log(`[DEV MODE] Verification email to: ${to}`);
      this.logger.log(`[DEV MODE] Verification URL: ${verificationUrl}`);
      this.logger.log(`[DEV MODE] mailOptions: ${JSON.stringify(mailOptions, null, 2)}`);
      return;
    }

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Verification email sent to ${to}: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${to}:`, error);
      // Don't throw - continue registration even if email fails (non-critical)
    }
  }

  /**
   * Send password reset email
   * Contains a link with token for the user to reset their password
   */
  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const resetUrl = `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token=${token}`;

    const mailOptions = {
      from: this.configService.get<string>('MAIL_FROM'),
      to,
      subject: 'Reset your password',
      html: `
        <h1>Password Reset Request</h1>
        <p>Click the link below to reset your password:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request a password reset, you can safely ignore this email.</p>
      `,
      text: `Password reset link: ${resetUrl}\nThis link will expire in 1 hour.`,
    };

    if (this.isDevelopment || !this.transporter) {
      this.logger.log(`[DEV MODE] Password reset email to: ${to}`);
      this.logger.log(`[DEV MODE] Reset URL: ${resetUrl}`);
      return;
    }

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset email sent to ${to}: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}:`, error);
    }
  }

  /**
   * Initialize SMTP transporter from environment configuration
   */
  private initializeTransporter(): void {
    const host = this.configService.get<string>('MAIL_HOST');
    const port = this.configService.get<number>('MAIL_PORT');
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASS');

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: { user, pass },
      });

      // Verify transporter configuration
      this.transporter.verify((error) => {
        if (error) {
          this.logger.warn(`SMTP transporter verification failed: ${error.message}. Email delivery disabled.`);
          this.transporter = null;
        } else {
          this.logger.log('SMTP transporter configured successfully');
        }
      });
    } else {
      this.logger.warn('Mail configuration incomplete (MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS). Email delivery disabled.');
    }
  }
}
