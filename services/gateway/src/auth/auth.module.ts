import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthController } from './auth.controller';
import { WebAuthnController } from './webauthn.controller';
import { WebAuthnService } from './webauthn.service';
import { RedisService } from '../util/redis.service';

@Module({
  imports: [HttpModule],
  controllers: [AuthController, WebAuthnController],
  providers: [WebAuthnService, RedisService],
})
export class AuthModule {}
