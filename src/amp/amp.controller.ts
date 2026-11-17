import {
  BadRequestException,
  Body,
  Controller,
  Ip,
  MessageEvent,
  Query,
  Sse,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AmpDocs } from './amp.swagger';
import { AmpService } from './amp.service';
import { HtmlFileDto } from './dto/html-file.dto';
import { UrlQueryDto } from './dto/url-query.dto';
import { HtmlUploadGuard } from './guards/html-upload.guard';
import { RefererGuard } from './guards/referer.guard';
import { HtmlFilePipe } from './pipes/html-file.pipe';
import { ClientDisconnect } from './sse/client-disconnect.decorator';
import { SsePost } from './sse/sse-post.decorator';

@AmpDocs.controller()
@UseGuards(RefererGuard)
@Controller('amp')
export class AmpController {
  constructor(private readonly ampService: AmpService) {}

  @AmpDocs.evaluateUrl()
  @Sse('eval/stream')
  async streamEvaluation(
    @Query() query: UrlQueryDto,
    @ClientDisconnect() clientSignal: AbortSignal,
    @Ip() clientIp: string,
  ): Promise<Observable<MessageEvent>> {
    await this.ampService.validateUrl(query.url);
    return this.ampService.streamUrlEvaluation(query.url, clientSignal, { clientIp });
  }

  @AmpDocs.evaluateHtml()
  @SsePost('eval/html')
  streamHtmlEvaluation(
    @Body('html') html: string,
    @ClientDisconnect() clientSignal: AbortSignal,
    @Ip() clientIp: string,
  ): Observable<MessageEvent> {
    if (!html || typeof html !== 'string') {
      throw new BadRequestException('Field "html" is required and must be a string');
    }
    return this.ampService.streamHtmlEvaluation(html, clientSignal, { clientIp });
  }

  @SsePost('eval/file')
  @UseGuards(HtmlUploadGuard)
  streamHtmlFileEvaluation(
    @UploadedFile(HtmlFilePipe) file: HtmlFileDto,
    @ClientDisconnect() clientSignal: AbortSignal,
    @Ip() clientIp: string,
  ): Observable<MessageEvent> {
    return this.ampService.streamHtmlFileEvaluation(file, clientSignal, { clientIp });
  }
}
