import {
  Controller,
  Get,
  Post,
  Param,
  Request,
  HttpCode,
  ForbiddenException,
} from '@nestjs/common';



import { AmpContract, AmpDocs } from './amp.swagger';
import { UrlRequestDto } from './dto/url-request.dto';
import { AmpService } from './amp.service';

@AmpDocs.controller()
@Controller('amp')
export class AmpController implements AmpContract {
  constructor(private readonly ampService: AmpService,
  ) {}

  @AmpDocs.evaluateUrl()
  @Get('eval/:url')
  @HttpCode(200)
  async evaluateUrl(
    @Request() req: any,
    @Param() params: UrlRequestDto,
  ): Promise<any> {
    if (process.env.REFERER) {
      if (!req.headers.referer?.startsWith(process.env.REFERER)) {
        throw new ForbiddenException('Forbidden');
      }
    }
    return await this.ampService.evaluateUrl(params.url);
  }

  @AmpDocs.evaluateHtml()
  @Post('eval/html')
  @HttpCode(200)
  async evaluateHtml(@Request() req: any): Promise<any> {
    if (process.env.REFERER) {
      if (!req.headers.referer?.startsWith(process.env.REFERER)) {
        throw new ForbiddenException('Forbidden');
      }
    }
    return await this.ampService.evaluateHtml(req.body.html);
  }
}
