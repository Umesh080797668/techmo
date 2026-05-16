import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { TransfersService, CreateTransferDto, TransferStatus } from './transfers.service';

/**
 * Branch Transfer Marketplace — REST Controller
 *
 * Base path: /inventory/transfers
 *
 * Endpoints:
 *   POST   /inventory/transfers             — create transfer request
 *   GET    /inventory/transfers             — list (filter by ?branchId=, ?status=)
 *   GET    /inventory/transfers/stats       — counts per status
 *   GET    /inventory/transfers/:id         — get one
 *   PATCH  /inventory/transfers/:id/approve — manager approves
 *   PATCH  /inventory/transfers/:id/reject  — manager rejects (with reason)
 *   PATCH  /inventory/transfers/:id/transit — mark items dispatched
 *   PATCH  /inventory/transfers/:id/complete — receiving branch confirms receipt
 *   DELETE /inventory/transfers/:id         — cancel (requester only)
 */

@Controller('api/v1/inventory/transfers')
export class TransfersController {
  constructor(private readonly svc: TransfersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTransferDto) {
    return this.svc.createRequest(dto);
  }

  @Get('stats')
  getStats(@Query('branchId') branchId?: string) {
    return this.svc.getStats(branchId);
  }

  @Get()
  findAll(
    @Query('branchId') branchId?: string,
    @Query('status')   status?:   TransferStatus,
  ) {
    return this.svc.findAll(branchId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Patch(':id/approve')
  approve(
    @Param('id') id:        string,
    @Body('managerId') mid: string,
  ) {
    return this.svc.approveTransfer(id, mid);
  }

  @Patch(':id/reject')
  reject(
    @Param('id') id:           string,
    @Body('managerId') mid:    string,
    @Body('reason')    reason?: string,
  ) {
    return this.svc.rejectTransfer(id, mid, reason);
  }

  @Patch(':id/transit')
  transit(@Param('id') id: string) {
    return this.svc.markInTransit(id);
  }

  @Patch(':id/complete')
  complete(
    @Param('id') id:              string,
    @Body('receivedBy') received: string,
  ) {
    return this.svc.completeTransfer(id, received);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(
    @Param('id') id:                  string,
    @Body('requestorId') requestorId: string,
  ) {
    return this.svc.cancelTransfer(id, requestorId);
  }
}
