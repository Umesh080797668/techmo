import { IsOptional, IsString } from 'class-validator';

export class CompleteSignedDto {
  /** Base64 data URL of the customer's signature (e.g. "data:image/png;base64,...") */
  @IsString()
  signatureDataUrl: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
