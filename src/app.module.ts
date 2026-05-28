import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { AmpModule } from './amp/amp.module';
import { APP_GUARD } from '@nestjs/core/constants';
import { ConfigAppModule } from './core/config-app/config-app.module';
import winston from 'winston';
import {
  WinstonModule,
  utilities as nestWinstonModuleUtilities,
} from 'nest-winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import {  ThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { CustomThrottlerGuard } from './core/guard/custom-throttler.guard';

@Module({
  imports: [
    ConfigAppModule,
    CoreModule,
    AmpModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigAppModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isEnabled = configService.get<boolean>('RATE_LIMIT_ENABLED');
        const ttl = configService.get<number>('RATE_LIMIT_TTL');
        const limit = configService.get<number>('RATE_LIMIT_LIMIT');
        
        return {
          throttlers: [
            {
              name: 'global',
              ttl: ttl ?? 60000,
              limit: isEnabled ? (limit ?? 100) : 1000000000,
            },
          ],
        };
      },
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
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}
