import { MessageEvent } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EvaluationQueueService } from './evaluation-queue.service';
import { EvaluationStreamService } from './evaluation-stream.service';
import { EvaluationPublicService } from './evaluation-public.service';
import { EvaluationTimeoutError } from './evaluation.errors';

const tick = () => new Promise((r) => setTimeout(r, 0));
const deferred = <T = unknown>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};

describe('EvaluationStreamService', () => {
  const report = { metadata: {}, snapshot: {}, telemetry: {}, scoring: {} };
  let queue: EvaluationQueueService;
  let evaluate: jest.Mock;
  let service: EvaluationStreamService;

  beforeEach(() => {
    queue = new EvaluationQueueService({ get: () => 1 } as unknown as ConfigService);
    evaluate = jest.fn();
    service = new EvaluationStreamService(queue, {
      evaluateAuditReport: evaluate,
    } as unknown as EvaluationPublicService);
  });

  const collect = (input: { payload: string; type: 'url' | 'html' }, signal?: AbortSignal) => {
    const events: MessageEvent[] = [];
    let completed = false;
    const sub = service.streamEvaluation(input, signal).subscribe({
      next: (e) => events.push(e),
      complete: () => (completed = true),
    });
    return { events, sub, isCompleted: () => completed };
  };

  it('emits processing then completed and closes the stream (url)', async () => {
    evaluate.mockResolvedValue(report);
    const s = collect({ payload: 'https://a.pt', type: 'url' });
    await tick();
    expect(s.events.map((e) => e.type)).toEqual(['processing', 'completed']);
    expect(s.events[0].data).toEqual({ status: 'evaluating', url: 'https://a.pt' });
    expect(s.events[1].data).toBe(report);
    expect(s.isCompleted()).toBe(true);
  });

  it('does not leak the html payload in the processing event', async () => {
    evaluate.mockResolvedValue(report);
    const s = collect({ payload: '<p>secret</p>', type: 'html' });
    await tick();
    expect(s.events[0].data).toEqual({ status: 'evaluating', type: 'html' });
  });

  it('emits queued with position and slots while waiting, then processing', async () => {
    const gate = deferred();
    evaluate.mockImplementationOnce(() => gate.promise).mockResolvedValue(report);
    const first = collect({ payload: 'a', type: 'html' });
    await tick();
    const second = collect({ payload: 'b', type: 'html' });
    await tick();

    expect(second.events).toEqual([
      {
        type: 'queued',
        data: { status: 'waiting', queuePosition: 1, activeSlots: 1, maxSlots: 1 },
      },
    ]);
    expect(first.events.map((e) => e.type)).toEqual(['processing']);

    gate.resolve(report);
    await tick();
    await tick();
    expect(second.events.map((e) => e.type)).toEqual(['queued', 'processing', 'completed']);
    expect(second.isCompleted()).toBe(true);
  });

  it('emits failed with a structured payload and closes', async () => {
    evaluate.mockRejectedValue(new EvaluationTimeoutError(30000));
    const s = collect({ payload: 'https://slow.pt', type: 'url' });
    await tick();
    expect(s.events.map((e) => e.type)).toEqual(['processing', 'failed']);
    expect(s.events[1].data).toMatchObject({ status: 'failed', code: 'EVALUATION_TIMEOUT' });
    expect(s.isCompleted()).toBe(true);
  });

  it('client abort while processing aborts the engine signal and emits nothing more', async () => {
    const gate = deferred();
    let engineSignal!: AbortSignal;
    evaluate.mockImplementation((_i, signal: AbortSignal) => {
      engineSignal = signal;
      return gate.promise;
    });
    const client = new AbortController();
    const s = collect({ payload: 'a', type: 'html' }, client.signal);
    await tick();
    expect(engineSignal.aborted).toBe(false);

    client.abort();
    expect(engineSignal.aborted).toBe(true);
    expect(s.isCompleted()).toBe(true);
    gate.reject(new Error('aborted'));
    await tick();
    expect(s.events.map((e) => e.type)).toEqual(['processing']);
  });

  it('already-aborted client never reaches the engine', async () => {
    const client = new AbortController();
    client.abort();
    const s = collect({ payload: 'a', type: 'html' }, client.signal);
    await tick();
    expect(evaluate).not.toHaveBeenCalled();
    expect(s.events).toEqual([]);
    expect(s.isCompleted()).toBe(true);
  });

  it('unsubscribing while queued frees the queue without running the task', async () => {
    const gate = deferred();
    evaluate.mockImplementationOnce(() => gate.promise).mockResolvedValue(report);
    collect({ payload: 'a', type: 'html' });
    await tick();
    const second = collect({ payload: 'b', type: 'html' });
    await tick();
    expect(queue.pendingCount).toBe(1);

    second.sub.unsubscribe();
    await tick();
    expect(queue.pendingCount).toBe(0);
    gate.resolve(report);
    await tick();
    expect(evaluate).toHaveBeenCalledTimes(1);
  });
});
