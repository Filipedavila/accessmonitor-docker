import { Injectable, Logger, Inject } from '@nestjs/common';
import { EVALUATION_ENGINE } from './contracts/evaluation-engine.contract';
import type { EvaluationEngine } from './contracts/evaluation-engine.contract';
import { EvaluationParserService } from './evaluation-parser.service';
import { Readable, pipeline } from 'stream';
import { createGzip } from 'zlib';
import type { ReadableStream as NodeWebReadableStream } from 'stream/web';
import { AuditReport } from './types';

export type EvaluationType = 'url' | 'html';

export interface EvaluatePublicPageInput {
  payload: string;
  type: EvaluationType;
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
  ) {}

  /**
   * Converts the raw report into a Gzip-compressed Web ReadableStream.
   */
  private createCompressedEvaluationStream(rawEvaluationResult: unknown): NodeWebReadableStream {
    const { evaluationReport, evaluationData } =
      this.evaluationParser.parseEvaluation(rawEvaluationResult);

    const payloadString = JSON.stringify({ evaluationReport, evaluationData });

    const sourceStream = Readable.from([payloadString]);
    const gzipStream = createGzip({ level: 6 });

    pipeline(sourceStream, gzipStream, (err) => {
      if (err) {
        this.logger.error(`Failure in Gzip compression pipeline: ${err.message}`, err.stack);
      }
    });

    return Readable.toWeb(gzipStream);
  }
  /**
   * Evaluates the page and returns an uncompressed AuditReport for the SSE `completed` event.
   * The engine uses `signal` to handle cancellation.
   */
  public async evaluateAuditReport(
    input: EvaluatePublicPageInput,
    signal?: AbortSignal,
  ): Promise<AuditReport> {
    try {
      const raw = await this.evaluationEngine.evaluate(input.payload, input.type, { signal });
      if (!raw) {
        throw new Error('Evaluation Engine returned no result');
      }
      return this.evaluationParser.parseEvaluation(raw).evaluationReport;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (!signal?.aborted) {
        const target = input.type === 'url' ? input.payload : '[HTML Payload]';
        this.logger.error(
          `Error in evaluation (${input.type} - ${target}): ${err.message}`,
          err.stack,
        );
      }
      throw err;
    }
  }

  public async evaluatePage(input: EvaluatePublicPageInput): Promise<NodeWebReadableStream> {
    try {
      const rawEvaluationResult = await this.evaluationEngine.evaluate(input.payload, input.type);

      if (!rawEvaluationResult) {
        throw new Error('Evaluation Engine returned no result');
      }

      const evaluationStream = this.createCompressedEvaluationStream(rawEvaluationResult);

      return evaluationStream;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const targetIdentifier = input.type === 'url' ? input.payload : '[HTML Payload]';

      this.logger.error(
        `Error in evaluation (${input.type} - ${targetIdentifier}): ${err.message}`,
        err.stack,
      );

      throw err;
    }
  }
}
