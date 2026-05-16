import { Controller, Get, Post, Patch, Body, Param, Query, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';

@ApiTags('Payroll')
@ApiBearerAuth()
@Controller('api/v1/employees/payroll')
export class PayrollController {
  constructor(private readonly svc: PayrollService) {}

  @Post('calculate')
  @ApiOperation({ summary: 'Calculate (or recalculate) payroll for employee/month/year' })
  calculate(@Body() body: { employeeId: string; year: number; month: number }) {
    return this.svc.calculate(body.employeeId, body.year, body.month);
  }

  @Get()
  @ApiOperation({ summary: 'Get all payrolls for a month/year' })
  @ApiQuery({ name: 'month', required: false, description: 'YYYY-MM or used with year' })
  @ApiQuery({ name: 'year', required: false })
  findAll(@Query('month') month?: string, @Query('year') year?: string) {
    let y: number, m: number;
    if (month && month.includes('-')) {
      const [yStr, mStr] = month.split('-');
      y = parseInt(yStr);
      m = parseInt(mStr);
    } else {
      y = parseInt(year ?? String(new Date().getFullYear()));
      m = parseInt(month ?? String(new Date().getMonth() + 1));
    }
    return this.svc.findAll(y, m);
  }

  @Get('by-employee/:employeeId')
  @ApiOperation({ summary: 'Get payroll history for an employee' })
  findByEmployee(@Param('employeeId') employeeId: string) {
    return this.svc.findByEmployee(employeeId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Adjust commission/deductions on a DRAFT payroll (recalculates netPay)' })
  adjust(
    @Param('id') id: string,
    @Body() body: { commissionEarned?: number; deductions?: number },
  ) {
    return this.svc.adjust(id, body);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a DRAFT payroll' })
  approve(@Param('id') id: string, @Headers('x-user-id') userId: string) {
    return this.svc.approve(id, userId);
  }

  @Patch(':id/mark-paid')
  @ApiOperation({ summary: 'Mark an APPROVED payroll as PAID' })
  markPaid(@Param('id') id: string) { return this.svc.markPaid(id); }
}
