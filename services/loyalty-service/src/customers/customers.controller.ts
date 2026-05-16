import {
  Controller, Get, Post, Patch, Body, Param, Query,
  ParseIntPipe, DefaultValuePipe, Headers, UnauthorizedException, ForbiddenException, Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import {
  CreateCustomerDto, UpdateCustomerDto, EarnPointsDto, RedeemPointsDto, ManualAdjustDto,
} from './dto/customer.dto';

@ApiTags('Customers & Loyalty')
@ApiBearerAuth()
@Controller('api/v1/customers')
export class CustomersController {
  private readonly logger = new Logger(CustomersController.name);

  /**
   * Internal service key — shared secret between order-service / repair-service
   * and the loyalty-service.  Falls back to a strong default so the service
   * always starts even without the env-var, but production MUST override it via
   * INTERNAL_SERVICE_KEY in docker-compose / .env.
   */
  private readonly internalKey =
    process.env.INTERNAL_SERVICE_KEY ?? 'techmo-internal-svc-2026';

  constructor(private readonly svc: CustomersService) {}

  /** Validates that the caller is either a logged-in staff user OR a trusted internal service. */
  private requireInternal(
    userId: string | undefined,
    providedKey: string | undefined,
    endpoint: string,
  ): void {
    // Staff user authenticated via gateway JWT → allow
    if (userId) return;

    // Internal service calling with shared secret → allow
    if (providedKey && providedKey === this.internalKey) return;

    // Anything else (e.g. a customer JWT hitting /loyalty/earn) → block
    this.logger.warn(`[SECURITY] Unauthorized access attempt on ${endpoint}`);
    throw new ForbiddenException('This endpoint is restricted to internal services.');
  }

  @Post()
  @ApiOperation({ summary: 'Register a new customer' })
  create(@Body() dto: CreateCustomerDto) {
    return this.svc.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List customers (paginated, searchable)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.svc.findAll(page, limit, search);
  }

  // ─── Customer self-service endpoints (use X-Customer-Id forwarded by gateway) ─

  @Get('me')
  @ApiOperation({ summary: 'Get current customer profile (customer JWT)' })
  getMe(@Headers('x-customer-id') customerId: string) {
    if (!customerId) throw new UnauthorizedException('Not authenticated');
    return this.svc.getMe(customerId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current customer profile (customer JWT)' })
  updateMe(
    @Headers('x-customer-id') customerId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    if (!customerId) throw new UnauthorizedException('Not authenticated');
    return this.svc.update(customerId, dto);
  }

  @Get('me/loyalty/summary')
  @ApiOperation({ summary: 'Get loyalty summary for current customer' })
  getLoyaltySummary(@Headers('x-customer-id') customerId: string) {
    if (!customerId) throw new UnauthorizedException('Not authenticated');
    return this.svc.getLoyaltySummary(customerId);
  }

  @Get('me/loyalty/transactions')
  @ApiOperation({ summary: 'Get loyalty transaction history for current customer' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getLoyaltyTransactions(
    @Headers('x-customer-id') customerId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    if (!customerId) throw new UnauthorizedException('Not authenticated');
    return this.svc.getTransactionHistory(customerId, page, limit);
  }

  // ─── End customer self-service ────────────────────────────────────────────────

  @Get('by-phone/:phone')
  @ApiOperation({ summary: 'Find customer by phone (for POS lookup)' })
  findByPhone(@Param('phone') phone: string) {
    return this.svc.findByPhone(phone);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.svc.update(id, dto);
  }

  @Get(':id/transactions')
  @ApiOperation({ summary: 'Get loyalty transaction history' })
  transactions(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
  ) {
    return this.svc.getTransactionHistory(id, page, limit);
  }

  @Post('loyalty/earn')
  @ApiOperation({ summary: 'Award loyalty points from purchase or repair (internal services only)' })
  earn(
    @Body() dto: EarnPointsDto,
    @Headers('x-user-id')       userId: string,
    @Headers('x-internal-key')  internalKey: string,
  ) {
    this.requireInternal(userId, internalKey, 'loyalty/earn');
    return this.svc.earnPoints(dto);
  }

  @Post('loyalty/redeem')
  @ApiOperation({ summary: 'Redeem loyalty points for discount at POS (internal services only)' })
  redeem(
    @Body() dto: RedeemPointsDto,
    @Headers('x-user-id')       userId: string,
    @Headers('x-internal-key')  internalKey: string,
  ) {
    this.requireInternal(userId, internalKey, 'loyalty/redeem');
    return this.svc.redeemPoints(dto);
  }

  @Post('loyalty/adjust')
  @ApiOperation({ summary: 'Manual loyalty point adjustment (manager only)' })
  adjust(@Body() dto: ManualAdjustDto, @Headers('x-user-id') userId: string) {
    return this.svc.manualAdjust(dto, userId);
  }
}
