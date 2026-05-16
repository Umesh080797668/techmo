import { Controller, Get, Post, Delete, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { CompatibilityService } from './compatibility.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddCompatibilityDto {
  @ApiProperty() @IsString() productId: string;
  @ApiProperty() @IsString() deviceModelId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

@ApiTags('Compatibility')
@ApiBearerAuth()
@Controller('compatibility')
export class CompatibilityController {
  constructor(private readonly service: CompatibilityService) {}

  @Post()
  @ApiOperation({ summary: 'Link a product to a device model' })
  add(@Body() dto: AddCompatibilityDto) {
    return this.service.add(dto);
  }

  @Get('product/:productId')
  @ApiOperation({ summary: 'Get all compatible device models for a product' })
  getByProduct(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.service.getByProduct(productId);
  }

  @Get('device/:deviceModelId')
  @ApiOperation({ summary: 'Get all compatible parts for a device model' })
  getByDevice(@Param('deviceModelId', ParseUUIDPipe) deviceModelId: string) {
    return this.service.getByDevice(deviceModelId);
  }

  @Get('check')
  @ApiOperation({ summary: 'Verify if a part is compatible with a device' })
  check(
    @Query('productId') productId: string,
    @Query('deviceModelId') deviceModelId: string,
  ) {
    return this.service.check(productId, deviceModelId);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
