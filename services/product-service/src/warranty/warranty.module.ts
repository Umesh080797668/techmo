import { Module } from '@nestjs/common';
import { WarrantyController } from './warranty.controller';
import { WarrantyService } from './warranty.service';
import { CustomerWarrantyController } from './customer-warranty.controller';

@Module({
  controllers: [WarrantyController, CustomerWarrantyController],
  providers: [WarrantyService],
})
export class WarrantyModule {}
