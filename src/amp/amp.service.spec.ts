import { Test, TestingModule } from '@nestjs/testing';
import { AmpService } from './amp.service';
import { ConfigService } from '@nestjs/config/dist/config.service';
import {
  executeUrlEvaluation,
  executeHtmlEvaluation,
} from 'src/util/middleware';
import dns from 'node:dns';
jest.mock('src/util/middleware', () => ({
  executeUrlEvaluation: jest.fn(),
  executeHtmlEvaluation: jest.fn(),
}));

jest.mock('node:dns', () => ({
  lookup: jest.fn(),
}));

describe('AmpService', () => {
  let service: AmpService;
  let configService: ConfigService;

  // Mocks dos utilities para asserções
  const mockExecuteUrl = executeUrlEvaluation as jest.Mock;
  const mockExecuteHtml = executeHtmlEvaluation as jest.Mock;
  const mockDnsLookup = dns.lookup as unknown as jest.Mock;

  // Mock do ConfigService do NestJS
  const mockConfigService = {
    get: jest.fn().mockReturnValue('127.0.0.1,10.0.0.0/8'), // Instancia a blacklist
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AmpService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AmpService>(AmpService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluateUrl', () => {
    const rawUrl = 'https://example.com/path';

    it('should return Forbidden (403) if resolved IP is in blacklist', async () => {
      // Simula o DNS a resolver para o IP local (que está na blacklist)
      mockDnsLookup.mockImplementation((hostname, callback) => {
        callback(null, '127.0.0.1');
      });

      const result = await service.evaluateUrl(rawUrl);

      expect(result).toEqual({ status: 403, message: 'Forbidden' });
      expect(mockExecuteUrl).not.toHaveBeenCalled();
    });

    it('should call executeUrlEvaluation if resolved IP is safe', async () => {
      // Simula o DNS a resolver para um IP público seguro
      mockDnsLookup.mockImplementation((hostname, callback) => {
        callback(null, '8.8.8.8');
      });
      mockExecuteUrl.mockResolvedValue({ report: 'valid_report' });

      const result = await service.evaluateUrl(rawUrl);

      // Garante que a URL foi feito o bypass do b64 e o split do protocolo no fixUrl
      expect(mockDnsLookup).toHaveBeenCalledWith(
        'example.com',
        expect.any(Function),
      );
      expect(mockExecuteUrl).toHaveBeenCalledWith(rawUrl);
      expect(result).toEqual({ report: 'valid_report' });
    });

    it('should handle  URL parameters correctly', async () => {
      const urlWithParams = 'https://target.com/eval?q=1&v=2';

      mockDnsLookup.mockImplementation((hostname, callback) => {
        callback(null, '8.8.8.8');
      });
      mockExecuteUrl.mockResolvedValue({ success: true });

      await service.evaluateUrl(urlWithParams);

      expect(mockDnsLookup).toHaveBeenCalledWith(
        'target.com',
        expect.any(Function),
      );
      expect(mockExecuteUrl).toHaveBeenCalledWith(urlWithParams);
    });
  });

  describe('evaluateHtml', () => {
    it('should proxy the call directly to executeHtmlEvaluation', async () => {
      const mockHtml = '<html><body>Test</body></html>';
      mockExecuteHtml.mockResolvedValue({ score: 95 });

      const result = await service.evaluateHtml(mockHtml);

      expect(mockExecuteHtml).toHaveBeenCalledWith(mockHtml);
      expect(result).toEqual({ score: 95 });
    });
  });
});
