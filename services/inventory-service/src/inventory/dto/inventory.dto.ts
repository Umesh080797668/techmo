import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateInventoryDto {
  @ApiProperty() @IsString() productId: string;
  @ApiProperty() @IsString() sku: string;
  @ApiProperty() @IsInt() @Min(0) quantity: number;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() lowStockQty?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() location?: string;
}

export class UpdateInventoryDto {
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() lowStockQty?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() location?: string;
}

export class AdjustStockDto {
  @ApiProperty({ description: 'Positive to add, negative to remove' })
  @IsNumber() quantityDelta: number;

  @ApiProperty({ example: 'ADJUSTMENT' }) @IsString() movementType: string;
  @ApiProperty() @IsString() reason: string;
  @ApiPropertyOptional() @IsString() @IsOptional() reference?: string;
  @ApiPropertyOptional({ description: 'UserId of performer' }) @IsOptional() @IsString() performedBy?: string;
}

export class ReserveStockDto {
  @ApiProperty() @IsInt() @Min(1) quantity: number;
  @ApiProperty() @IsString() reference: string;
  @ApiProperty() @IsString() performedBy: string;
}
