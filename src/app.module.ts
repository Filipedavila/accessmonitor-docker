import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { AmpModule } from './amp/amp.module';
import { RateLimiterGuard } from 'nestjs-rate-limiter/dist/rate-limiter.guard';
import { APP_GUARD } from '@nestjs/core/constants';
import { RateLimiterModule } from 'nestjs-rate-limiter/dist/rate-limiter.module';
import { ConfigAppModule } from './core/config-app/config-app.module';
import winston from 'winston';
import {
  WinstonModule,
  utilities as nestWinstonModuleUtilities,
} from 'nest-winston';
import DailyRotateFile from 'winston-daily-rotate-file';

@Module({
  imports: [
    ConfigAppModule,
    CoreModule,
    AmpModule,
    RateLimiterModule.register({
      points: 1000,
    }),
    WinstonModule.forRoot({
      transports: [
        new DailyRotateFile({
          filename: 'error-log/accessmonitor-server-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '1m',
          maxFiles: '14d',
          level: 'error',
        }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.ms(),
            nestWinstonModuleUtilities.format.nestLike('accessmonitor-server', {
              // options
            }),
          ),
        }),
      ],
      // options
    }),
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RateLimiterGuard,
    },
  ],
})
export class AppModule {}
