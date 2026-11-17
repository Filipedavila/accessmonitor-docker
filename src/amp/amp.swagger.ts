import { applyDecorators } from '@nestjs/common';
import {
  ApiBasicAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

export const AmpDocs = {
  controller: () =>
    applyDecorators(
      ApiBasicAuth(),
      ApiTags('AMP - Accessibility Monitor Processing'),
    ),
  evaluateUrl: () =>
    applyDecorators(
      ApiOperation({ 
        summary: 'Evaluate page via URL with SSE streaming', 
        description: 'Evaluates the page at the given URL and streams the evaluation progress via Server-Sent Events (SSE). Events include: queued -> processing -> completed | failed. The URL is evaluated against accessibility rules using QualWeb Engine.'
      }),
      ApiQuery({
        name: 'url',
        required: true,
        type: String,
        description: 'The HTTP/HTTPS URL to evaluate',
      }),
      ApiResponse({
        status: 200,
        description: 'SSE stream of evaluation events',
        content: {
          'text/event-stream': {
            schema: {
              type: 'string',
            },
          },
        },
      }),
      ApiResponse({
        status: 400,
        description: 'Invalid URL or validation failed',
      }),
    ),

  evaluateHtml: () =>
    applyDecorators(
      ApiOperation({ 
        summary: 'Evaluate HTML code with SSE streaming', 
        description: 'Evaluates the provided HTML code and streams the evaluation progress via Server-Sent Events (SSE). Events include: queued -> processing -> completed | failed. The HTML is evaluated against accessibility rules using QualWeb Engine.'
      }),
      ApiBody({
        schema: {
          type: 'object',
          properties: {
            html: {
              type: 'string',
              description: 'The HTML content to evaluate',
            },
          },
          required: ['html'],
        },
      }),
      ApiResponse({
        status: 200,
        description: 'SSE stream of evaluation events',
        content: {
          'text/event-stream': {
            schema: {
              type: 'string',
            },
          },
        },
      }),
      ApiResponse({
        status: 400,
        description: 'Invalid or missing HTML content',
      }),
    ),

  evaluateHtmlFile: () =>
    applyDecorators(
      ApiOperation({ 
        summary: 'Evaluate HTML file upload with SSE streaming', 
        description: 'Evaluates an uploaded HTML file and streams the evaluation progress via Server-Sent Events (SSE). Events include: queued -> processing -> completed | failed. Only .html files with text/html mimetype are accepted. The file is evaluated against accessibility rules using QualWeb Engine.'
      }),
      ApiConsumes('multipart/form-data'),
      ApiBody({
        schema: {
          type: 'object',
          properties: {
            file: {
              type: 'string',
              format: 'binary',
              description: 'HTML file to evaluate (.html extension, text/html mimetype)',
            },
          },
          required: ['file'],
        },
      }),
      ApiResponse({
        status: 200,
        description: 'SSE stream of evaluation events',
        content: {
          'text/event-stream': {
            schema: {
              type: 'string',
            },
          },
        },
      }),
      ApiResponse({
        status: 400,
        description: 'Invalid file format or content',
      }),
    ),
};

