import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import express from 'express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  const originsRaw = configService.get<string>('ALLOWED_ORIGINS');
  const allowedOrigins = originsRaw?.split(',').map((o) => o.trim()).filter(Boolean);

  if (!allowedOrigins?.length) {
    logger.warn('SECURITY WARNING: ALLOWED_ORIGINS is not defined or empty. CORS accepts any origin.');
  }

  app.enableCors({
    origin: allowedOrigins?.length ? allowedOrigins : true,
    methods: 'GET,HEAD,POST,OPTIONS',
  });

  app.use(compression());
  app.use(helmet()); 
  app.use('/api', helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [`'self'`],
        styleSrc: [`'self'`, `'unsafe-inline'`],
        imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
        scriptSrc: [`'self'`, `'unsafe-inline'`],
      },
    },
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '2mb', extended: true }));

  app.use(compression());
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const config = new DocumentBuilder()
    .setTitle('Access Monitor Server')
    .setDescription('The Access Monitor Server API description')
    .setVersion('2.0')
    .addTag('website')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
   app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
