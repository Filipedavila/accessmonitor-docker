import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClickHouseLogLevel, createClient } from '@clickhouse/client';
import { CLICKHOUSE_CLIENT } from './clickhouse.constants';
@Module({
  imports: [],
  providers: [
    {
      provide: CLICKHOUSE_CLIENT,
      useFactory: async (configService: ConfigService) => {
        const client = createClient({
          host: configService.get<string>('CLICKHOUSE_URI'),
          username: configService.get<string>('CLICKHOUSE_USER'),
          password: configService.get<string>('CLICKHOUSE_PASSWORD'),
          database: configService.get<string>('CLICKHOUSE_DATABASE'),
          log: {
            level:
              (configService.get<number>('CLICKHOUSE_LOG_LEVEL') as ClickHouseLogLevel) ||
              ClickHouseLogLevel.INFO,
          },
          keep_alive: {
            enabled: true,
            eagerly_destroy_stale_sockets: true,
            idle_socket_ttl: 30000,
          },
          request_timeout: 30000,
        });
        return client;
      },
      inject: [ConfigService],
    },
  ],

  exports: [CLICKHOUSE_CLIENT],
})
export class ClickhouseModule {}
