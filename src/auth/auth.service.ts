import { Injectable, Logger } from '@nestjs/common';
import { User } from './types/user.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Method needed by LocalStrategy
  async validateUserByEmail(email: string): Promise<User | null> {
    // Stub: will be fully implemented in plan 03c
    throw new Error('AuthService.validateUserByEmail not implemented yet');
  }

  // Method needed by LocalStrategy
  async validatePassword(plain: string, hash: string): Promise<boolean> {
    // Stub: will be fully implemented in plan 03c
    throw new Error('AuthService.validatePassword not implemented yet');
  }

  // Method needed by JwtStrategy
  async validateUser(userId: number): Promise<User | null> {
    // Stub: will be fully implemented in plan 03c
    throw new Error('AuthService.validateUser not implemented yet');
  }

  // Other methods will be added in 03c
}
