import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateShiftDto {
  @ApiProperty() @IsString() employeeId: string;
  @ApiProperty() @IsDateString() shiftStart: string;
  @ApiProperty() @IsDateString() shiftEnd: string;
  @ApiPropertyOptional() @IsString() @IsOptional() label?: string;
}

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(limit = 100) {
    return this.prisma.shift.findMany({
      include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } },
      orderBy: { shiftStart: 'desc' },
      take: limit,
    });
  }

  async create(dto: CreateShiftDto) {
    return this.prisma.shift.create({
      data: {
        employeeId: dto.employeeId,
        shiftStart: new Date(dto.shiftStart),
        shiftEnd: new Date(dto.shiftEnd),
        label: dto.label,
      },
    });
  }

  async findByEmployee(employeeId: string, from?: Date, to?: Date) {
    const where: any = { employeeId };
    if (from || to) {
      where.shiftStart = {};
      if (from) where.shiftStart.gte = from;
      if (to) where.shiftStart.lte = to;
    }
    return this.prisma.shift.findMany({ where, orderBy: { shiftStart: 'asc' } });
  }

  async delete(id: string) {
    const s = await this.prisma.shift.findUnique({ where: { id } });
    if (!s) throw new NotFoundException(`Shift ${id} not found`);
    return this.prisma.shift.delete({ where: { id } });
  }
}
