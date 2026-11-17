import { Injectable, MessageEvent } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import { EvaluatePublicPageInput, EvaluationPublicService } from './evaluation-public.service';
import { EvaluationQueueService } from './evaluation-queue.service';
import { toFailedPayload } from './evaluation-failure.mapper';
import { EvaluationRequestContext, EvaluationTrace } from './evaluation-telemetry';

const HEARTBEAT_MS = 15_000;

/**
 * Sends queue lifecycle events over SSE: queued -> processing -> completed or failed.
 * Nest handles the connection and closes the response when the Observable completes.
 * If the client disconnects, teardown aborts the request.
 */
@Injectable()
export class EvaluationStreamService {
  constructor(
    private readonly queue: EvaluationQueueService,
    private readonly evaluationPublicService: EvaluationPublicService,
  ) {}

  streamEvaluation(
    input: EvaluatePublicPageInput,
    clientSignal?: AbortSignal,
    request: EvaluationRequestContext = {},
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const id = randomUUID();
      const telemetry = new EvaluationTrace(input, request);
      const abortController = new AbortController();
      let finished = false;

      // On client disconnect, cancel the request and end the stream.
      const onClientGone = (): void => {
        abortController.abort();
        subscriber.complete();
      };
      clientSignal?.addEventListener('abort', onClientGone, { once: true });
      if (clientSignal?.aborted) {
        onClientGone();
        return;
      }

      let lastPosition = -1;
      const emitQueued = (): void => {
        const position = this.queue.getQueuePosition(id);
        // Start immediately when a slot is free; do not send a `queued` event.
        if (position === 0 || position === lastPosition) return;
        if (this.queue.activeCount < this.queue.maxConcurrency) return;
        lastPosition = position;
        subscriber.next({
          type: 'queued',
          data: {
            status: 'waiting',
            queuePosition: position,
            activeSlots: this.queue.activeCount,
            maxSlots: this.queue.maxConcurrency,
          },
        });
      };
      const unsubscribeQueue = this.queue.onChange(emitQueued);

      // Keep proxies with idle timeouts open while the request is waiting.
      const heartbeat = setInterval(
        () => subscriber.next({ type: 'ping', data: '' }),
        HEARTBEAT_MS,
      );

      this.queue
        .submit({
          id,
          signal: abortController.signal,
          onStart: () => {
            telemetry.started();
            unsubscribeQueue();
            subscriber.next({
              type: 'processing',
              data:
                input.type === 'url'
                  ? { status: 'evaluating', url: input.payload }
                  : { status: 'evaluating', type: input.type },
            });
          },
          task: (signal) => this.evaluationPublicService.evaluateAuditReport(input, signal),
        })
        .then((report) => {
          telemetry.end('completed');
          subscriber.next({ type: 'completed', data: report });
        })
        .catch((error) => {
          // The client has disconnected, so there is no one to notify.
          if (abortController.signal.aborted) {
            telemetry.end('aborted');
          } else {
            telemetry.end('failed', error);
            subscriber.next({ type: 'failed', data: toFailedPayload(error) });
          }
        })
        .finally(() => {
          finished = true;
          unsubscribeQueue();
          clearInterval(heartbeat);
          subscriber.complete(); // Nest ends the response when the stream completes.
        });

      // Teardown: the client closed the connection before the request finished.
      return () => {
        clientSignal?.removeEventListener('abort', onClientGone);
        if (!finished) {
          abortController.abort();
          telemetry.end('aborted');
        }
        unsubscribeQueue();
        clearInterval(heartbeat);
      };
    });
  }
}
