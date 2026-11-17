import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { AmpService } from './amp.service';
import { EvaluationPublicService } from './evaluation/evaluation-public.service';
import { EvaluationStreamService } from './evaluation/evaluation-stream.service';
import { validateUrlRestriction } from '../common/util';
import { RestrictedNetworkException } from '../common/restricted-network.exception';
import { HtmlFileDto } from './dto/html-file.dto';

jest.mock('../common/util', () => ({ validateUrlRestriction: jest.fn() }));
const mockValidate = jest.mocked(validateUrlRestriction);

describe('AmpService', () => {
  let service: AmpService;
  const stream$ = of({ type: 'completed', data: {} });
  const streamEvaluation = jest.fn();
  const signal = new AbortController().signal;

  beforeEach(async () => {
    jest.resetAllMocks();
    streamEvaluation.mockReturnValue(stream$);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AmpService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('127.0.0.1,10.0.0.0/8') },
        },
        { provide: EvaluationPublicService, useValue: {} },
        { provide: EvaluationStreamService, useValue: { streamEvaluation } },
      ],
    }).compile();
    service = module.get(AmpService);
  });

  describe('validateUrl', () => {
    it('checks the URL against the configured blacklist', async () => {
      mockValidate.mockResolvedValue(undefined);
      await service.validateUrl('https://example.com');
      expect(mockValidate).toHaveBeenCalledWith('https://example.com', ['127.0.0.1', '10.0.0.0/8']);
    });

    it('propagates restricted network errors', async () => {
      mockValidate.mockRejectedValue(new RestrictedNetworkException());
      await expect(service.validateUrl('http://127.0.0.1')).rejects.toThrow(
        RestrictedNetworkException,
      );
    });
  });

  describe('streams', () => {
    it('streamUrlEvaluation submits a url evaluation', () => {
      const ctx = { clientIp: '1.1.1.1' };
      expect(service.streamUrlEvaluation('https://a.pt', signal, ctx)).toBe(stream$);
      expect(streamEvaluation).toHaveBeenCalledWith(
        { payload: 'https://a.pt', type: 'url' },
        signal,
        ctx,
      );
    });

    it('streamHtmlEvaluation submits an html evaluation', () => {
      expect(service.streamHtmlEvaluation('<p>x</p>', signal)).toBe(stream$);
      expect(streamEvaluation).toHaveBeenCalledWith(
        { payload: '<p>x</p>', type: 'html' },
        signal,
        undefined,
      );
    });

    it('streamHtmlFileEvaluation decodes the buffer and strips the UTF-8 BOM', () => {
      const file = { buffer: Buffer.from('﻿<html>é</html>', 'utf-8') } as HtmlFileDto;
      service.streamHtmlFileEvaluation(file, signal);
      expect(streamEvaluation).toHaveBeenCalledWith(
        { payload: '<html>é</html>', type: 'html' },
        signal,
        undefined,
      );
    });
  });
});
