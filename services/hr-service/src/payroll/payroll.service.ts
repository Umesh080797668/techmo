import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeesService } from '../employees/employees.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const COMMISSION_PER_ORDER = 50; // LKR per completed order (simplified)

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);
  private orderUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly employeesService: EmployeesService,
    private readonly config: ConfigService,
  ) {
    this.orderUrl = config.get('ORDER_SERVICE_URL', 'http://order-service:3003');
  }

  async calculate(employeeId: string, year: number, month: number) {
    const employee = await this.employeesService.ensureExists(employeeId);

    // Check for existing draft/approved payroll
    const existing = await this.prisma.payroll.findUnique({
      where: { employeeId_month_year: { employeeId, month, year } },
    });
    if (existing && existing.status !== 'DRAFT') {
      throw new BadRequestException('Payroll already finalized for this period');
    }

    // Get attendance hours for the month
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const attendanceResult = await this.prisma.attendance.aggregate({
      where: { employeeId, clockIn: { gte: start, lt: end }, clockOut: { not: null } },
      _sum: { hoursWorked: true },
    });
    const hoursWorked = attendanceResult._sum.hoursWorked ?? 0;

    // Get sales count for commission (from order service)
    let salesCount = 0;
    try {
      const from = start.toISOString();
      const to = end.toISOString();
      const resp = await axios.get(
        `${this.orderUrl}/api/v1/orders/summary?from=${from}&to=${to}&cashierId=${employee.userId}`,
      );
      salesCount = resp.data?.orderCount ?? 0;
    } catch (e) {
      this.logger.warn(`Could not fetch sales for payroll: ${e.message}`);
    }

    const commissionPct = Number(employee.commissionPct);
    const baseSalaryNum = Number(employee.baseSalary);
    const allowanceNum = Number(employee.allowance);
    const commissionEarned = parseFloat(
      (salesCount * (commissionPct / 100) * baseSalaryNum / 12).toFixed(2),
    );

    // Auto-deductions: EPF 8% + ETF 3% of base salary (Sri Lanka standard)
    const epf = parseFloat((baseSalaryNum * 0.08).toFixed(2)); // Employee EPF 8%
    const etf = parseFloat((baseSalaryNum * 0.03).toFixed(2)); // ETF 3%
    const deductions = parseFloat((epf + etf).toFixed(2));

    const netPay = parseFloat(
      (baseSalaryNum + allowanceNum + commissionEarned - deductions).toFixed(2),
    );

    // Fields valid for UPDATE (exclude relational/unique-key fields)
    const updateData = {
      baseSalary: employee.baseSalary,
      allowance: employee.allowance,
      commissionEarned,
      totalSalesAmt: salesCount,
      deductions,
      netPay,
      status: 'DRAFT' as const,
    };

    if (existing) {
      return this.prisma.payroll.update({
        where: { employeeId_month_year: { employeeId, month, year } },
        data: updateData,
      });
    }
    return this.prisma.payroll.create({
      data: {
        employeeId,
        month,
        year,
        ...updateData,
      },
    });
  }

  async adjust(id: string, dto: { commissionEarned?: number; deductions?: number }) {
    const p = await this.findOne(id);
    if (p.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT payrolls can be adjusted');
    }
    const commission = dto.commissionEarned !== undefined ? dto.commissionEarned : Number(p.commissionEarned);
    const deductions = dto.deductions !== undefined ? dto.deductions : Number(p.deductions);
    const netPay = parseFloat(
      (Number(p.baseSalary) + Number(p.allowance) + commission - deductions).toFixed(2),
    );
    return this.prisma.payroll.update({
      where: { id },
      data: { commissionEarned: commission, deductions, netPay },
    });
  }

  async approve(id: string, approvedBy: string) {
    const p = await this.findOne(id);
    if (p.status !== 'DRAFT') throw new BadRequestException('Only DRAFT payrolls can be approved');
    return this.prisma.payroll.update({
      where: { id },
      data: { status: 'APPROVED', processedBy: approvedBy, processedAt: new Date() },
    });
  }

  async markPaid(id: string) {
    const p = await this.findOne(id);
    if (p.status !== 'APPROVED') throw new BadRequestException('Only APPROVED payrolls can be marked paid');
    return this.prisma.payroll.update({
      where: { id },
      data: { status: 'PAID', processedAt: new Date() },
    });
  }

  async findAll(year: number, month: number) {
    return this.prisma.payroll.findMany({
      where: { year, month },
      include: { employee: { select: { employeeCode: true, firstName: true, lastName: true, position: true, department: true } } },
      orderBy: { employee: { employeeCode: 'asc' } },
    });
  }

  async findByEmployee(employeeId: string) {
    return this.prisma.payroll.findMany({
      where: { employeeId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 24,
    });
  }

  async findOne(id: string) {
    const p = await this.prisma.payroll.findUnique({ where: { id } });
    if (!p) throw new NotFoundException(`Payroll record ${id} not found`);
    return p;
  }
}
