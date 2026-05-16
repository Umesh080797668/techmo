import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseBoolPipe,
  DefaultValuePipe,
  ParseIntPipe,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import {
  CreateInventoryDto,
  UpdateInventoryDto,
  AdjustStockDto,
  ReserveStockDto,
} from './dto/inventory.dto';

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('api/v1/inventory')
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Post()
  @ApiOperation({ summary: 'Create inventory record for a SKU' })
  create(@Body() dto: CreateInventoryDto) {
    return this.svc.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all inventory (paginated). Filter by low stock.' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'lowStockOnly', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('lowStockOnly', new DefaultValuePipe(false), ParseBoolPipe) lowStockOnly: boolean,
    @Query('search') search?: string,
  ) {
    return this.svc.findAll(page, limit, lowStockOnly, search);
  }

  @Get('sku/:sku')
  @ApiOperation({ summary: 'Find inventory by SKU' })
  findBySku(@Param('sku') sku: string) {
    return this.svc.findBySku(sku);
  }

  @Get('product/:productId')
  @ApiOperation({ summary: 'Find all inventory records for a product' })
  findByProduct(@Param('productId') productId: string) {
    return this.svc.findByProductId(productId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find inventory by ID' })
  findOne(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update inventory metadata (lowStockQty, location)' })
  update(@Param('id') id: string, @Body() dto: UpdateInventoryDto) {
    return this.svc.update(id, dto);
  }

  @Post(':id/adjust')
  @ApiOperation({ summary: 'Adjust stock quantity (positive=in, negative=out)' })
  adjust(
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
    @Headers('x-user-id') userId: string,
  ) {
    dto.performedBy = dto.performedBy || userId;
    return this.svc.adjustStock(id, dto);
  }

  @Post(':id/reserve')
  @ApiOperation({ summary: 'Reserve stock for a pending order' })
  reserve(
    @Param('id') id: string,
    @Body() dto: ReserveStockDto,
    @Headers('x-user-id') userId: string,
  ) {
    dto.performedBy = dto.performedBy || userId;
    return this.svc.reserveStock(id, dto);
  }

  @Post(':id/deduct')
  @ApiOperation({ summary: 'Deduct reserved stock on order completion' })
  deduct(
    @Param('id') id: string,
    @Body() body: { quantity: number; reference: string },
    @Headers('x-user-id') userId: string,
  ) {
    return this.svc.deductReserved(id, body.quantity, body.reference, userId);
  }

  @Post(':id/release')
  @ApiOperation({ summary: 'Release reserved stock (order cancelled)' })
  release(
    @Param('id') id: string,
    @Body() body: { quantity: number; reference: string },
    @Headers('x-user-id') userId: string,
  ) {
    return this.svc.releaseReserved(id, body.quantity, body.reference, userId);
  }

  @Post('stocktake/bulk-sync')
  @ApiOperation({ summary: 'Bulk-sync offline stocktake scans — returns variance per SKU' })
  bulkSyncStocktake(@Body() body: { sessionId: string; scans: any[] }) {
    return this.svc.bulkSyncStocktake(body);
  }
}
