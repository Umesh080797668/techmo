import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as morgan from 'morgan';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Trust the first proxy hop (Cloudflare or nginx) so req.ip reflects the
  // real client IP rather than the proxy's IP. Required for correct
  // IP-based rate limiting in IpThrottleMiddleware and ThrottlerGuard.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Hard cap on request body size (50 KB). Blocks slow-body / large-payload
  // DDoS attacks before they reach any business logic.
  app.use(express.json({ limit: '50kb' }));
  app.use(express.urlencoded({ limit: '50kb', extended: true }));

  app.use(helmet());
  app.use(morgan('combined'));
  // Must be registered before any guard / interceptor that reads req.cookies
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:4000', 'http://localhost:4001', 'http://localhost:4002'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 TechMo API Gateway running on port ${port}`);
}
bootstrap();
