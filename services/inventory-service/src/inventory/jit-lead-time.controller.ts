import { Controller, Get, Query } from '@nestjs/common';
import { JitLeadTimeService } from './jit-lead-time.service';

@Controller('inventory/lead-times')
export class JitLeadTimeController {
  constructor(private readonly jitService: JitLeadTimeService) {}

  /**
   * GET /inventory/lead-times
   * Returns all supplier lead times with trend data.
   * Displayed in Admin /inventory as a "Supplier Performance" tab.
   */
  @Get()
  getAll() {
    return this.jitService.getSupplierLeadTimes();
  }

  /**
   * GET /inventory/lead-times/slowest
   * Quick badge for the Admin dashboard — single worst performer.
   */
  @Get('slowest')
  getSlowest() {
    return this.jitService.getSlowestSupplier();
  }

  /**
   * GET /inventory/lead-times/pos-warning?supplierId=
   * Called by POS when adding a "Awaiting Parts" repair:
   *   → Returns { estimatedDelay, likelyArrivalDate } or null
   * Lets staff warn the customer of a likely delay upfront.
   */
  @Get('pos-warning')
  getPosWarning(@Query('supplierId') supplierId: string) {
    return this.jitService.getPosWarningForSupplier(supplierId);
  }
}
