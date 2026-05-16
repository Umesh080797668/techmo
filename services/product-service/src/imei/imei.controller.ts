import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ImeiService } from './imei.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('IMEI / Serial')
@ApiBearerAuth()
@Controller('imei')
export class ImeiController {
  constructor(private readonly service: ImeiService) {}

  @Get()
  @ApiOperation({ summary: 'List all IMEI / serial records' })
  findAll(@Query() query: { status?: string; productId?: string; page?: string; limit?: string }) {
    return this.service.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Register a new IMEI / serial number' })
  register(@Body() dto: { productId: string; imei: string; serialNumber?: string; color?: string; storage?: string }) {
    return this.service.register(dto);
  }

  @Get(':imei')
  @ApiOperation({ summary: 'Look up a device by IMEI' })
  findByImei(@Param('imei') imei: string) {
    return this.service.findByImei(imei);
  }

  @Get('product/:productId')
  @ApiOperation({ summary: 'Get all IMEI records for a product' })
  getByProduct(@Param('productId') productId: string) {
    return this.service.getByProduct(productId);
  }

  @Patch(':imei/status')
  @ApiOperation({ summary: 'Update IMEI status (SOLD, RETURNED, SCRAPPED)' })
  updateStatus(@Param('imei') imei: string, @Body() dto: { status: string }) {
    return this.service.updateStatus(imei, dto.status);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk-register multiple IMEI / serial numbers for one product' })
  bulkRegister(
    @Body() dto: { productId: string; numbers: string[]; mode: 'imei' | 'serial' },
  ) {
    return this.service.bulkRegister(dto);
  }
}
