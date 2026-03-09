export interface User {
  id: number;
  email: string;
  tenant_id: number;
  email_verified: boolean;
  created_at: Date;
  updated_at: Date;
}
