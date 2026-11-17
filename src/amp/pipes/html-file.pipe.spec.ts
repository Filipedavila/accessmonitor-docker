import { BadRequestException } from '@nestjs/common';
import { HtmlFilePipe } from './html-file.pipe';

describe('HtmlFilePipe', () => {
  const pipe = new HtmlFilePipe();
  const valid = (over: Record<string, unknown> = {}) => {
    const buffer = Buffer.from('<!DOCTYPE html><html><body>x</body></html>');
    return { originalname: 'a.html', mimetype: 'text/html', size: buffer.length, buffer, ...over };
  };

  it('accepts a valid html file', async () => {
    const dto = await pipe.transform(valid());
    expect(dto.originalname).toBe('a.html');
  });

  it('rejects a missing file', async () => {
    await expect(pipe.transform(undefined)).rejects.toThrow(BadRequestException);
  });

  it.each([
    ['wrong extension', { originalname: 'a.txt' }],
    ['wrong mimetype', { mimetype: 'text/plain' }],
    ['empty file', { size: 0, buffer: Buffer.alloc(0) }],
    ['binary content', { buffer: Buffer.from([0, 1, 2, 3]), size: 4 }],
    ['not html text', { buffer: Buffer.from('just text'), size: 9 }],
  ])('rejects %s', async (_n, over) => {
    await expect(pipe.transform(valid(over))).rejects.toThrow(BadRequestException);
  });
});
