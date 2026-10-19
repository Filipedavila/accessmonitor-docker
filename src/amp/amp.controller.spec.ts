import { Test, TestingModule } from '@nestjs/testing';
import { AmpController } from './amp.controller';
import { AmpService } from './amp.service';
import { UrlRequestDto } from './dto/url-request.dto';
import { ForbiddenException } from '@nestjs/common/exceptions/forbidden.exception';
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

      await expect(
        controller.evaluateUrl('https://attacker.com', mockParams, '203.0.113.10'),
      ).rejects.toThrow(ForbiddenException);
      expect(service.evaluateUrl).not.toHaveBeenCalled();
    });

    it('should call service.evaluateUrl if REFERER env matches', async () => {
      process.env.REFERER = 'https://trusted.com';
      const mockUrlDto: UrlRequestDto = { url: 'https://example.com' };
      mockAmpService.evaluateUrl.mockResolvedValue({ success: true });

      const result = await controller.evaluateUrl(
        'https://trusted.com/dashboard',
        mockUrlDto,
        '203.0.113.10',
      );

      expect(service.evaluateUrl).toHaveBeenCalledWith(mockUrlDto.url, '203.0.113.10');
      expect(result).toEqual({ success: true });
    });

    it('should call service.evaluateUrl directly if REFERER env is not configured', async () => {
      const mockUrlDto: UrlRequestDto = { url: 'https://example.com' };

      mockAmpService.evaluateUrl.mockResolvedValue({ success: true });

      const result = await controller.evaluateUrl(undefined, mockUrlDto, '203.0.113.10');

      expect(service.evaluateUrl).toHaveBeenCalledWith(mockUrlDto.url, '203.0.113.10');
      expect(result).toEqual({ success: true });
    });
  });

  describe('evaluateHtml', () => {
    it('should throw ForbiddenException if REFERER env is set and request header does not match', async () => {
      process.env.REFERER = 'https://trusted.com';

      await expect(
        controller.evaluateHtml('https://attacker.com', '<h1>Test</h1>', '203.0.113.10'),
      ).rejects.toThrow(ForbiddenException);
      expect(service.evaluateHtml).not.toHaveBeenCalled();
    });

    it('should call service.evaluateHtml if REFERER env matches', async () => {
      process.env.REFERER = 'https://trusted.com';
      mockAmpService.evaluateHtml.mockResolvedValue({ score: 100 });

      const result = await controller.evaluateHtml(
        'https://trusted.com/dashboard',
        '<h1>Test</h1>',
        '203.0.113.10',
      );

      expect(service.evaluateHtml).toHaveBeenCalledWith('<h1>Test</h1>', '203.0.113.10');
      expect(result).toEqual({ score: 100 });
    });

    it('should call service.evaluateHtml directly if REFERER env is not configured', async () => {
      mockAmpService.evaluateHtml.mockResolvedValue({ score: 100 });

      const result = await controller.evaluateHtml(undefined, '<h1>Test</h1>', '203.0.113.10');

      expect(service.evaluateHtml).toHaveBeenCalledWith('<h1>Test</h1>', '203.0.113.10');
      expect(result).toEqual({ score: 100 });
    });
  });
});
