import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateCode(): Promise<string> {
    const count = await this.prisma.employee.count();
    return `EMP-${String(count + 1).padStart(4, '0')}`;
  }

  async create(dto: CreateEmployeeDto) {
    const code = dto.employeeCode ?? await this.generateCode();
    const exists = await this.prisma.employee.findFirst({ where: { employeeCode: code } });
    if (exists) throw new ConflictException(`Employee code ${code} already exists`);
    return this.prisma.employee.create({
      data: {
        userId: dto.userId,
        employeeCode: code,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        baseSalary: dto.baseSalary,
        commissionPct: dto.commissionPct ?? 0,
        allowance: dto.allowance ?? 0,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : new Date(),
        position: dto.position ?? '',
        department: dto.department,
      },
    });
  }

  async findAll(page = 1, limit = 20, department?: string, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (department) where.department = department;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({ where, skip, take: limit, orderBy: { employeeCode: 'asc' } }),
      this.prisma.employee.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const e = await this.prisma.employee.findUnique({
      where: { id },
      include: { payrolls: { orderBy: { year: 'desc' }, take: 12 } },
    });
    if (!e) throw new NotFoundException(`Employee ${id} not found`);
    return e;
  }

  async findByUserId(userId: string) {
    const e = await this.prisma.employee.findUnique({ where: { userId } });
    if (!e) throw new NotFoundException(`Employee with userId ${userId} not found`);
    return e;
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    await this.ensureExists(id);
    return this.prisma.employee.update({ where: { id }, data: dto });
  }

  async ensureExists(id: string) {
    const e = await this.prisma.employee.findUnique({ where: { id } });
    if (!e) throw new NotFoundException(`Employee ${id} not found`);
    return e;
  }
}
