import {
  Equals,
  IsDefined,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  Validate,
  ValidatorConstraint,
} from 'class-validator';
import type { ValidatorConstraintInterface } from 'class-validator';

export const MAX_HTML_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@ValidatorConstraint({ name: 'isTextBuffer', async: false })
class IsHtmlTextBuffer implements ValidatorConstraintInterface {
  validate(buffer: unknown): boolean {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) return false;
    // Ficheiros binários contêm bytes nulos
    if (buffer.includes(0)) return false;
    const content = buffer.toString('utf-8').replace(/^\uFEFF/, '');
    return /<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]|<\/?[a-z][\s\S]*>/i.test(content);
  }
  defaultMessage(): string {
    return 'File is empty, not a text file, or does not contain valid HTML';
  }
}

export class HtmlFileDto {
  @IsString()
  @Matches(/\.html$/i, { message: 'File must be an HTML document (.html)' })
  originalname!: string;

  @Equals('text/html', { message: 'File mimetype must be text/html' })
  mimetype!: string;

  @IsInt()
  @Min(1, { message: 'File is empty' })
  @Max(MAX_HTML_FILE_SIZE, { message: 'File exceeds the maximum allowed size of 10MB' })
  size!: number;

  @IsDefined({ message: 'File buffer is required' })
  @Validate(IsHtmlTextBuffer)
  buffer!: Buffer;
}
