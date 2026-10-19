import { Injectable, Logger, Inject } from '@nestjs/common';
import { EVALUATION_ENGINE } from './contracts/evaluation-engine.contract';
import type { EvaluationEngine } from './contracts/evaluation-engine.contract';
import { EvaluationParserService } from './evaluation-parser.service';
import { EvaluationMetricsService } from './evaluation-metrics.service';
import { EvaluationAuditService } from './evaluation-audit.service';
import { Readable, pipeline } from 'stream';
import { createGzip } from 'zlib';
import type { ReadableStream as NodeWebReadableStream } from 'stream/web';
import { AuditReport } from './types';

export type EvaluationType = 'url' | 'html';

export interface EvaluatePublicPageInput {
  payload: string;
  type: EvaluationType;
  clientIp?: string;
}

export interface EvaluatePublicPageOutput {
  evaluation: ReadableStream;
}

@Injectable()
export class EvaluationPublicService {
  private readonly logger = new Logger(EvaluationPublicService.name);

  constructor(
    @Inject(EVALUATION_ENGINE)
    private readonly evaluationEngine: EvaluationEngine,
    private readonly evaluationParser: EvaluationParserService,
    private readonly evaluationMetrics: EvaluationMetricsService,
    private readonly evaluationAudit: EvaluationAuditService,
  ) {}

  /**
   * Transforma o relatório bruto e gera um Web ReadableStream comprimido em Gzip.
   */
private createCompressedEvaluationStream(
  rawEvaluationResult: AuditReport,
): NodeWebReadableStream {
  const { evaluationReport, evaluationData } =
    this.evaluationParser.parseEvaluation(rawEvaluationResult);

  const payloadString = JSON.stringify({ evaluationReport, evaluationData });

  const sourceStream = Readable.from([payloadString]);
  const gzipStream = createGzip({ level: 6 });

  pipeline(sourceStream, gzipStream, (err) => {
    if (err) {
      this.logger.error(
        `Falha no pipeline de compressão Gzip: ${err.message}`,
        err.stack,
      );
    }
  });

  return Readable.toWeb(gzipStream);
}
  public async evaluatePage(input: EvaluatePublicPageInput): Promise<NodeWebReadableStream> {
    const startedAt = process.hrtime.bigint();
    const payloadSizeBytes = Buffer.byteLength(input.payload ?? '', 'utf8');

    try {
      const rawEvaluationResult = await this.evaluationEngine.evaluate(
        input.payload,
        input.type,
      );

      if (!rawEvaluationResult) {
        throw new Error('Evaluation Engine returned no result');
      }

      const evaluationStream = this.createCompressedEvaluationStream(rawEvaluationResult);

      const durationMs = this.elapsedMs(startedAt);
      this.recordTelemetry(input, 'success', durationMs, payloadSizeBytes);

      return evaluationStream;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const targetIdentifier = input.type === 'url' ? input.payload : '[HTML Payload]';

      const durationMs = this.elapsedMs(startedAt);
      this.recordTelemetry(input, 'error', durationMs, payloadSizeBytes, err.message);

      this.logger.error(
        `Erro na avaliação síncrona (${input.type} - ${targetIdentifier}): ${err.message}`,
        err.stack,
      );

      throw err;
    }
  }

  private elapsedMs(startedAt: bigint): number {
    return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  }

  private recordTelemetry(
    input: EvaluatePublicPageInput,
    status: 'success' | 'error',
    durationMs: number,
    payloadSizeBytes: number,
    errorMessage?: string,
  ): void {
    this.evaluationMetrics.recordEvaluation(input.type, status, durationMs / 1000);

    this.evaluationAudit.record({
      type: input.type,
      status,
      payload: input.payload,
      clientIp: input.clientIp,
      durationMs,
      payloadSizeBytes,
      errorMessage,
    });
  }

}
