import { EvaluationQueueService } from '../src/amp/evaluation/evaluation-queue.service';
import { EvaluationTimeoutError } from '../src/amp/evaluation/evaluation.errors';
import { createTestApp, TestApp } from './helpers/test-app';
import { htmlBody, SseClient, waitUntil } from './helpers/sse';

jest.setTimeout(60_000);

const MAX = 3;
const TOTAL = 8;

describe('Queue + SSE e2e (concorrência)', () => {
  let ctx: TestApp;
  let queue: EvaluationQueueService;
  let url: string;
  const clients: SseClient[] = [];

  const open = (id: string): SseClient => {
    const c = new SseClient(url, htmlBody(id));
    clients.push(c);
    return c;
  };

  beforeAll(async () => {
    ctx = await createTestApp(MAX);
    queue = ctx.app.get(EvaluationQueueService);
    url = `${ctx.baseUrl}/amp/eval/html`;
  });
  afterAll(() => ctx.app.close());

  beforeEach(() => ctx.fake.reset('manual'));
  afterEach(async () => {
    clients.splice(0).forEach((c) => c.abort());
    await waitUntil(() => queue.activeCount === 0 && queue.pendingCount === 0, 5000, 'fila vazia');
  });

  it('respeita o limite de concorrência e avança a fila por ordem (FIFO)', async () => {
    expect(queue.maxConcurrency).toBe(MAX);
    const all = Array.from({ length: TOTAL }, (_, i) => open(`req-${i}`));

    // Pedidos simultâneos: só MAX ficam a processar, os restantes esperam na fila.
    await waitUntil(
      () => queue.activeCount === MAX && queue.pendingCount === TOTAL - MAX,
      5000,
      'fila cheia',
    );
    expect(ctx.fake.active).toBe(MAX);

    const processing = all.filter((c) => c.of('processing').length > 0);
    const queued = all.filter((c) => c.of('processing').length === 0);
    expect(processing).toHaveLength(MAX);
    expect(queued).toHaveLength(TOTAL - MAX);
    processing.forEach((c) => expect(c.of('queued')).toHaveLength(0));

    for (const c of queued) {
      await c.waitFor('queued');
      expect(c.of('processing')).toHaveLength(0);
      expect(c.of('queued')[0].data).toMatchObject({
        status: 'waiting',
        activeSlots: MAX,
        maxSlots: MAX,
      });
    }
    const firstPositions = queued
      .map((c) => c.of('queued')[0].data.queuePosition)
      .sort((a, b) => a - b);
    expect(firstPositions).toEqual([1, 2, 3, 4, 5]);

    // Ordem de chegada à fila = ordem de execução.
    const expectedQueueOrder = [...queued]
      .sort((a, b) => a.of('queued')[0].data.queuePosition - b.of('queued')[0].data.queuePosition)
      .map((c) => `req-${all.indexOf(c)}`);
    const startedFirst = [...ctx.fake.startOrder];

    // Liberta um slot de cada vez: a fila avança e nunca passa de MAX em paralelo.
    for (let done = 0; done < TOTAL; done++) {
      await waitUntil(
        () => ctx.fake.startOrder.length >= Math.min(TOTAL, MAX + done),
        5000,
        'próximo arrancar',
      );
      ctx.fake.release(ctx.fake.startOrder[done]);
      await waitUntil(
        () => queue.pendingCount === Math.max(0, TOTAL - MAX - done - 1),
        5000,
        'fila avançar',
      );
    }

    await Promise.all(all.map((c) => c.done));
    expect(ctx.fake.maxActive).toBe(MAX);
    expect(ctx.fake.startOrder).toHaveLength(TOTAL);
    expect(ctx.fake.startOrder.slice(0, MAX).sort()).toEqual(startedFirst.sort());
    expect(ctx.fake.startOrder.slice(MAX)).toEqual(expectedQueueOrder);

    for (const c of all) {
      expect(c.status).toBe(200);
      expect(c.headers.get('content-type')).toContain('text/event-stream');
      // Ordem do ciclo de vida: [queued...] -> processing -> completed, e o stream fecha.
      const names = c.names;
      expect(names[names.length - 1]).toBe('completed');
      expect(names.filter((n) => n === 'processing')).toHaveLength(1);
      expect(names.indexOf('processing')).toBeLessThan(names.indexOf('completed'));
      expect(names.every((n) => ['queued', 'processing', 'completed'].includes(n))).toBe(true);
      // Posições na fila só diminuem.
      const positions = c.of('queued').map((e) => e.data.queuePosition as number);
      expect([...positions].sort((a, b) => b - a)).toEqual(positions);
      expect(c.of('completed')[0].data).toHaveProperty('scoring.conform', '1@2@3');
    }
    expect(queued.every((c) => c.of('queued').length >= 1)).toBe(true);
  });

  it('cliente que desiste na fila não ocupa slot nem chega a executar', async () => {
    const running = Array.from({ length: MAX }, (_, i) => open(`run-${i}`));
    await waitUntil(() => queue.activeCount === MAX, 5000, 'slots ocupados');
    const waiting = open('quitter');
    const stay = open('stayer');
    await waiting.waitFor('queued');
    await stay.waitFor('queued');
    expect(queue.pendingCount).toBe(2);

    waiting.abort();
    await waitUntil(() => queue.pendingCount === 1, 5000, 'item removido da fila');
    expect(ctx.fake.startOrder).not.toContain('quitter');

    // O que ficou passa a posição 1 e é o próximo a correr.
    ctx.fake.release('run-0');
    await stay.waitFor('processing');
    expect(ctx.fake.startOrder).not.toContain('quitter');
    expect(ctx.fake.startOrder[MAX]).toBe('stayer');

    ctx.fake.release('stayer');
    running.slice(1).forEach((_, i) => ctx.fake.release(`run-${i + 1}`));
    await stay.done;
    expect(stay.names[stay.names.length - 1]).toBe('completed');
    expect(ctx.fake.startOrder).not.toContain('quitter');
  });

  it('cliente que desiste a meio do processamento aborta o engine e liberta o slot', async () => {
    const running = Array.from({ length: MAX }, (_, i) => open(`run-${i}`));
    await waitUntil(() => queue.activeCount === MAX, 5000, 'slots ocupados');
    const next = open('next');
    await next.waitFor('queued');

    running[0].abort(); // fecha a ligação durante a avaliação
    await waitUntil(
      () => ctx.fake.abortedIds.includes('run-0'),
      5000,
      'engine abortado (page.close)',
    );
    await next.waitFor('processing'); // slot libertado -> a fila avança
    expect(ctx.fake.startOrder[MAX]).toBe('next');

    ['run-1', 'run-2', 'next'].forEach((id) => ctx.fake.release(id));
    await next.done;
    expect(next.names[next.names.length - 1]).toBe('completed');
  });

  it('falha de avaliação emite failed estruturado, fecha o stream e liberta o slot', async () => {
    const a = open('boom');
    await a.waitFor('processing');
    ctx.fake.fail('boom', new Error('chromium crashed'));
    await a.done;
    expect(a.names).toEqual(['processing', 'failed']);
    expect(a.of('failed')[0].data).toMatchObject({ status: 'failed', code: 'EVALUATION_FAILED' });
    await waitUntil(() => queue.activeCount === 0, 5000, 'slot libertado');
  });

  it('timeout de avaliação emite failed com EVALUATION_TIMEOUT', async () => {
    const a = open('slow');
    await a.waitFor('processing');
    ctx.fake.fail('slow', new EvaluationTimeoutError(30_000));
    await a.done;
    expect(a.of('failed')[0].data).toMatchObject({ status: 'failed', code: 'EVALUATION_TIMEOUT' });
  });

  it('uma falha não bloqueia a fila: o pedido seguinte arranca', async () => {
    const running = Array.from({ length: MAX }, (_, i) => open(`run-${i}`));
    await waitUntil(() => queue.activeCount === MAX, 5000, 'slots ocupados');
    const next = open('after-failure');
    await next.waitFor('queued');
    ctx.fake.fail('run-0', new Error('boom'));
    await running[0].done;
    await next.waitFor('processing');
    ['run-1', 'run-2', 'after-failure'].forEach((id) => ctx.fake.release(id));
    await next.done;
    expect(next.names[next.names.length - 1]).toBe('completed');
  });
});
