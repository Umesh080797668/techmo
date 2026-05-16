import {
  Controller, Get, Param, Query, Headers,
  ParseIntPipe, DefaultValuePipe, UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { OrdersService } from './orders.service';

/**
 * Customer self-service order endpoints.
 * Requests are routed here from the gateway, which sets X-Customer-Id
 * by decoding the customer JWT Bearer token.
 */
@ApiTags('My Orders')
@Controller('api/v1/customers')
export class CustomerOrdersController {
  constructor(private readonly svc: OrdersService) {}

  @Get('me/orders')
  @ApiOperation({ summary: 'List orders for the authenticated customer' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  myOrders(
    @Headers('x-customer-id') customerId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    if (!customerId) throw new UnauthorizedException('Not authenticated');
    return this.svc.findByCustomer(customerId, page, limit, status);
  }

  @Get('me/orders/:id')
  @ApiOperation({ summary: 'Get a single order for the authenticated customer' })
  myOrder(
    @Headers('x-customer-id') customerId: string,
    @Param('id') id: string,
  ) {
    if (!customerId) throw new UnauthorizedException('Not authenticated');
    return this.svc.findOneForCustomer(id, customerId);
  }
}
