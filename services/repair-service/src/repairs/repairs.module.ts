import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RepairsService } from './repairs.service';
import { RepairsController } from './repairs.controller';
import { CustomerRepairsController } from './customer-repairs.controller';
import { CourierTrackingService } from './courier-tracking.service';

@Module({
  imports: [HttpModule],
  controllers: [RepairsController, CustomerRepairsController],
  providers: [RepairsService, CourierTrackingService],
})
export class RepairsModule {}
