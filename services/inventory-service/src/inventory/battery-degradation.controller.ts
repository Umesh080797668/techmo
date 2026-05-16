import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { BatteryDegradationService } from './battery-degradation.service';
import { CreateBatteryEntryDto } from './dto/create-battery-entry.dto';
import { AcknowledgeAlertDto } from './dto/acknowledge-alert.dto';

@Controller('inventory/battery')
export class BatteryDegradationController {
  constructor(private readonly svc: BatteryDegradationService) {}

  /**
   * POST /inventory/battery/:inventoryId
   * Register a new battery batch entry with manufacture date + shelf life.
   */
  @Post(':inventoryId')
  create(
    @Param('inventoryId') inventoryId: string,
    @Body() dto: CreateBatteryEntryDto,
  ) {
    return this.svc.createEntry(inventoryId, dto);
  }

  /**
   * GET /inventory/battery/alerts
   * Returns all un-acknowledged battery age alerts, sorted by severity.
   * Query: ?type=APPROACHING_SHELF_LIMIT|SHELF_LIMIT_EXCEEDED|CRITICAL_AGE
   */
  @Get('alerts')
  listAlerts(@Query('type') type?: string) {
    return this.svc.listAlerts(type);
  }

  /**
   * GET /inventory/battery/scan
   * Runs the degradation scan manually (normally runs on a schedule).
   * Returns newly generated alert count.
   */
  @Get('scan')
  runScan() {
    return this.svc.runDegradationScan();
  }

  /**
   * PATCH /inventory/battery/alerts/:alertId/acknowledge
   * Marks a battery alert as reviewed by a manager.
   */
  @Patch('alerts/:alertId/acknowledge')
  acknowledge(
    @Param('alertId') alertId: string,
    @Body() dto: AcknowledgeAlertDto,
  ) {
    return this.svc.acknowledgeAlert(alertId, dto.managerId);
  }

  /**
   * GET /inventory/battery/:inventoryId
   * Returns all batch entries for a specific SKU with age calculations.
   */
  @Get(':inventoryId')
  getEntries(@Param('inventoryId') inventoryId: string) {
    return this.svc.getEntriesForInventory(inventoryId);
  }
}
