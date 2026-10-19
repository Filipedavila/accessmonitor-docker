import { Injectable } from '@nestjs/common';
import { ReadableStream } from 'stream/web';

import { validateUrlRestriction } from '../common/util';

import { ConfigService } from '@nestjs/config/dist/config.service';
import { EvaluationPublicService } from './evaluation/evaluation-public.service';

@Injectable()
export class AmpService {
  private readonly blackList: string[];
  constructor(private readonly configService: ConfigService,
    private readonly evaluationPublicService: EvaluationPublicService,
  ) {
    this.blackList = (
      this.configService.get<string>('IP_BLACKLIST_RANGES') || ''
    ).split(',');
  }
  async evaluateUrl(url: string, clientIp?: string): Promise<ReadableStream> {
    await validateUrlRestriction(url, this.blackList);

    return await this.evaluationPublicService.evaluatePage({
      payload: url,
      type: 'url',
      clientIp,
    });
  }

  async evaluateHtml(html: string, clientIp?: string): Promise<ReadableStream> {
    return await this.evaluationPublicService.evaluatePage({
      payload: html,
      type: 'html',
      clientIp,
    });
  }

}
