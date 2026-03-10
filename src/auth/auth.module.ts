import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../shared/database/database.module';
import { ProviderModule } from '../shared/infrastructure/providers/provider.module';
import { EmailService } from '../shared/infrastructure/email.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TenantGuard } from './guards/tenant.guard';
import { VerifiedGuard } from './guards/verified.guard';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
    DatabaseModule,
    ProviderModule,
  ],
  controllers: [AuthController],
  providers: [
    EmailService,
    AuthService,
    JwtStrategy,
    LocalStrategy,
    JwtAuthGuard,
    TenantGuard,
    VerifiedGuard,
  ],
  exports: [AuthService, JwtAuthGuard, TenantGuard],
})
export class AuthModule {}
