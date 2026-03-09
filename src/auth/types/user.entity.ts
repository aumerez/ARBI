export interface User {
  id: number;
  email: string;
  tenant_id: number;
  email_verified: boolean;
  created_at: Date;
  updated_at: Date;
  // Used internally for authentication; excluded from API responses
  password_hash?: string;
}
