import { Controller, Get, Post, Patch, Body, Param, Query, ParseUUIDPipe, Headers } from '@nestjs/common';
import { WarrantyService } from './warranty.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Warranty')
@ApiBearerAuth()
@Controller('warranty')
export class WarrantyController {
  constructor(private readonly service: WarrantyService) {}

  @Get('claims')
  @ApiOperation({ summary: 'List all warranty claims' })
  listClaims(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll();
  }

  @Get('claims/:id')
  @ApiOperation({ summary: 'Get a single warranty claim by ID' })
  getClaim(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findClaimById(id);
  }

  @Post('claims')
  @ApiOperation({ summary: 'File a warranty claim (alias for /claim)' })
  claimAlias(
    @Body() dto: { imei: string; issue: string; claimType?: string },
    @Headers('x-user-id') userId: string,
  ) {
    return this.service.claim({ ...dto, claimedById: userId });
  }

  @Patch('claims/:id')
  @ApiOperation({ summary: 'Resolve or reject a claim (alias)' })
  resolveAlias(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { status: string; resolution?: string; rejectedReason?: string },
  ) {
    return this.service.resolve(id, dto);
  }

  @Get('check')
  @ApiOperation({ summary: 'Check warranty eligibility by IMEI' })
  check(@Query('imei') imei: string) {
    return this.service.checkEligibility(imei);
  }

  @Get('expiring-soon')
  @ApiOperation({ summary: 'Get IMEI records whose warranty expires within N days (default 7)' })
  expiringSoon(@Query('daysAhead') daysAhead?: string) {
    return this.service.getExpiringSoon(daysAhead ? Number(daysAhead) : 7);
  }

  @Post('claim')
  @ApiOperation({ summary: 'File a warranty claim' })
  claim(
    @Body() dto: { imei: string; issue: string; claimType?: string },
    @Headers('x-user-id') userId: string,
  ) {
    return this.service.claim({ ...dto, claimedById: userId });
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Resolve or reject a warranty claim' })
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { status: string; resolution?: string; rejectedReason?: string },
  ) {
    return this.service.resolve(id, dto);
  }

  @Get()
  findAll() { return this.service.findAll(); }
}
