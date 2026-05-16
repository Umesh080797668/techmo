import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsArray, IsOptional, IsNumber, Min, ValidateNested, IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @ApiProperty() @IsString() productId: string;
  @ApiProperty() @IsString() productName: string;
  @ApiProperty() @IsString() sku: string;
  @ApiPropertyOptional() @IsString() @IsOptional() imei?: string;
  @ApiProperty() @IsInt() @Min(1) quantity: number;
  @ApiProperty() @IsNumber() unitPrice: number;
  @ApiProperty() @IsNumber() discountAmount: number;
  @ApiProperty() @IsString() inventoryId: string;
}

export class CreateOrderDto {
  @ApiPropertyOptional() @IsString() @IsOptional() customerId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() walkInName?: string;
  @ApiProperty() @IsString() cashierId: string;
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiPropertyOptional() @IsNumber() @IsOptional() discountAmount?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() loyaltyPointsToRedeem?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() paymentMethod?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}

export class VoidOrderDto {
  @ApiProperty() @IsString() reason: string;
  @ApiProperty({ description: 'Manager PIN hash' }) @IsString() managerPinHash: string;
  @ApiProperty() @IsString() voidedBy: string;
}
