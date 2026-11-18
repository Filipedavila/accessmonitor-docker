import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV == 'production' ? 'prod' : 'dev'}`,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'staging', 'test')
          .required(),
        IP_BLACKLIST_RANGES: Joi.string().allow('').default(''),
        REFERER: Joi.string().required(),
        RATE_LIMIT_ENABLED: Joi.boolean().default(true),
        RATE_LIMIT_TTL: Joi.number().integer().min(1000).default(60000), 
        RATE_LIMIT_LIMIT: Joi.number().integer().min(1).default(1000),
        QUALWEB_MAX_CONCURRENCY: Joi.number().integer().min(1).default(3),
        // Remote Chrome WebSocket (e.g. ws://accessmonitor-browserless:3000). Empty = launch Chromium locally.
        QUALWEB_CHROME_URL: Joi.string().uri({ scheme: ['ws', 'wss','http', 'https'] }).allow('').default(''),
         }),
    }),
    ],
    exports: [ConfigModule],
  })
export class ConfigAppModule {}
