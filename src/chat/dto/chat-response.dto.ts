import { IsInt, IsString, IsOptional } from 'class-validator';

export class ChatResponseDto {
  @IsInt()
  id: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsInt()
  user_id: number;

  @IsInt()
  tenant_id: number;

  // Dates are validated by TypeScript type; class-validator doesn't need explicit decorator
  created_at: Date;

  updated_at: Date;
}
