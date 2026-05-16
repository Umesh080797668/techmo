import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum PhotoPhase {
  BEFORE = 'BEFORE',
  DURING = 'DURING',
  AFTER  = 'AFTER',
}

export class UploadPhotoDto {
  @IsEnum(PhotoPhase)
  phase: PhotoPhase;

  @IsOptional()
  @IsString()
  caption?: string;
}
