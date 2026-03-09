import { IsInt, IsString, IsEnum, IsOptional } from 'class-validator';
import { DocumentStatus } from '@prisma/client';

export class DocumentResponseDto {
  @IsInt()
  id: number;

  @IsString()
  filename: string;

  @IsString()
  mimetype: string;

  @IsInt()
  size: number;

  @IsEnum(DocumentStatus)
  status: DocumentStatus;

  @IsOptional()
  @IsString()
  error_message?: string;

  // Dates are validated by TypeScript type; class-validator doesn't need explicit decorator
  created_at: Date;
}
