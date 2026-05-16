import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsInt, Min, Max, IsEmail, IsEnum, IsIn, MinLength } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty() @IsString() firstName: string;
  @ApiProperty() @IsString() lastName: string;
  @ApiProperty({ description: 'Sri Lankan phone: 07XXXXXXXX' }) @IsString() phone: string;
  @ApiPropertyOptional() @IsEmail() @IsOptional() email?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() address?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() nic?: string;
  /** Optional initial portal password. If provided, the customer will be forced to change it on first login. */
  @ApiPropertyOptional() @IsString() @IsOptional() @MinLength(6) password?: string;
}

export class UpdateCustomerDto {
  @ApiPropertyOptional() @IsString() @IsOptional() firstName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() lastName?: string;
  @ApiPropertyOptional() @IsEmail() @IsOptional() email?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() address?: string;
}

export class EarnPointsDto {
  @ApiProperty() @IsString() customerId: string;
  /** Sanity cap: no single transaction should award more than 50 000 LP */
  @ApiProperty() @IsInt() @Min(1) @Max(50_000) points: number;
  /** Restricted to internal service types only — GAME_EARN is handled via the game endpoint */
  @ApiProperty({ enum: ['PURCHASE_EARN', 'REPAIR_EARN'] })
  @IsIn(['PURCHASE_EARN', 'REPAIR_EARN'], { message: 'type must be PURCHASE_EARN or REPAIR_EARN' })
  type: string;
  @ApiProperty({ description: 'Order or repair reference' }) @IsString() reference: string;
}

export class RedeemPointsDto {
  @ApiProperty() @IsString() customerId: string;
  @ApiProperty() @IsInt() @Min(1) @Max(50_000) points: number;
  @ApiProperty() @IsString() reference: string;
}

export class ManualAdjustDto {
  @ApiProperty() @IsString() customerId: string;
  @ApiProperty({ description: 'Positive to add, negative to remove. Bounded to ±50 000.' })
  @IsInt() @Min(-50_000) @Max(50_000) points: number;
  @ApiProperty() @IsString() reason: string;
}
