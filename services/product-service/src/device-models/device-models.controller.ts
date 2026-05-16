import { Controller, Get, Post, Put, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { DeviceModelsService } from './device-models.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Device Models')
@ApiBearerAuth()
@Controller('device-models')
export class DeviceModelsController {
  constructor(private readonly service: DeviceModelsService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new device model' })
  create(@Body() dto: { brand: string; model: string; variant?: string; releaseYear?: number }) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all device models' })
  findAll(@Query('search') search?: string) {
    return this.service.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }
}
