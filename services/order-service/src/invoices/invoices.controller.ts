import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('api/v1/invoices')
export class InvoicesController {
  constructor(private readonly svc: InvoicesService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Get('by-order/:orderId')
  @ApiOperation({ summary: 'Get invoice for an order' })
  findByOrder(@Param('orderId') orderId: string) {
    return this.svc.findByOrder(orderId);
  }
}
