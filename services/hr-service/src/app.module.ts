import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { EmployeesModule } from './employees/employees.module';
import { AttendanceModule } from './attendance/attendance.module';
import { ShiftsModule } from './shifts/shifts.module';
import { PayrollModule } from './payroll/payroll.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    // Register PayrollModule, ShiftsModule, AttendanceModule BEFORE EmployeesModule
    // so their specific routes (/api/v1/employees/payroll, /shifts, /attendance)
    // are registered first and not captured by EmployeesController's @Get(':id') wildcard.
    PayrollModule,
    ShiftsModule,
    AttendanceModule,
    EmployeesModule,
  ],
})
export class AppModule {}
