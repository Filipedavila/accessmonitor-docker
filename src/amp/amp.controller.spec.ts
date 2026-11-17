import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { AmpController } from './amp.controller';
import { AmpService } from './amp.service';
import { HtmlFileDto } from './dto/html-file.dto';
import { InvalidUrlException } from '../common/invalid-url.exception';

describe('AmpController', () => {
  let controller: AmpController;
  const stream$ = of({ type: 'completed', data: {} });
  const signal = new AbortController().signal;

  const mockAmpService = {
    validateUrl: jest.fn(),
    streamUrlEvaluation: jest.fn(),
    streamHtmlEvaluation: jest.fn(),
    streamHtmlFileEvaluation: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    mockAmpService.streamUrlEvaluation.mockReturnValue(stream$);
    mockAmpService.streamHtmlEvaluation.mockReturnValue(stream$);
    mockAmpService.streamHtmlFileEvaluation.mockReturnValue(stream$);
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AmpController],
      providers: [{ provide: AmpService, useValue: mockAmpService }],
    }).compile();
    controller = module.get(AmpController);
  });

  describe('streamEvaluation (GET /amp/eval/stream)', () => {
    it('validates the URL before opening the stream and passes signal + ip', async () => {
      mockAmpService.validateUrl.mockResolvedValue(undefined);

      const result = await controller.streamEvaluation(
        { url: 'https://example.com' },
        signal,
        '1.2.3.4',
      );

      expect(mockAmpService.validateUrl).toHaveBeenCalledWith('https://example.com');
      expect(mockAmpService.streamUrlEvaluation).toHaveBeenCalledWith(
        'https://example.com',
        signal,
        {
          clientIp: '1.2.3.4',
        },
      );
      expect(result).toBe(stream$);
    });

    it('propagates validation errors as HTTP errors and never starts the stream', async () => {
      mockAmpService.validateUrl.mockRejectedValue(new InvalidUrlException());

      await expect(controller.streamEvaluation({ url: 'nope' }, signal, 'ip')).rejects.toThrow(
        InvalidUrlException,
      );
      expect(mockAmpService.streamUrlEvaluation).not.toHaveBeenCalled();
    });
  });

  describe('streamHtmlEvaluation (POST /amp/eval/html)', () => {
    it('delegates html to the service', () => {
      const result = controller.streamHtmlEvaluation('<h1>x</h1>', signal, 'ip');
      expect(mockAmpService.streamHtmlEvaluation).toHaveBeenCalledWith('<h1>x</h1>', signal, {
        clientIp: 'ip',
      });
      expect(result).toBe(stream$);
    });

    it.each([undefined, '', 42, {}])('rejects invalid html (%p) with 400', (html) => {
      expect(() => controller.streamHtmlEvaluation(html as never, signal, 'ip')).toThrow(
        BadRequestException,
      );
      expect(mockAmpService.streamHtmlEvaluation).not.toHaveBeenCalled();
    });
  });

  describe('streamHtmlFileEvaluation (POST /amp/eval/file)', () => {
    it('delegates the uploaded file to the service', () => {
      const file = { buffer: Buffer.from('<html></html>') } as HtmlFileDto;
      const result = controller.streamHtmlFileEvaluation(file, signal, 'ip');
      expect(mockAmpService.streamHtmlFileEvaluation).toHaveBeenCalledWith(file, signal, {
        clientIp: 'ip',
      });
      expect(result).toBe(stream$);
    });
  });
});
