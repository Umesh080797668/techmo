import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

/**
 * Customer self-service warranty endpoint.
 *
 * NOTE: WarrantyClaim has no customerId field — warranties are tracked per IMEI.
 * The customer warranty page uses IMEI lookup (/warranty/check?imei=…), not a list.
 * This endpoint returns an empty list so the dashboard doesn't 404.
 */
@ApiTags('My Warranty')
@Controller('customers')
export class CustomerWarrantyController {
  @Get('me/warranty')
  @ApiOperation({ summary: 'List warranties for the authenticated customer (IMEI-based, returns stub)' })
  getMyWarranty(@Headers('x-customer-id') customerId: string) {
    if (!customerId) throw new UnauthorizedException('Not authenticated');
    // Warranties are per IMEI — use the /warranty/check?imei= endpoint for lookups.
    return { items: [] };
  }
}
