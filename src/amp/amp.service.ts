import { Injectable } from '@nestjs/common';
import {
  executeHtmlEvaluation,
  executeUrlEvaluation,
} from '../util/middleware';
import { validateUrlRestriction } from '../common/util';

import { ConfigService } from '@nestjs/config/dist/config.service';

@Injectable()
export class AmpService {
  private readonly blackList: string[];
  constructor(private readonly configService: ConfigService) {
    this.blackList = (
      this.configService.get<string>('IP_BLACKLIST_RANGES') || ''
    ).split(',');
  }
  async evaluateUrl(url: string): Promise<any> {
    await validateUrlRestriction(url, this.blackList);

    return await executeUrlEvaluation(url);
  }

  async evaluateHtml(html: string): Promise<any> {
    return await executeHtmlEvaluation(html);
  }

}
