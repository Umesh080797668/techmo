import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  ParseIntPipe, DefaultValuePipe, Headers, Ip,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto, VoidOrderDto } from './dto/order.dto';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('api/v1/orders')
export class OrdersController {
  constructor(private readonly svc: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new POS order (begins checkout)' })
  create(@Body() dto: CreateOrderDto) {
    return this.svc.createOrder(dto);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete order: deduct stock, award loyalty, generate invoice' })
  complete(@Param('id') id: string) {
    return this.svc.completeOrder(id);
  }

  @Post(':id/void')
  @ApiOperation({ summary: 'Void an order (requires manager PIN)' })
  void(@Param('id') id: string, @Body() dto: VoidOrderDto) {
    return this.svc.voidOrder(id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List orders (paginated)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'cashierId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('cashierId') cashierId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.svc.findAll(page, limit, status, cashierId, from, to, customerId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Sales summary for a date range' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  summary(@Query('from') from: string, @Query('to') to: string) {
    return this.svc.getSalesSummary(new Date(from), new Date(to));
  }

  @Get('number/:orderNumber')
  findByNumber(@Param('orderNumber') orderNumber: string) {
    return this.svc.findByOrderNumber(orderNumber);
  }

  // ─── Smart Defaults ──────────────────────────────────────────────────────────

  @Get('pos/smart-defaults')
  @ApiOperation({ summary: 'Smart defaults: top items & customers for this cashier (30 days)' })
  smartDefaults(@Query('cashierId') cashierId: string) {
    return this.svc.getSmartDefaults(cashierId);
  }

  // ─── POS Rule Validation ─────────────────────────────────────────────────────

  @Post('pos/validate-rules')
  @ApiOperation({ summary: 'Validate a cart against active POS mistake-prevention rules' })
  validateRules(@Body() dto: CreateOrderDto) {
    return this.svc.validatePosRules(dto);
  }

  // ─── AI-like Insights ────────────────────────────────────────────────────────

  @Get('insights/summary')
  @ApiOperation({ summary: 'Rule-based business insights (revenue delta, top products, void rate)' })
  insights() {
    return this.svc.getInsights();
  }

  // ─── Reservations ────────────────────────────────────────────────────────────

  @Post('reservations')
  @ApiOperation({ summary: 'Create a product reservation for a customer' })
  createReservation(@Body() data: any, @Headers('x-user-id') staffId: string) {
    return this.svc.createReservation({ ...data, staffId });
  }

  @Get('reservations')
  @ApiOperation({ summary: 'List reservations (default: ACTIVE + EXPIRED)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  listReservations(
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.svc.listReservations(status, page, limit);
  }

  @Delete('reservations/:id')
  @ApiOperation({ summary: 'Cancel a reservation' })
  cancelReservation(@Param('id') id: string) {
    return this.svc.cancelReservation(id);
  }

  @Post('reservations/:id/convert')
  @ApiOperation({ summary: 'Convert an active reservation into a sale order' })
  convertReservation(
    @Param('id') id: string,
    @Body() body: { orderId?: string },
  ) {
    return this.svc.convertReservationToOrder(id, body.orderId ?? '');
  }

  // ─── Consent Logs ────────────────────────────────────────────────────────────

  @Post('consents')
  @ApiOperation({ summary: 'Record a customer marketing/data consent decision' })
  recordConsent(
    @Body() body: { customerId: string; type: string; granted: boolean },
    @Headers('x-user-id') staffId: string,
    @Ip() ip: string,
  ) {
    return this.svc.recordConsent(body.customerId, body.type, body.granted, {
      ipAddress: ip,
      recordedBy: staffId,
    });
  }

  @Get('consents/:customerId')
  @ApiOperation({ summary: 'Get latest consent per type for a customer' })
  getConsents(@Param('customerId') customerId: string) {
    return this.svc.getCustomerConsents(customerId);
  }

  // ─── Order by ID (must be last GET to avoid shadowing static routes) ─────────

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }
}
