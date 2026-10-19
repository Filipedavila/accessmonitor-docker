import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import type { ClickHouseClient } from '@clickhouse/client';
import { CLICKHOUSE_CLIENT } from '../../core/clickhouse/clickhouse.constants';
import type { EvaluationMetricStatus, EvaluationMetricType } from './evaluation-metrics.service';

export interface EvaluationAuditRecord {
  type: EvaluationMetricType;
  status: EvaluationMetricStatus;
  payload: string;
  clientIp?: string;
  durationMs: number;
  payloadSizeBytes: number;
  errorMessage?: string;
}

const TABLE_NAME = 'amp_evaluation_audit';

@Injectable()
export class EvaluationAuditService {
  private readonly logger = new Logger(EvaluationAuditService.name);

  constructor(
    @Inject(CLICKHOUSE_CLIENT)
    private readonly clickhouse: ClickHouseClient,
  ) {}

  /**
   * Dispara a gravação analítica em background. Falhas são apenas logadas
   * para não impactar a resposta ao cliente.
   */
  public record(record: EvaluationAuditRecord): void {
    void this.persist(record).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to persist evaluation audit record: ${message}`);
    });
  }

  private async persist(record: EvaluationAuditRecord): Promise<void> {
    const row = {
      timestamp: new Date().toISOString(),
      type: record.type,
      status: record.status,
      hostname: this.extractHostname(record.type, record.payload),
      client_ip_hash: this.hashIp(record.clientIp),
      duration_ms: Math.round(record.durationMs),
      payload_size_bytes: record.payloadSizeBytes,
      error_message: record.errorMessage ?? '',
    };

    await this.clickhouse.insert({
      table: TABLE_NAME,
      values: [row],
      format: 'JSONEachRow',
    });
  }

  private extractHostname(type: EvaluationMetricType, payload: string): string {
    if (type !== 'url') {
      return '';
    }
    try {
      return new URL(payload).hostname.toLowerCase();
    } catch {
      return '';
    }
  }

  private hashIp(ip?: string): string {
    if (!ip) {
      return '';
    }
    return createHash('sha256').update(ip).digest('hex');
  }
}
