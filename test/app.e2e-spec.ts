import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigModule } from '@nestjs/config';
import { AmpModule } from '../src/amp/amp.module';

jest.setTimeout(1000 * 60 * 3);

describe('Amp E2E - End to End test  of Evaluations', () => {
  let app: INestApplication;
  let http: AxiosInstance;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              NODE_ENV: 'test',
              REFERER: 'https://trusted-app.com',
              IP_BLACKLIST_RANGES: '127.0.0.1,10.0.0.0/8',
            }),
          ],
        }),
        AmpModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );

    await app.listen(0);
    const port = app.getHttpServer().address().port;

    http = axios.create({
      baseURL: `http://localhost:${port}`,
      validateStatus: () => true,
    });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('GET /amp/eval/:url -> Integração Completa', () => {
    it('Should evaluate a URL and return the QualWeb report', async () => {
      const targetUrl = 'https://www.acessibilidade.gov.pt/';

      const base64Url = Buffer.from(targetUrl).toString('base64');

      const response = await http.get(`/amp/eval/${base64Url}`, {
        headers: { referer: 'https://trusted-app.com' },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('pagecode');
      expect(response.data.data.rawUrl).toContain('acessibilidade.gov.pt');
    });
  });

  describe('POST /amp/eval/html -> Integração Completa', () => {
    it('Should evaluate an HTML string  through QualWeb and generate report', async () => {
      const rawHtml = `
        <!DOCTYPE html>
        <html lang="pt">
          <head><title>Page of Test E2E</title></head>
          <body>
            <h1>Main Title</h1>
            <main><p>Validating accessibility of the raw synchronous engine.</p></main>
          </body>
        </html>
      `;

      const payload = {
        html: rawHtml,
      };

      const response = await http.post('/amp/eval/html', payload, {
        headers: { referer: 'https://trusted-app.com' },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('pagecode');
      expect(response.data.data).toHaveProperty('title');
      expect(response.data.data).toHaveProperty('score');
    });
  });
});
