import { Controller, Get, Post, Patch, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';

@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('api/v1/employees/attendance')
export class AttendanceController {
  constructor(private readonly svc: AttendanceService) {}

  @Post('clock-in')
  @ApiOperation({ summary: 'Clock in an employee' })
  clockIn(@Body() body: { employeeId: string }) {
    return this.svc.clockIn(body.employeeId);
  }

  @Patch(':id/clock-out')
  @ApiOperation({ summary: 'Clock out by attendance record ID' })
  clockOut(@Param('id') id: string) {
    return this.svc.clockOut(id);
  }

  @Patch('employee/:employeeId/clock-out')
  @ApiOperation({ summary: 'Clock out by employee ID (finds open attendance for today)' })
  clockOutByEmployee(@Param('employeeId') employeeId: string) {
    return this.svc.clockOutByEmployee(employeeId);
  }

  @Get(':employeeId')
  @ApiOperation({ summary: 'Get attendance history for an employee' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getHistory(
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

  @Get(':employeeId/monthly-hours')
  @ApiOperation({ summary: 'Get total hours worked in a specific month' })
  @ApiQuery({ name: 'year', required: true })
  @ApiQuery({ name: 'month', required: true })
  monthlyHours(
    @Param('employeeId') employeeId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.svc.getMonthlyHours(employeeId, parseInt(year), parseInt(month));
  }
}
