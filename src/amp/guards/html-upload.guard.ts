import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import multer from 'multer';
import { htmlUploadOptions } from '../multer/html-upload.options';

const upload = multer(htmlUploadOptions).single('file');

/**
 * Executa o Multer (só `.html`, em memória) ANTES de a rota SSE abrir.
 *
 * Tem de ser um guard e não um interceptor: o `@Sse` do Nest regista `request.on('close')`
 * antes de os interceptors correrem e trata esse evento como "cliente desistiu". Em
 * multipart o `close` dispara quando o corpo é consumido, o que fecharia o stream logo
 * no início. Aqui o corpo é consumido e o `close` já ocorreu antes de o stream abrir.
 */
@Injectable()
export class HtmlUploadGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    await new Promise<void>((resolve, reject) =>
      upload(req, res, (err: unknown) => {
        if (!err) return resolve();
        if (err instanceof HttpException) return reject(err);
        const code = (err as { code?: string }).code;
        reject(
          code === 'LIMIT_FILE_SIZE'
            ? new PayloadTooLargeException('File exceeds the maximum allowed size of 10MB')
            : new BadRequestException((err as Error).message ?? 'Invalid upload'),
        );
      }),
    );

    if (!req.closed) {
      // Sem multipart o Multer não consome o corpo e o `close` nunca dispararia (pedido pendurado).
      req.resume();
      await new Promise<void>((resolve) => req.once('close', () => resolve()));
    }
    // Cliente saiu durante o upload: não abrir stream.
    return !req.socket?.destroyed;
  }
}
