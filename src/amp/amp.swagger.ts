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
      ApiTags('AMP - Accessibility Monitor Processing'),
    ),
  evaluateUrl: () =>
    applyDecorators(
      ApiOperation({ summary: 'Evaluate page via url and get the evaluation report', 
          description: 'Evaluates the page at the given URL and returns a report with the evaluation results. The URL is evaluated against a set of predefined rules and checks to determine if it meets certain criteria for accessibility using QualWeb Engine.'
      }),
      ApiResponse({
        status: 200,
        description: 'Success',
        type: Object,
      }),
    ),

  evaluateHtml: () =>
    applyDecorators(
      ApiOperation({ summary: 'Evaluate HTML code and get the evaluation report', 
        description: 'Evaluates the provided HTML code and returns a report with the evaluation results. The HTML is evaluated against a set of predefined rules and checks to determine if it meets certain criteria for accessibility using QualWeb Engine.'
      }),
      ApiResponse({
        status: 200,
        description: 'Success',
        type: Object
      }),
    ),
};
export interface AmpContract {
  evaluateUrl: (req: Request, url: UrlRequestDto) => Promise<object>;
  evaluateHtml: (req: Request) => Promise<object>;
}

