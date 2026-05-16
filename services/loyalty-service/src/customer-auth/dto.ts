import { IsString, IsEmail, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() phone: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @MinLength(6) password: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
}

export class LoginDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() password: string;
}

export class OtpRequestDto {
  @ApiProperty() @IsString() phone: string;
}

export class OtpVerifyDto {
  @ApiProperty() @IsString() phone: string;
  @ApiProperty() @IsString() otp: string;
}

export class EmailOtpRequestDto {
  @ApiProperty() @IsEmail() email: string;
}

export class EmailOtpVerifyDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() otp: string;
}

export class ForgotPasswordDto {
  @ApiProperty() @IsEmail() email: string;
}

export class ResetPasswordDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() otp: string;
  @ApiProperty() @IsString() @MinLength(6) password: string;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() currentPassword: string;
  @ApiProperty() @IsString() @MinLength(6) newPassword: string;
}
