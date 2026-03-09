import { IsEnum, IsOptional, IsInt } from 'class-validator';
import { DocumentStatus } from '@prisma/client';

export class DocumentStatusResponseDto {
  @IsInt()
  documentId: number;

  @IsEnum(DocumentStatus)
  status: DocumentStatus;

  @IsOptional()
  @IsInt()
  progress?: number; // percent

  @IsOptional()
  error_message?: string;
}
