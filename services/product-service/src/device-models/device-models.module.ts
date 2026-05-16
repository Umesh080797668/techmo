import { Module } from '@nestjs/common';
import { DeviceModelsController } from './device-models.controller';
import { DeviceModelsService } from './device-models.service';

@Module({
  controllers: [DeviceModelsController],
  providers: [DeviceModelsService],
  exports: [DeviceModelsService],
})
export class DeviceModelsModule {}
