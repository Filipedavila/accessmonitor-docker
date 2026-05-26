import { createHash } from 'node:crypto';

export function generateMd5Hash(content: string): string {
  return createHash('md5').update(content).digest('hex');
}
