import { Module } from '@nestjs/common';
import { LockdownController } from './lockdown.controller';
import { LockdownGuard } from './lockdown.guard';
import { RolesGuard } from './roles.guard';
import { RedisService } from '../util/redis.service';

@Module({
  providers: [LockdownGuard, RolesGuard, RedisService],
  controllers: [LockdownController],
  exports: [LockdownGuard, RolesGuard],
})
export class LockdownModule {}
