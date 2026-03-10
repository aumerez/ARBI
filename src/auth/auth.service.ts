import { Injectable, Logger, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../shared/database/database.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from './types/user.entity';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../shared/infrastructure/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto): Promise<User> {
    const { email, password, tenant_id } = dto;

    // Check if user exists with same email (globally unique)
    const prisma = this.database.getPrismaClient();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    // Hash password with bcrypt (12 rounds)
    const password_hash = await bcrypt.hash(password, 12);

    // Create user with unverified email
    const user = await prisma.user.create({
      data: {
        email,
        password_hash,
        tenant_id,
        email_verified: false,
      },
    });

    // Generate verification token with 24-hour expiry
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.verificationToken.create({
      data: {
        user_id: user.id,
        tenant_id: user.tenant_id,
        token,
        expires_at: expiresAt,
      },
    });

    // Send verification email (non-blocking, failures logged but not thrown)
    try {
      await this.emailService.sendVerificationEmail(user.email, token);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${user.email}:`, error);
    }

    this.logger.log(`User registered: ${email} (tenant ${tenant_id}), verification token generated`);

    // Return user without password_hash
    const { password_hash: _, ...userWithoutPassword } = user;
    // Also return a message to prompt email verification
    return {
      ...userWithoutPassword,
      message: 'Check your email to verify your account',
    } as User & { message: string };
  }

  async verifyEmail(token: string): Promise<{ message: string; verified: boolean }> {
    const prisma = this.database.getPrismaClient();

    // Find valid, unexpired verification token
    const verificationRecord = await prisma.verificationToken.findFirst({
      where: {
        token,
        expires_at: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!verificationRecord) {
      throw new NotFoundException('Invalid or expired verification token');
    }

    const user = verificationRecord.user;

    if (user.email_verified) {
      // Already verified - return success with message
      return {
        message: 'Email already verified',
        verified: true,
      };
    }

    // Mark email as verified
    await prisma.user.update({
      where: { id: user.id },
      data: { email_verified: true },
    });

    // Delete used verification token
    await prisma.verificationToken.delete({
      where: { id: verificationRecord.id },
    });

    this.logger.log(`Email verified for user ${user.id} (${user.email})`);

    return {
      message: 'Email verified successfully',
      verified: true,
    };
  }

  async validateUserByEmail(email: string): Promise<User | null> {
    const prisma = this.database.getPrismaClient();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return null;
    }
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  async validateUser(userId: number): Promise<User | null> {
    const prisma = this.database.getPrismaClient();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return null;
    }
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  async validatePassword(plain: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(plain, hash);
  }

  async login(dto: LoginDto, tenantId: number): Promise<{ accessToken: string; refreshToken: string }> {
    const prisma = this.database.getPrismaClient();

    // Find user by email AND tenant_id (ensures tenant isolation)
    const user = await prisma.user.findFirst({
      where: { email: dto.email, tenant_id: tenantId },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Build JWT payload
    const payload = {
      sub: user.id,
      email: user.email,
      tenant_id: user.tenant_id,
    };

    // Issue access token (15 minutes)
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
      secret: this.config.get<string>('JWT_SECRET'),
    });

    // Issue refresh token (7 days)
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
      secret: this.config.get<string>('JWT_SECRET'),
    });

    // Store hashed refresh token in DB (never store plaintext)
    const tokenHash = await bcrypt.hash(refreshToken, 12);
    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        tenant_id: user.tenant_id,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revoked: false,
      },
    });

    this.logger.log(`User logged in: ${user.email} (tenant ${tenantId})`);

    return { accessToken, refreshToken };
  }

  async logout(refreshToken: string, userId: number): Promise<void> {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token required');
    }

    const prisma = this.database.getPrismaClient();

    // Retrieve all non-revoked refresh tokens for user
    const tokens = await prisma.refreshToken.findMany({
      where: { user_id: userId, revoked: false },
    });

    // Find matching token by comparing plaintext with stored hash
    let matchedToken = null;
    for (const token of tokens) {
      const valid = await bcrypt.compare(refreshToken, token.token_hash);
      if (valid) {
        matchedToken = token;
        break;
      }
    }

    if (!matchedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Revoke the token
    await prisma.refreshToken.update({
      where: { id: matchedToken.id },
      data: { revoked: true },
    });

    this.logger.log(`User logged out: userId ${userId}`);
  }

  async requestPasswordReset(email: string, tenantId: number): Promise<void> {
    const prisma = this.database.getPrismaClient();

    // Find user by email AND tenant_id
    const user = await prisma.user.findFirst({
      where: { email, tenant_id: tenantId },
    });

    if (!user) {
      // Don't leak existence; just log and return success
      this.logger.warn(`Password reset requested for non-existent user: ${email} (tenant ${tenantId})`);
      return;
    }

    // Generate reset token (UUID)
    const token = randomUUID();
    // For MVP simplicity, store token as plaintext in token_hash field
    // In production, we would store a hashed version using selector-validator pattern
    const tokenHash = token;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        user_id: user.id,
        tenant_id: user.tenant_id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        used: false,
      },
    });

    // Mock email sending: just log token
    this.logger.log(`Password reset token for ${email}: ${token} (expires ${expiresAt.toISOString()})`);

    // TODO: Send email with reset link containing token
  }

  async resetPassword(token: string, newPassword: string, tenantId: number): Promise<void> {
    const prisma = this.database.getPrismaClient();

    // Find valid, unused reset token by plain token equality
    const resetRecord = await prisma.passwordResetToken.findFirst({
      where: {
        token_hash: token,
        used: false,
        expires_at: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!resetRecord) {
      throw new UnauthorizedException('Invalid or expired password reset token');
    }

    // Verify user belongs to tenantId
    if (resetRecord.user.tenant_id !== tenantId) {
      throw new UnauthorizedException('Tenant mismatch for password reset');
    }

    // Hash new password
    const password_hash = await bcrypt.hash(newPassword, 12);

    // Update user password
    await prisma.user.update({
      where: { id: resetRecord.user_id },
      data: { password_hash },
    });

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { used: true },
    });

    // Invalidate all refresh tokens for this user (security measure)
    await prisma.refreshToken.updateMany({
      where: { user_id: resetRecord.user_id, revoked: false },
      data: { revoked: true },
    });

    this.logger.log(`Password reset successful for user ${resetRecord.user_id}`);
  }
}
