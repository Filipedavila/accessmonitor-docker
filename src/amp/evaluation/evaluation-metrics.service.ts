import { Injectable } from '@nestjs/common';
import { metrics, type Counter, type Histogram, type Meter } from '@opentelemetry/api';

export type EvaluationMetricType = 'url' | 'html';
export type EvaluationMetricStatus = 'success' | 'error';

/**
 * Encapsula as métricas OTel de baixa cardinalidade.
 * NUNCA incluir IPs, hostnames ou URLs nas labels (cardinality explosion).
 */
@Injectable()
export class EvaluationMetricsService {
  private readonly meter: Meter;
  private readonly evaluationsCounter: Counter;
  private readonly durationHistogram: Histogram;

  constructor() {
    this.meter = metrics.getMeter('amp-evaluation');

    this.evaluationsCounter = this.meter.createCounter('amp_evaluations_total', {
      description: 'Total number of AMP evaluations performed.',
    });

    this.durationHistogram = this.meter.createHistogram('amp_evaluation_duration_seconds', {
      description: 'Duration of AMP evaluations in seconds.',
      unit: 's',
    });
  }

  public recordEvaluation(
    type: EvaluationMetricType,
    status: EvaluationMetricStatus,
    durationSeconds: number,
  ): void {
    const attributes = { type, status };
    this.evaluationsCounter.add(1, attributes);
    this.durationHistogram.record(durationSeconds, attributes);
  }
}
