import { Test, TestingModule } from '@nestjs/testing';
import { AmpService } from './amp.service';
import { ConfigService } from '@nestjs/config';
import {
  executeUrlEvaluation,
  executeHtmlEvaluation,
} from 'src/util/middleware';
import { validateUrlRestriction } from '../common/util'; 
import { RestrictedNetworkException } from '../common/restricted-network.exception';

jest.mock('src/util/middleware', () => ({
  executeUrlEvaluation: jest.fn(),
  executeHtmlEvaluation: jest.fn(),
}));

jest.mock('../common/util', () => ({
  validateUrlRestriction: jest.fn(),
}));

const mockExecuteUrl = jest.mocked(executeUrlEvaluation);
const mockExecuteHtml = jest.mocked(executeHtmlEvaluation);
const mockValidateUrlRestriction = jest.mocked(validateUrlRestriction);

describe('AmpService', () => {
  let service: AmpService;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('127.0.0.1,10.0.0.0/8'),
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
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluateUrl', () => {
    const rawUrl = 'https://example.com/path';
    const expectedBlacklist = ['127.0.0.1', '10.0.0.0/8'];

    it('should propagate the exception if validateUrlRestriction detects a restricted network', async () => {

      mockValidateUrlRestriction.mockRejectedValue(new RestrictedNetworkException());

      const promise = service.evaluateUrl(rawUrl);

      await expect(promise).rejects.toThrow(RestrictedNetworkException);
      
      expect(mockExecuteUrl).not.toHaveBeenCalled();
      expect(mockValidateUrlRestriction).toHaveBeenCalledWith(rawUrl, expectedBlacklist);
    });

    it('should return evaluation report if validateUrlRestriction allows the URL', async () => {
      mockValidateUrlRestriction.mockResolvedValue(undefined);

      mockExecuteUrl.mockResolvedValue({ report: 'valid_report' });

      const result = await service.evaluateUrl(rawUrl);

      expect(mockValidateUrlRestriction).toHaveBeenCalledWith(rawUrl, expectedBlacklist);
      expect(mockExecuteUrl).toHaveBeenCalledWith(rawUrl);
      expect(result).toEqual({ report: 'valid_report' });
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