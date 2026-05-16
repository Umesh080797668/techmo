import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ShiftsService, CreateShiftDto } from './shifts.service';

@ApiTags('Shifts')
@ApiBearerAuth()
@Controller('api/v1/shifts')
export class ShiftsController {
  constructor(private readonly svc: ShiftsService) {}

  @Get()
  @ApiOperation({ summary: 'List all upcoming shifts' })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query('limit') limit?: string) {
    return this.svc.findAll(limit ? parseInt(limit) : 100);
  }

  @Post()
  @ApiOperation({ summary: 'Schedule a shift for an employee' })
  create(@Body() dto: CreateShiftDto) { return this.svc.create(dto); }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Get shifts for an employee' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  findByEmployee(
    @Param('employeeId') employeeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.findByEmployee(
      employeeId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.delete(id); }
}
