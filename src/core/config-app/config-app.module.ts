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
      }),
    }),
  ],
  exports: [ConfigModule],
})
export class ConfigAppModule {}
