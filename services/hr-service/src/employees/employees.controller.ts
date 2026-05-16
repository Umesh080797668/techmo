import {
  Controller, Get, Post, Patch, Body, Param, Query,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('api/v1/employees')
export class EmployeesController {
  constructor(private readonly svc: EmployeesService) {}

  @Post()
  @ApiOperation({ summary: 'Create employee profile' })
  create(@Body() dto: CreateEmployeeDto) { return this.svc.create(dto); }

  @Get()
  @ApiOperation({ summary: 'List employees' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'department', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('department') department?: string,
    @Query('search') search?: string,
  ) {
    return this.svc.findAll(page, limit, department, search);
  }

  @Get('by-user/:userId')
  findByUser(@Param('userId') userId: string) { return this.svc.findByUserId(userId); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.svc.update(id, dto);
  }
}
