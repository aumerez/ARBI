export interface Chat {
  id: number;
  user_id: number;
  tenant_id: number;
  title?: string;
  created_at: Date;
  updated_at: Date;
}
