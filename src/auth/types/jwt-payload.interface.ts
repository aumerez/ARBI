export interface JwtPayload {
  sub: number; // userId
  email: string;
  tenant_id: number;
  iat: number;
  exp: number;
}
