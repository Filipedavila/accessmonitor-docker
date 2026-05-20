import { applyDecorators } from '@nestjs/common';
import {
  ApiBasicAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UrlRequestDto } from './dto/url-request.dto';

export const AmpDocs = {
  controller: () =>
    applyDecorators(
      ApiBasicAuth(),
      ApiTags('amp'),
      ApiResponse({ status: 403, description: 'Forbidden' }),
    ),
  evaluateUrl: () =>
    applyDecorators(
      ApiOperation({ summary: 'Evaluate page via url' }),
      ApiResponse({
        status: 200,
        description: 'Success',
        type: Boolean,
      }),
    ),

  evaluateHtml: () =>
    applyDecorators(
      ApiOperation({ summary: 'Evaluate html code' }),
      ApiResponse({
        status: 200,
        description: 'Success',
        type: Boolean,
      }),
    ),
};
export interface AmpContract {
  evaluateUrl: (req: any, url: UrlRequestDto) => Promise<boolean>;
  evaluateHtml: (req: any) => Promise<boolean>;
}
