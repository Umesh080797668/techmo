import { IsInt, IsString, IsOptional, IsEnum, IsUrl, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewType } from '@prisma/client';

export class CreateReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt() @Min(1) @Max(5)
  rating: number;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional() @IsString() @MaxLength(120)
  title?: string;

  @ApiProperty({ maxLength: 1200 })
  @IsString() @MaxLength(1200)
  body: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUrl()
  photoUrl?: string;

  @ApiPropertyOptional({ enum: ReviewType })
  @IsOptional() @IsEnum(ReviewType)
  type?: ReviewType;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  referenceId?: string;
}

export class ModerateReviewDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsString()
  status: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional()
  @IsOptional()
  featured?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  adminNote?: string;
}
