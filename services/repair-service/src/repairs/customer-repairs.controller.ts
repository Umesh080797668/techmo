import {
  Controller, Get, Param, Query, Headers,
  ParseIntPipe, DefaultValuePipe, UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RepairsService } from './repairs.service';

/**
 * Customer self-service repair endpoints.
 * Requests are routed here from the gateway, which sets X-Customer-Id
 * by decoding the customer JWT Bearer token.
 */
@ApiTags('My Repairs')
@Controller('api/v1/customers')
export class CustomerRepairsController {
  constructor(private readonly svc: RepairsService) {}

  @Get('me/repairs')
  @ApiOperation({ summary: 'List repair tickets for the authenticated customer' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  myRepairs(
    @Headers('x-customer-id') customerId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    if (!customerId) throw new UnauthorizedException('Not authenticated');
    return this.svc.findByCustomer(customerId, page, limit, status);
  }

  @Get('me/repairs/:id')
  @ApiOperation({ summary: 'Get a single repair ticket for the authenticated customer' })
  myRepair(
    @Headers('x-customer-id') customerId: string,
    @Param('id') id: string,
  ) {
    if (!customerId) throw new UnauthorizedException('Not authenticated');
    return this.svc.findOneForCustomer(id, customerId);
  }
}
