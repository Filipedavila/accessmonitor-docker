import {
  Controller,
  Get,
  Post,
  Param,
  Request,
  HttpCode,
} from '@nestjs/common';

import { RateLimit } from 'nestjs-rate-limiter';

import { AmpContract, AmpDocs } from './amp.swagger';
import { UrlRequestDto } from './dto/url-request.dto';
import { AmpService } from './amp.service';

@AmpDocs.controller()
@Controller('amp')
export class AmpController implements AmpContract {
  constructor(private readonly ampService: AmpService) {}

  @AmpDocs.evaluateUrl()
  @RateLimit({
    keyPrefix: 'amp',
    points: 3,
    duration: 1 * 60,
    blockDuration: 1 * 60,
  })
  @Get('eval/:url')
  @HttpCode(200)
  async evaluateUrl(
    @Request() req: any,
    @Param() params: UrlRequestDto,
  ): Promise<any> {
    if (process.env.REFERER) {
      if (!req.headers.referer?.startsWith(process.env.REFERER)) {
        return { status: 403, message: 'Forbidden' };
      }
    }
    return await this.ampService.evaluateUrl(params.url);
  }

  @AmpDocs.evaluateHtml()
  @RateLimit({
    keyPrefix: 'amp',
    points: 3,
    duration: 1 * 60,
    blockDuration: 1 * 60,
  })
  @Post('eval/html')
  @HttpCode(200)
  async evaluateHtml(@Request() req: any): Promise<any> {
    if (process.env.REFERER) {
      if (!req.headers.referer?.startsWith(process.env.REFERER)) {
        return { status: 403, message: 'Forbidden' };
      }
    }
    return await this.ampService.evaluateHtml(req.body.html);
  }
}
