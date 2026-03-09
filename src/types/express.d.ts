import { JwtPayload } from '../auth/types/jwt-payload.interface';

declare global {
  namespace Express {
    export interface Request {
      user?: JwtPayload;
      tenant_id?: number;
    }
  }
}
