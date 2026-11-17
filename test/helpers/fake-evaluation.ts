import { EvaluationAbortedError } from '../../src/amp/evaluation/evaluation.errors';
import type { AuditReport } from '../../src/amp/evaluation/types';

export function buildReport(id: string): AuditReport {
  return {
    metadata: { title: id, url: id, evaluatedAt: new Date().toISOString() },
    snapshot: { html: '<html></html>', sizeInBytes: 13, hash: 'e2e-hash' },
    telemetry: { totalHtmlTags: 1, tagCounter: { html: 1 }, elementCounters: {}, roles: {} },
    scoring: {
      conform: '1@2@3',
      totalTests: 10,
      score: '7.5',
      rulesOccurrences: {},
      assertionEvidence: {},
      conformanceResults: {},
    },
  };
}

interface Deferred {
  resolve: () => void;
  reject: (e: Error) => void;
}

/**
 * Substitui o EvaluationPublicService (sem Chromium/rede) para testar fila e SSE de forma
 * determinística. `auto`: conclui sozinho. `manual`: espera por `release(id)` / `fail(id)`.
 */
export class FakeEvaluationService {
  mode: 'auto' | 'manual' = 'auto';
  autoDelayMs = 10;
  readonly startOrder: string[] = [];
  readonly abortedIds: string[] = [];
  active = 0;
  maxActive = 0;
  private readonly holds = new Map<string, Deferred>();

  reset(mode: 'auto' | 'manual' = 'auto'): void {
    this.mode = mode;
    this.startOrder.length = 0;
    this.abortedIds.length = 0;
    this.active = 0;
    this.maxActive = 0;
    this.holds.clear();
  }

  /** Para HTML o id é o conteúdo de <title>; para URL é o próprio URL. */
  static idOf(payload: string): string {
    return /<title>(.*?)<\/title>/.exec(payload)?.[1] ?? payload;
  }

  release(id: string): void {
    this.holds.get(id)?.resolve();
  }

  fail(id: string, error: Error): void {
    this.holds.get(id)?.reject(error);
  }

  async evaluateAuditReport(
    input: { payload: string; type: 'url' | 'html' },
    signal?: AbortSignal,
  ): Promise<AuditReport> {
    const id = FakeEvaluationService.idOf(input.payload);
    this.startOrder.push(id);
    this.active++;
    this.maxActive = Math.max(this.maxActive, this.active);
    try {
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          this.abortedIds.push(id);
          reject(new EvaluationAbortedError());
        };
        if (signal?.aborted) return onAbort();
        signal?.addEventListener('abort', onAbort, { once: true });
        if (this.mode === 'auto') {
          setTimeout(resolve, this.autoDelayMs);
        } else {
          this.holds.set(id, { resolve, reject });
        }
      });
      return buildReport(id);
    } finally {
      this.active--;
      this.holds.delete(id);
    }
  }
}
