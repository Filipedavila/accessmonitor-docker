import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RefererGuard } from './referer.guard';

const ctx = (referer?: string) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers: { referer } }) }),
  }) as unknown as ExecutionContext;

describe('RefererGuard', () => {
  const guard = new RefererGuard();
  const original = process.env.REFERER;
  afterEach(() => {
    if (original === undefined) delete process.env.REFERER;
    else process.env.REFERER = original;
  });

  it('allows everything when REFERER is not configured', () => {
    delete process.env.REFERER;
    expect(guard.canActivate(ctx())).toBe(true);
  });

  it('allows a matching referer prefix', () => {
    process.env.REFERER = 'https://trusted.com';
    expect(guard.canActivate(ctx('https://trusted.com/dashboard'))).toBe(true);
  });

  it('rejects a different referer', () => {
    process.env.REFERER = 'https://trusted.com';
    expect(() => guard.canActivate(ctx('https://attacker.com'))).toThrow(ForbiddenException);
  });

  it('rejects a missing referer', () => {
    process.env.REFERER = 'https://trusted.com';
    expect(() => guard.canActivate(ctx())).toThrow(ForbiddenException);
  });
});
