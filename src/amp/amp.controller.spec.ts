import { Test, TestingModule } from '@nestjs/testing';
import { AmpController } from './amp.controller';
import { AmpService } from './amp.service';
import { UrlRequestDto } from './dto/url-request.dto';
jest.mock('@qualweb/core', () => {
  return {
    QualWeb: jest.fn().mockImplementation(() => ({
      evaluate: jest.fn().mockResolvedValue({}),
    })),
  };
});
jest.mock('../util/qualweb', () => ({
  qualweb: {
    evaluate: jest.fn(),
  },
}));
describe('AmpController', () => {
  let controller: AmpController;
  let service: AmpService;
  const mockAmpService = {
    evaluateUrl: jest.fn(),
    evaluateHtml: jest.fn(),
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AmpController],
      providers: [
        {
          provide: AmpService,
          useValue: mockAmpService,
        },
      ],
    }).compile();

    controller = module.get<AmpController>(AmpController);
    service = module.get<AmpService>(AmpService);

    jest.clearAllMocks();
    delete process.env.REFERER;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('evaluateUrl', () => {
    const mockParams: UrlRequestDto = { url: 'https://example.com' };

    it('should return 403 if REFERER env is set and request header does not match', async () => {
      process.env.REFERER = 'https://trusted.com';
      const mockReq = { headers: { referer: 'https://attacker.com' } };

      const result = await controller.evaluateUrl(mockReq, mockParams);

      expect(result).toEqual({ status: 403, message: 'Forbidden' });
      expect(service.evaluateUrl).not.toHaveBeenCalled();
    });

    it('should call service.evaluateUrl if REFERER env matches', async () => {
      process.env.REFERER = 'https://trusted.com';
      const mockReq = { headers: { referer: 'https://trusted.com/dashboard' } };
      mockAmpService.evaluateUrl.mockResolvedValue({ success: true });

      const result = await controller.evaluateUrl(mockReq, mockParams);

      expect(service.evaluateUrl).toHaveBeenCalledWith(mockParams.url);
      expect(result).toEqual({ success: true });
    });

    it('should call service.evaluateUrl directly if REFERER env is not configured', async () => {
      const mockReq = { headers: {} };
      mockAmpService.evaluateUrl.mockResolvedValue({ success: true });

      const result = await controller.evaluateUrl(mockReq, mockParams);

      expect(service.evaluateUrl).toHaveBeenCalledWith(mockParams.url);
      expect(result).toEqual({ success: true });
    });
  });

  describe('evaluateHtml', () => {
    const mockReqBody = { body: { html: '<h1>Test</h1>' }, headers: {} };

    it('should return 403 if REFERER env is set and request header does not match', async () => {
      process.env.REFERER = 'https://trusted.com';
      const mockReq = {
        body: { html: '<h1>Test</h1>' },
        headers: { referer: 'https://attacker.com' },
      };

      const result = await controller.evaluateHtml(mockReq);

      expect(result).toEqual({ status: 403, message: 'Forbidden' });
      expect(service.evaluateHtml).not.toHaveBeenCalled();
    });

    it('should call service.evaluateHtml if REFERER env matches', async () => {
      process.env.REFERER = 'https://trusted.com';
      const mockReq = {
        body: { html: '<h1>Test</h1>' },
        headers: { referer: 'https://trusted.com/dashboard' },
      };
      mockAmpService.evaluateHtml.mockResolvedValue({ score: 100 });

      const result = await controller.evaluateHtml(mockReq);

      expect(service.evaluateHtml).toHaveBeenCalledWith('<h1>Test</h1>');
      expect(result).toEqual({ score: 100 });
    });

    it('should call service.evaluateHtml directly if REFERER env is not configured', async () => {
      const mockReq = { body: { html: '<h1>Test</h1>' }, headers: {} };
      mockAmpService.evaluateHtml.mockResolvedValue({ score: 100 });

      const result = await controller.evaluateHtml(mockReq);

      expect(service.evaluateHtml).toHaveBeenCalledWith('<h1>Test</h1>');
      expect(result).toEqual({ score: 100 });
    });
  });
});
