import { QueueAbortError } from './evaluation-queue.service';
import { EvaluationAbortedError, EvaluationTimeoutError } from './evaluation.errors';

export interface FailedPayload {
  status: 'failed';
  code: 'EVALUATION_TIMEOUT' | 'EVALUATION_ABORTED' | 'EVALUATION_FAILED';
  message: string;
}

export function toFailedPayload(error: unknown): FailedPayload {
  if (error instanceof EvaluationTimeoutError) {
    return {
      status: 'failed',
      code: 'EVALUATION_TIMEOUT',
      message: 'Page took too long to respond',
    };
  }
  if (error instanceof EvaluationAbortedError || error instanceof QueueAbortError) {
    return { status: 'failed', code: 'EVALUATION_ABORTED', message: 'Evaluation canceled' };
  }
  return {
    status: 'failed',
    code: 'EVALUATION_FAILED',
    message: 'Unable to evaluate the page',
  };
}
