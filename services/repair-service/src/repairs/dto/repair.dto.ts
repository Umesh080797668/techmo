import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RepairPartDto {
  @ApiPropertyOptional() @IsString() @IsOptional() productId?: string;
  @ApiProperty() @IsString() productName: string;
  @ApiPropertyOptional() @IsString() @IsOptional() sku?: string;
  @ApiProperty() @IsNumber() quantity: number;
  @ApiProperty() @IsNumber() unitCost: number;
  @ApiPropertyOptional() @IsString() @IsOptional() inventoryId?: string;
}

export class CreateRepairDto {
  @ApiPropertyOptional() @IsString() @IsOptional() customerId?: string;
  @ApiProperty() @IsString() customerName: string;
  @ApiProperty() @IsString() customerPhone: string;
  @ApiProperty() @IsString() deviceBrand: string;
  @ApiProperty() @IsString() deviceModel: string;
  @ApiPropertyOptional() @IsString() @IsOptional() imei?: string;
  @ApiProperty() @IsString() issueDescription: string;
  @ApiPropertyOptional() @IsString() @IsOptional() technicianId?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() estimatedCost?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}

export class UpdateRepairStatusDto {
  @ApiProperty({
    enum: ['PENDING_DIAGNOSIS','AWAITING_PARTS','UNDER_REPAIR','READY_FOR_PICKUP','COMPLETED','CANCELLED'],
  })
  @IsString() status: string;

  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() finalCost?: number;
}

export class AddRepairPartDto {
  @ApiProperty({ type: [RepairPartDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RepairPartDto)
  parts: RepairPartDto[];
}

export class UpdateRepairDto {
  @ApiPropertyOptional() @IsString() @IsOptional() technicianId?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() estimatedCost?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() finalCost?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}
