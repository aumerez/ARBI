import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { User } from '../types/user.entity';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(LocalStrategy.name);

  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: false,
    });
  }

  async validate(email: string, password: string): Promise<User> {
    this.logger.log(`Validating credentials for user: ${email}`);

    const user = await this.authService.validateUserByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await this.authService.validatePassword(
      password,
      user.password_hash
    );
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }
}
