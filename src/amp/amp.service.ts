import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { validateUrlRestriction } from '../common/util';
import { EvaluationStreamService } from './evaluation/evaluation-stream.service';
import { HtmlFileDto } from './dto/html-file.dto';
import type { EvaluationRequestContext } from './evaluation/evaluation-telemetry';

@Injectable()
export class AmpService {
  private readonly blackList: string[];

  constructor(
    private readonly configService: ConfigService,
    private readonly evaluationStream: EvaluationStreamService,
  ) {
    this.blackList = (this.configService.get<string>('IP_BLACKLIST_RANGES') || '').split(',');
  }

  /** Checks SSRF and the blacklist. Throws an HTTP exception if the URL is invalid or restricted. */
  async validateUrl(url: string): Promise<void> {
    await validateUrlRestriction(url, this.blackList);
  }

  /** Evaluates the validated URL through the queue and emits lifecycle events as SSE. */
  streamUrlEvaluation(
    url: string,
    clientSignal: AbortSignal,
    request?: EvaluationRequestContext,
  ): Observable<MessageEvent> {
    return this.evaluationStream.streamEvaluation(
      { payload: url, type: 'url' },
      clientSignal,
      request,
    );
  }

  /** Evaluates submitted HTML through the queue and emits lifecycle events as SSE. */
  streamHtmlEvaluation(
    html: string,
    clientSignal: AbortSignal,
    request?: EvaluationRequestContext,
  ): Observable<MessageEvent> {
    return this.evaluationStream.streamEvaluation(
      { payload: html, type: 'html' },
      clientSignal,
      request,
    );
  }

  /** Evaluates an HTML file already validated by HtmlFilePipe. */
  streamHtmlFileEvaluation(
    file: HtmlFileDto,
    clientSignal: AbortSignal,
    request?: EvaluationRequestContext,
  ): Observable<MessageEvent> {
    const html = file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    return this.streamHtmlEvaluation(html, clientSignal, request);
  }
}
