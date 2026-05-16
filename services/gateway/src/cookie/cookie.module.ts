import { Global, Module } from '@nestjs/common';
import { CookieService } from './cookie.service';

/**
 * CookieModule is registered as @Global so every module in the gateway
 * can inject CookieService without explicitly importing this module.
 */
@Global()
@Module({
  providers: [CookieService],
  exports:   [CookieService],
})
export class CookieModule {}
