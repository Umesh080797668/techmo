import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';

export class CreateEmployeeDto {
  @ApiPropertyOptional({ description: 'Auth service userId' }) @IsString() @IsOptional() userId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() employeeCode?: string;
  @ApiProperty() @IsString() firstName: string;
  @ApiProperty() @IsString() lastName: string;
  @ApiProperty() @IsString() email: string;
  @ApiProperty() @IsString() phone: string;
  @ApiProperty() @IsNumber() baseSalary: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() commissionPct?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() allowance?: number;
  @ApiPropertyOptional() @IsDateString() @IsOptional() hireDate?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() position?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() department?: string;
}

export class UpdateEmployeeDto {
  @ApiPropertyOptional() @IsNumber() @IsOptional() baseSalary?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() commissionPct?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() allowance?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() position?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() department?: string;
}
