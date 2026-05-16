import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());

  // Hard cap on request body size — mirrors the gateway's 50 KB limit.
  // Prevents large-payload DoS attacks that originate from within the cluster.
  app.use(express.json({ limit: '50kb' }));
  app.use(express.urlencoded({ limit: '50kb', extended: true }));

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const config = new DocumentBuilder()
    .setTitle('Loyalty & CRM Service')
    .setDescription('Customer management and loyalty points API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  await app.listen(3005);
  console.log('Loyalty Service running on port 3005');
}
bootstrap();
