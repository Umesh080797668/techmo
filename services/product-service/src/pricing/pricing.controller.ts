import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, ParseUUIDPipe, BadRequestException } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Pricing')
@ApiBearerAuth()
@Controller('pricing')
export class PricingController {
  constructor(private readonly service: PricingService) {}

  @Post('rules')
  @ApiOperation({ summary: 'Create a pricing rule (discount, combo, time-based)' })
  createRule(@Body() dto: any) { return this.service.createRule(dto); }

  @Get('rules')
  @ApiOperation({ summary: 'List active pricing rules' })
  findAll() { return this.service.findAll(); }

  @Get('calculate')
  @ApiOperation({ summary: 'Calculate final price for a product (with rules applied)' })
  calculate(
    @Query('productId') productId: string,
    @Query('qty') qty = '1',
    @Query('cartItems') cartItems?: string,
  ) {
    const cart = cartItems ? cartItems.split(',') : [];
    return this.service.calculatePrice(productId, +qty, cart);
  }

  @Patch('rules/:id')
  @ApiOperation({ summary: 'Update a pricing rule (name, discount, dates, active toggle)' })
  updateRule(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) { return this.service.updateRule(id, dto); }

  @Delete('rules/:id')
  @ApiOperation({ summary: 'Permanently delete a pricing rule' })
  deleteRule(@Param('id', ParseUUIDPipe) id: string) { return this.service.deleteRule(id); }

  @Patch('rules/:id/deactivate')
  deactivate(@Param('id', ParseUUIDPipe) id: string) { return this.service.deactivate(id); }

  @Post('validate-pin')
  @ApiOperation({ summary: 'Validate manager PIN (used at POS before applying protected discounts)' })
  validatePin(@Body() dto: { pin: string }) { return this.service.validatePin(dto.pin); }

  @Get('settings/manager-pin')
  @ApiOperation({ summary: 'Get current manager PIN (masked) — super_admin only' })
  async getManagerPin() {
    const pin = await this.service.getManagerPin();
    return { pin };
  }

  @Put('settings/manager-pin')
  @ApiOperation({ summary: 'Update manager PIN — super_admin only' })
  async setManagerPin(@Body() dto: { pin: string }) {
    const trimmed = (dto.pin ?? '').trim();
    if (trimmed.length < 4 || trimmed.length > 8) {
      throw new BadRequestException('PIN must be 4–8 characters');
    }
    await this.service.setManagerPin(trimmed);
    return { success: true };
  }
}
