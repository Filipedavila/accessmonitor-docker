import { ConfigService } from '@nestjs/config';
import { EvaluationQueueService, QueueAbortError } from './evaluation-queue.service';

const makeQueue = (max: number) =>
  new EvaluationQueueService({ get: () => max } as unknown as ConfigService);

const deferred = <T = void>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('EvaluationQueueService', () => {
  it('uses default concurrency of 3 when not configured', () => {
    const q = new EvaluationQueueService({ get: () => undefined } as unknown as ConfigService);
    expect(q.maxConcurrency).toBe(3);
  });

  it('limits concurrency and advances queue positions', async () => {
    const q = makeQueue(1);
    const gates = [deferred(), deferred(), deferred()];
    const started: string[] = [];
    const run = (i: number) =>
      q.submit({
        id: `r${i}`,
        signal: new AbortController().signal,
        onStart: () => started.push(`r${i}`),
        task: () => gates[i].promise,
      });

    const ps = [run(0), run(1), run(2)];
    await tick();
    expect(q.activeCount).toBe(1);
    expect(q.getQueuePosition('r1')).toBe(1);
    expect(q.getQueuePosition('r2')).toBe(2);
    expect(q.pendingCount).toBe(2);

    gates[0].resolve();
    await ps[0];
    await tick();
    expect(started).toEqual(['r0', 'r1']);
    expect(q.getQueuePosition('r2')).toBe(1);

    gates[1].resolve();
    gates[2].resolve();
    await Promise.all(ps);
    await tick();
    expect(q.activeCount).toBe(0);
    expect(q.pendingCount).toBe(0);
  });

  it('cancelling while queued rejects and never runs the task', async () => {
    const q = makeQueue(1);
    const gate = deferred();
    const first = q.submit({
      id: 'a',
      signal: new AbortController().signal,
      task: () => gate.promise,
    });
    await tick();

    const ac = new AbortController();
    const task = jest.fn().mockResolvedValue('x');
    const second = q.submit({ id: 'b', signal: ac.signal, task });
    await tick();
    expect(q.getQueuePosition('b')).toBe(1);

    ac.abort();
    await expect(second).rejects.toBeInstanceOf(QueueAbortError);
    expect(q.pendingCount).toBe(0);

    gate.resolve();
    await first;
    await tick();
    expect(task).not.toHaveBeenCalled();
  });

  it('rejects immediately when already aborted', async () => {
    const q = makeQueue(1);
    const ac = new AbortController();
    ac.abort();
    const task = jest.fn();
    await expect(q.submit({ id: 'a', signal: ac.signal, task })).rejects.toBeInstanceOf(
      QueueAbortError,
    );
    expect(task).not.toHaveBeenCalled();
  });

  it('frees the slot when the task fails', async () => {
    const q = makeQueue(1);
    await expect(
      q.submit({
        id: 'a',
        signal: new AbortController().signal,
        task: () => Promise.reject(new Error('boom')),
      }),
    ).rejects.toThrow('boom');
    await expect(
      q.submit({ id: 'b', signal: new AbortController().signal, task: async () => 'ok' }),
    ).resolves.toBe('ok');
  });
});
