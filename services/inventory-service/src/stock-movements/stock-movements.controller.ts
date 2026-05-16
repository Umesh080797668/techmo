import { Controller, Get, Param, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StockMovementsService } from './stock-movements.service';

@ApiTags('Stock Movements')
@ApiBearerAuth()
@Controller('api/v1/stock-movements')
export class StockMovementsController {
  constructor(private readonly svc: StockMovementsService) {}

  @Get()
  @ApiOperation({ summary: 'List all movements (paginated), optional filter by type' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'movementType', required: false })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('movementType') movementType?: string,
  ) {
    return this.svc.findAll(page, limit, movementType);
  }

  @Get('by-inventory/:inventoryId')
  @ApiOperation({ summary: 'Get movement history for an inventory record' })
  findByInventory(
    @Param('inventoryId') inventoryId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.svc.findByInventory(inventoryId, page, limit);
  }

  @Get('by-reference/:reference')
  @ApiOperation({ summary: 'Get movements linked to an order/repair reference' })
  findByReference(@Param('reference') reference: string) {
    return this.svc.findByReference(reference);
  }
}
