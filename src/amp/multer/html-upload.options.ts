import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import type { Options } from 'multer';
import { extname } from 'node:path';
import { MAX_HTML_FILE_SIZE } from '../dto/html-file.dto';

/** Multer: memória, 1 ficheiro, 10MB e apenas `.html` (extensão + mimetype text/html). */
export const htmlUploadOptions: Options = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_HTML_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, callback) => {
    const isHtml =
      extname(file.originalname).toLowerCase() === '.html' && file.mimetype === 'text/html';
    if (!isHtml) {
      return callback(new BadRequestException('Only .html files (text/html) are accepted'));
    }
    callback(null, true);
  },
};
