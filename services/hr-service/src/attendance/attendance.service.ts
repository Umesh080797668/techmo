import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async clockIn(employeeId: string) {
    // Check if already clocked in today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existing = await this.prisma.attendance.findFirst({
      where: {
        employeeId,
        clockIn: { gte: today },
        clockOut: null,
      },
    });
    if (existing) throw new BadRequestException('Employee already clocked in today');

    return this.prisma.attendance.create({
      data: { employeeId, clockIn: new Date() },
    });
  }

  async clockOut(attendanceId: string) {
    const record = await this.prisma.attendance.findUnique({ where: { id: attendanceId } });
    if (!record) throw new NotFoundException(`Attendance record ${attendanceId} not found`);
    if (record.clockOut) throw new BadRequestException('Already clocked out');

    const clockOut = new Date();
    const hoursWorked = (clockOut.getTime() - record.clockIn.getTime()) / 3600000;

    return this.prisma.attendance.update({
      where: { id: attendanceId },
      data: { clockOut, hoursWorked: parseFloat(hoursWorked.toFixed(2)) },
    });
  }

  async clockOutByEmployee(employeeId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const record = await this.prisma.attendance.findFirst({
      where: {
        employeeId,
        clockIn: { gte: today },
        clockOut: null,
      },
      orderBy: { clockIn: 'desc' },
    });
    if (!record) throw new NotFoundException('No active clock-in found for this employee today');
    return this.clockOut(record.id);
  }

  async findByEmployee(employeeId: string, from?: Date, to?: Date) {
    const where: any = { employeeId };
    if (from || to) {
      where.clockIn = {};
      if (from) where.clockIn.gte = from;
      if (to) where.clockIn.lte = to;
    }
    return this.prisma.attendance.findMany({
      where,
      orderBy: { clockIn: 'desc' },
      take: 100,
    });
  }

  async getMonthlyHours(employeeId: string, year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const result = await this.prisma.attendance.aggregate({
      where: { employeeId, clockIn: { gte: start, lt: end }, clockOut: { not: null } },
      _sum: { hoursWorked: true },
      _count: { id: true },
    });
    return {
      totalHours: result._sum.hoursWorked ?? 0,
      daysWorked: result._count.id,
    };
  }
}
