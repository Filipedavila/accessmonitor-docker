import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pLimit from 'p-limit';

export const DEFAULT_MAX_CONCURRENCY = 3;

export class QueueAbortError extends Error {
  constructor(message = 'Evaluation aborted by client') {
    super(message);
    this.name = 'QueueAbortError';
  }
}

export interface QueueSubmitOptions<T> {
  /** Unique request ID used to calculate its queue position. */
  id: string;
  /** Cancellation signal, such as when the client disconnects. */
  signal: AbortSignal;
  /** Called when the request gets a slot, just before `task` runs. */
  onStart?: () => void;
  /** Work to run in the slot. */
  task: (signal: AbortSignal) => Promise<T>;
}

type QueueListener = () => void;

/**
 * In-memory semaphore and queue using p-limit. State is not persisted.
 */
@Injectable()
export class EvaluationQueueService {
  private readonly logger = new Logger(EvaluationQueueService.name);
  private readonly limit: ReturnType<typeof pLimit>;
  private readonly waiting: string[] = [];
  private readonly listeners = new Set<QueueListener>();
  readonly maxConcurrency: number;

  constructor(private readonly configService: ConfigService) {
    const raw = Number(
      this.configService.get<string | number>('QUALWEB_MAX_CONCURRENCY') ??
        process.env.QUALWEB_MAX_CONCURRENCY ??
        DEFAULT_MAX_CONCURRENCY,
    );
    this.maxConcurrency = Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_MAX_CONCURRENCY;
    this.limit = pLimit(this.maxConcurrency);
  }

  /** Number of tasks currently running. */
  get activeCount(): number {
    return this.limit.activeCount;
  }

  /** Number of requests waiting for a slot. */
  get pendingCount(): number {
    return this.waiting.length;
  }

  /** Queue position, starting at 1. Returns 0 if the request is not waiting. */
  getQueuePosition(id: string): number {
    const index = this.waiting.indexOf(id);
    return index === -1 ? 0 : index + 1;
  }

  /** Listen for queue changes. Returns a function to unsubscribe. */
  onChange(listener: QueueListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Add the request to the queue. If `signal` aborts while it is waiting, the promise
   * rejects immediately and the request is removed without using a slot.
   */
  submit<T>(options: QueueSubmitOptions<T>): Promise<T> {
    const { id, signal, onStart, task } = options;

    if (signal.aborted) {
      return Promise.reject(new QueueAbortError());
    }

    return new Promise<T>((resolve, reject) => {
      let started = false;

      const onAbort = () => {
        if (started) return; // The running task handles the signal.
        this.removeWaiting(id);
        reject(new QueueAbortError());
      };
      signal.addEventListener('abort', onAbort, { once: true });

      this.waiting.push(id);
      this.notify();

      this.limit(async () => {
        // Do not use a slot if the request was canceled while waiting.
        if (signal.aborted) {
          return;
        }
        started = true;
        this.removeWaiting(id);
        try {
          onStart?.();
          resolve(await task(signal));
        } catch (error) {
          reject(error);
        }
      })
        .catch((error) => reject(error))
        .finally(() => {
          signal.removeEventListener('abort', onAbort);
          this.removeWaiting(id);
          this.notify();
        });
    });
  }

  private removeWaiting(id: string): void {
    const index = this.waiting.indexOf(id);
    if (index !== -1) {
      this.waiting.splice(index, 1);
      this.notify();
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        this.logger.warn(`Queue listener failed: ${String(error)}`);
      }
    }
  }
}
