import { context, metrics, trace, Span, SpanStatusCode } from '@opentelemetry/api';
import type { EvaluatePublicPageInput } from './evaluation-public.service';

/**
 * Tracks evaluation activity with the global OpenTelemetry API.
 * Without an SDK, these calls do nothing.
 *
 * - Traces include the full URL and client IP.
 * - Metrics use only the host, type, and outcome.
 */
const tracer = trace.getTracer('accessmonitor.evaluation');
const meter = metrics.getMeter('accessmonitor.evaluation');

const evaluationsCounter = meter.createCounter('amp.evaluations', {
  description: 'Requested evaluations, by host, type, and outcome',
});
const totalDuration = meter.createHistogram('amp.evaluation.total.duration', {
  description: 'Time from request to result (queue + evaluation)',
  unit: 'ms',
});
const queueWait = meter.createHistogram('amp.evaluation.queue.wait', {
  description: 'Time waiting in the queue until a slot is available',
  unit: 'ms',
});
const runDuration = meter.createHistogram('amp.evaluation.run.duration', {
  description: 'Time spent evaluating (once a slot is acquired)',
  unit: 'ms',
});

export type EvaluationOutcome = 'completed' | 'failed' | 'aborted';

export interface EvaluationRequestContext {
  clientIp?: string;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'invalid';
  }
}

/** Tracks one request from start, through the queue and evaluation, to the end. */
export class EvaluationTrace {
  private readonly span: Span;
  private readonly baseAttrs: { 'amp.eval.type': string; 'url.host'?: string };
  private readonly startedAt = performance.now();
  private runStartedAt?: number;
  private runSpan?: Span;
  private done = false;

  constructor(input: EvaluatePublicPageInput, request: EvaluationRequestContext = {}) {
    this.baseAttrs = { 'amp.eval.type': input.type };
    this.span = tracer.startSpan('amp.evaluation', {
      attributes: {
        'amp.eval.type': input.type,
        ...(request.clientIp ? { 'client.address': request.clientIp } : {}),
      },
    });
    if (input.type === 'url') {
      this.baseAttrs['url.host'] = hostOf(input.payload);
      this.span.setAttributes({ 'url.full': input.payload, 'url.host': this.baseAttrs['url.host'] });
    }
  }

  /** Records the queue wait and starts the evaluation span. */
  started(): void {
    this.runStartedAt = performance.now();
    const waited = this.runStartedAt - this.startedAt;
    queueWait.record(waited, this.baseAttrs);
    this.span.setAttribute('amp.queue.wait_ms', Math.round(waited));
    this.runSpan = tracer.startSpan(
      'amp.evaluation.run',
      {},
      // Set the parent explicitly because the queue callback may lose async context.
      trace.setSpan(context.active(), this.span),
    );
  }

  /** Ends the request. Safe to call more than once. */
  end(outcome: EvaluationOutcome, error?: unknown): void {
    if (this.done) return;
    this.done = true;
    const now = performance.now();
    const total = now - this.startedAt;

    const attrs = { ...this.baseAttrs, 'amp.eval.outcome': outcome };
    if (this.runSpan && this.runStartedAt !== undefined) {
      const run = now - this.runStartedAt;
      runDuration.record(run, attrs);
      this.span.setAttribute('amp.run.duration_ms', Math.round(run));
      if (outcome === 'failed') this.runSpan.setStatus({ code: SpanStatusCode.ERROR });
      this.runSpan.end();
    }

    totalDuration.record(total, attrs);
    evaluationsCounter.add(1, attrs);

    this.span.setAttributes({
      'amp.total.duration_ms': Math.round(total),
      'amp.eval.outcome': outcome,
    });
    if (outcome === 'failed') {
      this.span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : undefined,
      });
      if (error instanceof Error) this.span.recordException(error);
    }
    this.span.end();
  }
}
