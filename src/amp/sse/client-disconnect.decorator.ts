import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Response } from 'express';

/** Provides an `AbortSignal` that fires if the client disconnects before the response ends. */
export const ClientDisconnect = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AbortSignal => {
    const res = context.switchToHttp().getResponse<Response>();
    const controller = new AbortController();
    res.once('close', () => {
      if (!res.writableEnded) controller.abort();
    });
    return controller.signal;
  },
);
