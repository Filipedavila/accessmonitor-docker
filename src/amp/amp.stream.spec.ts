import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ResponseTransformInterceptor } from '../core/interceptors/response.interceptor';
import { AmpController } from './amp.controller';
import { AmpService } from './amp.service';
import { EVALUATION_ENGINE } from './evaluation/contracts/evaluation-engine.contract';
import { EvaluationParserService } from './evaluation/evaluation-parser.service';
import { EvaluationPublicService } from './evaluation/evaluation-public.service';
import { EvaluationQueueService } from './evaluation/evaluation-queue.service';
import { EvaluationStreamService } from './evaluation/evaluation-stream.service';

const REPORT = { metadata: { url: 'x' }, snapshot: {}, telemetry: {}, scoring: {} };

describe('SSE evaluation endpoints', () => {
  let app: INestApplication;
  let base: string;
  let release: Array<() => void>;
  const evaluate = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AmpController],
      providers: [
        { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
        AmpService,
        EvaluationQueueService,
        EvaluationStreamService,
        EvaluationPublicService,
        {
          provide: EvaluationParserService,
          useValue: { parseEvaluation: (r: unknown) => ({ evaluationReport: r }) },
        },
        { provide: EVALUATION_ENGINE, useValue: { evaluate } },
        {
          provide: ConfigService,
          useValue: { get: (k: string) => (k === 'QUALWEB_MAX_CONCURRENCY' ? 1 : '') },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    base = await app.getUrl();
  });
  afterAll(() => app.close());

  beforeEach(() => {
    release = [];
    evaluate.mockReset();
    evaluate.mockImplementation(
      () => new Promise((resolve) => release.push(() => resolve(REPORT))),
    );
  });

  const readAll = async (res: Response) => (await res.text()).trim();

  it('POST html: sse headers, processing then completed, then closes', async () => {
    const p = fetch(`${base}/amp/eval/html`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ html: '<html></html>' }),
    });
    await new Promise((r) => setTimeout(r, 100));
    release[0]();
    const res = await p;
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('x-accel-buffering')).toBe('no');
    const body = await readAll(res);
    expect(body).toContain('event: processing');
    expect(body).toContain('event: completed');
    expect(body).not.toContain('timestamp'); // interceptor global não pode embrulhar eventos SSE
    expect(body.indexOf('processing')).toBeLessThan(body.indexOf('completed'));
  });

  it('POST file: rejects non-.html uploads', async () => {
    const form = new FormData();
    form.append('file', new Blob(['<html></html>'], { type: 'text/html' }), 'a.txt');
    const res = await fetch(`${base}/amp/eval/file`, { method: 'POST', body: form });
    expect(res.status).toBe(400);
  });

  it('POST file: accepts .html', async () => {
    const form = new FormData();
    form.append('file', new Blob(['<html><body>x</body></html>'], { type: 'text/html' }), 'a.html');
    const p = fetch(`${base}/amp/eval/file`, { method: 'POST', body: form });
    await new Promise((r) => setTimeout(r, 100));
    release[0]();
    const res = await p;
    expect(res.status).toBe(200);
    expect(await readAll(res)).toContain('event: completed');
  });

  it('queues the second request and emits queued with position', async () => {
    const send = () =>
      fetch(`${base}/amp/eval/html`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ html: '<html></html>' }),
      });
    const first = send();
    await new Promise((r) => setTimeout(r, 100));
    const second = send();
    await new Promise((r) => setTimeout(r, 100));
    release[0]();
    await new Promise((r) => setTimeout(r, 100));
    release[1]();
    const b1 = await readAll(await first);
    const b2 = await readAll(await second);
    expect(b1).not.toContain('event: queued');
    expect(b2).toContain('event: queued');
    expect(b2).toContain('"queuePosition":1');
    expect(b2).toContain('event: completed');
  });

  it('client disconnect while queued never calls the engine', async () => {
    const hold = fetch(`${base}/amp/eval/html`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ html: '<html></html>' }),
    });
    await new Promise((r) => setTimeout(r, 100));
    const ac = new AbortController();
    fetch(`${base}/amp/eval/html`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ html: '<html>2</html>' }),
      signal: ac.signal,
    }).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 100));
    ac.abort();
    await new Promise((r) => setTimeout(r, 100));
    release[0]();
    await readAll(await hold);
    await new Promise((r) => setTimeout(r, 100));
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it('client disconnect while processing aborts the signal', async () => {
    const ac = new AbortController();
    fetch(`${base}/amp/eval/html`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ html: '<html></html>' }),
      signal: ac.signal,
    }).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 100));
    const signal = evaluate.mock.calls[0][2].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    ac.abort();
    await new Promise((r) => setTimeout(r, 150));
    expect(signal.aborted).toBe(true);
    release[0]();
  });
});
