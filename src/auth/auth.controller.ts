import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Get,
  Param,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordResetRequestDto, PasswordResetConfirmDto } from './dto/password-reset.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TenantGuard } from './guards/tenant.guard';
import { User } from './types/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<User> {
    return this.authService.register(registerDto);
  }

  @Get('verify/:token')
  async verifyEmail(@Param('token') token: string) {
    const result = await this.authService.verifyEmail(token);
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto & { tenant_id: number }) {
    // tenant_id is provided in the DTO (from request body)
    const { accessToken, refreshToken } = await this.authService.login(
      loginDto,
      loginDto.tenant_id,
    );
    return { accessToken, refreshToken };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: any) {
    const userId = req.user.sub;
    await this.authService.logout(userId);
    return;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string, @Req() req: any) {
    // Extract user ID from JWT payload (set by JwtAuthGuard)
    // The JWT token must be valid to reach this point
    const userId = req.user.sub;
    const result = await this.authService.refreshTokens(userId, refreshToken);
    return result;
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.NO_CONTENT)
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto & { tenant_id: number }) {
    await this.authService.requestPasswordReset(dto.email, dto.tenant_id);
    return;
  }

  @Post('password-reset/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Param('token') token: string,
    @Body() dto: PasswordResetConfirmDto & { tenant_id: number },
  ) {
    await this.authService.resetPassword(token, dto.newPassword, dto.tenant_id);
    return;
  }
}
