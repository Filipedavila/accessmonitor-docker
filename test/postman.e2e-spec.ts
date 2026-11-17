import * as path from 'node:path';
import newman from 'newman';
import { createTestApp, TestApp } from './helpers/test-app';

jest.setTimeout(120_000);

const POSTMAN_DIR = path.resolve(__dirname, '../postman');

/**
 * Runs the Postman E2E collection (newman) against a real Nest app in memory.
 * QualWeb evaluation uses a fake, so the test runs without Chromium. URL/SSRF
 * validation, guards, DTOs, Multer, and SSE use real implementations.
 */
describe('Postman collection (newman) — SSE endpoints', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp(3);
    ctx.fake.reset('auto');
  });
  afterAll(() => ctx.app.close());

  it('accessmonitor-sse-e2e collection passes every request and assertion', async () => {
    const file = 'accessmonitor-sse-e2e.postman_collection.json';
    const summary = await new Promise<newman.NewmanRunSummary>((resolve, reject) => {
      newman.run(
        {
          collection: path.join(POSTMAN_DIR, file),
          environment: path.join(POSTMAN_DIR, 'local.postman_environment.json'),
          envVar: [{ key: 'baseUrl', value: ctx.baseUrl }],
          workingDir: POSTMAN_DIR,
          insecureFileRead: true,
          timeoutRequest: 30_000,
          reporters: [],
        },
        (err, result) => (err ? reject(err) : resolve(result)),
      );
    });

    const failures = summary.run.failures.map(
      (f) => `${f.source?.name ?? '?'} :: ${f.error.test ?? f.error.name} — ${f.error.message}`,
    );
    expect(failures).toEqual([]);
    expect(summary.run.stats.requests.total).toBeGreaterThanOrEqual(10);
    expect(summary.run.stats.assertions.total).toBeGreaterThan(0);
  });
});
