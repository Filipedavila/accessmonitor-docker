import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class RefererGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const allowed = process.env.REFERER;
    if (!allowed) return true;
    const referer = context.switchToHttp().getRequest<Request>().headers.referer;
    if (!referer?.startsWith(allowed)) throw new ForbiddenException('Forbidden');
    return true;
  }
}
