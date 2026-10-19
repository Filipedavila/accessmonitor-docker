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
    try {
      const rawEvaluationResult = await this.evaluationEngine.evaluate(
        input.payload,
        input.type,
      );

      if (!rawEvaluationResult) {
        throw new Error('Evaluation Engine returned no result');
      }

      const evaluationStream = this.createCompressedEvaluationStream(rawEvaluationResult);

      return evaluationStream;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const targetIdentifier = input.type === 'url' ? input.payload : '[HTML Payload]';

      this.logger.error(
        `Erro na avaliação síncrona (${input.type} - ${targetIdentifier}): ${err.message}`,
        err.stack,
      );

      throw err;
    }
  }

}