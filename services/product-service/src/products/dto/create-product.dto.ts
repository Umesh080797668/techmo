import { IsString, IsEnum, IsOptional, IsNumber, IsBoolean, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProductType {
  PHONE = 'PHONE',
  ACCESSORY = 'ACCESSORY',
  SPARE_PART = 'SPARE_PART',
  SERVICE = 'SERVICE',
}

export class CreateProductDto {
  @ApiProperty() @IsString() sku: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiProperty() @IsString() categoryId: string;
  @ApiPropertyOptional({ enum: ProductType }) @IsOptional() @IsEnum(ProductType) productType?: ProductType;
  @ApiPropertyOptional() @IsOptional() @IsString() brand?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() barcode?: string;
  @ApiProperty() @IsNumber() @Min(0) costPrice: number;
  @ApiProperty() @IsNumber() @Min(0) sellingPrice: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() warrantyMonths?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresImei?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresSerial?: boolean;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() images?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() tags?: string[];
}
