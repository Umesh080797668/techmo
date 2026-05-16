import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ProxyModule } from './proxy/proxy.module';
import { AuthGuardModule } from './auth/auth-guard.module';
import { AuthModule } from './auth/auth.module';
import { MailerModule } from './mailer/mailer.module';
import { CookieModule } from './cookie/cookie.module';
import { LockdownModule } from './guards/lockdown.module';
import { SettingsModule } from './guards/settings.module';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController],
  imports: [
    CookieModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 200 }]),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
      global: true,
    }),
    AuthGuardModule,
    AuthModule,
    MailerModule,
    ProxyModule,
    LockdownModule,
    SettingsModule,
  ],
  providers: [
    // Apply ThrottlerGuard globally to all controller routes (auth endpoints,
    // lockdown controller, health, etc.).  Proxy routes get per-IP DDoS
    // protection from IpThrottleMiddleware in ProxyModule instead.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
