import { QueueAbortError } from './evaluation-queue.service';
import { EvaluationAbortedError, EvaluationTimeoutError } from './evaluation.errors';
import { toFailedPayload } from './evaluation-failure.mapper';

describe('toFailedPayload', () => {
  it.each([
    [new EvaluationTimeoutError(30000), 'EVALUATION_TIMEOUT'],
    [new EvaluationAbortedError(), 'EVALUATION_ABORTED'],
    [new QueueAbortError(), 'EVALUATION_ABORTED'],
    [new Error('chromium crashed'), 'EVALUATION_FAILED'],
    ['string error', 'EVALUATION_FAILED'],
  ])('maps %p to %s', (error, code) => {
    expect(toFailedPayload(error)).toMatchObject({ status: 'failed', code });
  });

  it('never leaks the internal error message', () => {
    expect(JSON.stringify(toFailedPayload(new Error('secret stack detail')))).not.toContain('secret');
  });
});
