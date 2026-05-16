import { Module } from '@nestjs/common';
import { ImeiController } from './imei.controller';
import { ImeiService } from './imei.service';

@Module({
  controllers: [ImeiController],
  providers: [ImeiService],
  exports: [ImeiService],
})
export class ImeiModule {}
