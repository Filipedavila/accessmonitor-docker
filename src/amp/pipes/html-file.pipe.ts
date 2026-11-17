import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { validate } from 'class-validator';
import { HtmlFileDto } from '../dto/html-file.dto';

interface RawUploadedFile {
  originalname?: unknown;
  mimetype?: unknown;
  size?: unknown;
  buffer?: unknown;
}

@Injectable()
export class HtmlFilePipe implements PipeTransform<
  RawUploadedFile | undefined,
  Promise<HtmlFileDto>
> {
  async transform(file?: RawUploadedFile): Promise<HtmlFileDto> {
    if (!file) {
      throw new BadRequestException('A .html file (text/html) is required in field "file"');
    }

    // Construção manual para não copiar/alterar o Buffer
    const dto = Object.assign(new HtmlFileDto(), {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      buffer: file.buffer,
    });

    const errors = await validate(dto, { forbidUnknownValues: true });
    if (errors.length > 0) {
      const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
      throw new BadRequestException(messages);
    }
    return dto;
  }
}
