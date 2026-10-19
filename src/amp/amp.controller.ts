import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Headers,
  HttpCode,
  ForbiddenException,
  StreamableFile,
  Header,
  BadRequestException,
  Ip,
} from '@nestjs/common';
import { Readable } from 'stream';
import { ReadableStream as WebReadableStream } from 'stream/web';

import {  AmpDocs } from './amp.swagger';
import { UrlRequestDto } from './dto/url-request.dto';
import { AmpService } from './amp.service';

@AmpDocs.controller()
@Controller('amp')
export class AmpController {
  constructor(private readonly ampService: AmpService) {}

  private validateReferer(referer?: string): void {
    const allowedReferer = process.env.REFERER;
    if (allowedReferer && !referer?.startsWith(allowedReferer)) {
      throw new ForbiddenException('Forbidden');
    }
  }

  private toStreamableFile(streamOrResult: unknown): StreamableFile {
    // Caso o AmpService devolva { evaluation: ReadableStream | Readable }
    const rawStream =
      streamOrResult &&
      typeof streamOrResult === 'object' &&
      'evaluation' in streamOrResult
        ? (streamOrResult as { evaluation: unknown }).evaluation
        : streamOrResult;

    if (rawStream instanceof Readable) {
      return new StreamableFile(rawStream);
    }

    if (rawStream && typeof (rawStream as WebReadableStream).getReader === 'function') {
      const nodeStream = Readable.fromWeb(rawStream as WebReadableStream);
      return new StreamableFile(nodeStream);
    }

    throw new Error('Invalid stream returned from evaluation service');
  }

  @AmpDocs.evaluateUrl()
  @Get('eval/:url')
  @HttpCode(200)
  @Header('Content-Type', 'application/json; charset=utf-8')
  @Header('Content-Encoding', 'gzip')
  async evaluateUrl(
    @Headers('referer') referer: string | undefined,
    @Param() params: UrlRequestDto,
    @Ip() clientIp: string,
  ): Promise<StreamableFile> {
    this.validateReferer(referer);

    const result = await this.ampService.evaluateUrl(params.url, clientIp);
    return this.toStreamableFile(result);
  }

  @AmpDocs.evaluateHtml()
  @Post('eval/html')
  @HttpCode(200)
  @Header('Content-Type', 'application/json; charset=utf-8')
  @Header('Content-Encoding', 'gzip')
  async evaluateHtml(
    @Headers('referer') referer: string | undefined,
    @Body('html') html: string,
    @Ip() clientIp: string,
  ): Promise<StreamableFile> {
    this.validateReferer(referer);

    if (!html || typeof html !== 'string') {
      throw new BadRequestException('Field "html" is required and must be a string');
    }

    const result = await this.ampService.evaluateHtml(html, clientIp);
    return this.toStreamableFile(result);
  }
}
