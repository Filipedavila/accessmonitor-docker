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
    process.env.NODE_ENV = 'test';
    process.env.REFERER = 'http://localhost';
    process.env.IP_BLACKLIST_RANGES = '127.0.0.1,10.0.0.0/8';
    process.env.ALLOWED_ORIGINS = 'http://localhost';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              NODE_ENV: 'test',
              REFERER: 'http://localhost',
              IP_BLACKLIST_RANGES: '127.0.0.1,10.0.0.0/8',
              ALLOWED_ORIGINS: 'http://localhost',
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

  describe('GET /amp/eval/:url', () => {
    it('Should evaluate a URL and return the QualWeb report', async () => {
      const targetUrl = 'https://www.acessibilidade.gov.pt/';

      const base64Url = Buffer.from(targetUrl).toString('base64');

      const response = await http.get(`/amp/eval/${base64Url}`, {
        headers: { referer: 'http://localhost' },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('pagecode');
      expect(response.data.data.rawUrl).toContain('acessibilidade.gov.pt');
    });
    it('Should return 403 if REFERER env is set and request header does not match', async () => {
 
      const targetUrl = 'https://www.acessibilidade.gov.pt/';
      const base64Url = Buffer.from(targetUrl).toString('base64');

      const response = await http.get(`/amp/eval/${base64Url}`, {
        headers: { referer: 'https://attacker.com' },
      });

      expect(response.status).toBe(403);
    });
    it('Should return 400 if the URL is not valid', async () => {
      const invalidBase64 = 'not-a-valid-base64';

      const response = await http.get(`/amp/eval/${invalidBase64}`, {
        headers: { referer: 'http://localhost' },
      });

      expect(response.status).toBe(400);
    });
    it('should return 400 if url is in blacklist', async () => {
      const blacklistedUrl = 'http://localhost/admin';
      const base64Url = Buffer.from(blacklistedUrl).toString('base64');

      const response = await http.get(`/amp/eval/${base64Url}`, {
        headers: { referer: 'http://localhost' },
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /amp/eval/html', () => {
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
        headers: { referer: 'http://localhost' },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('pagecode');
      expect(response.data.data).toHaveProperty('title');
      expect(response.data.data).toHaveProperty('score');
    });
    it('Should return 403 if REFERER env is set and request header does not match', async () => {
      const payload = {
        html: '<html><body>Test</body></html>',
      };

      const response = await http.post('/amp/eval/html', payload, {
        headers: { referer: 'https://attacker.com' },
      });

      expect(response.status).toBe(403);
    });
  });
  
});
