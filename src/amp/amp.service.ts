import { Injectable } from '@nestjs/common';
import {
  executeHtmlEvaluation,
  executeUrlEvaluation,
} from '../util/middleware';
import dns from 'node:dns';
import ipRangeCheck from 'ip-range-check';
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
    const isValid = await this.checkIfValidUrl(url);

    if (!isValid) {
      return { status: 403, message: 'Forbidden' };
    }
    return await executeUrlEvaluation(url);
  }

  async evaluateHtml(html: string): Promise<any> {
    return await executeHtmlEvaluation(html);
  }

  private checkIfValidUrl(url: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      dns.lookup(this.fixUrl(url), (err: any, addr: any) => {
        const isValid = !ipRangeCheck(addr, this.blackList);
        resolve(isValid);
      });
    });
  }

  private fixUrl(url: string): string {
    url = url.replace('http://', '').replace('https://', '');
    return url.split('/')[0];
  }
}
