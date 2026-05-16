import { Module } from '@nestjs/common';
import { SettingsController, CacheController, ExportController, KioskController } from './settings.controller';
import { RolesGuard } from './roles.guard';
import { RedisService } from '../util/redis.service';

@Module({
  providers: [RolesGuard, RedisService],
  controllers: [SettingsController, CacheController, ExportController, KioskController],
})
export class SettingsModule {}
