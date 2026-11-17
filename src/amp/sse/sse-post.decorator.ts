import { applyDecorators, HttpCode, RequestMethod, Sse } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants';

/** Nest SSE decorator for POST routes. Responds with 200. */
export const SsePost = (path: string) =>
  applyDecorators(Sse(path, { [METHOD_METADATA]: RequestMethod.POST }), HttpCode(200));
