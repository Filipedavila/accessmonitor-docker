export interface SseEvent {
  event: string;
  data: unknown;
  at: number;
}

/** Minimal SSE client using fetch that records events as they arrive. */
export class SseClient {
  readonly events: SseEvent[] = [];
  status = 0;
  headers!: Headers;
  readonly done: Promise<void>;
  private readonly controller = new AbortController();

  constructor(url: string, init: RequestInit = {}) {
    this.done = this.run(url, init);
  }

  get names(): string[] {
    return this.events.map((e) => e.event);
  }

  of(name: string): SseEvent[] {
    return this.events.filter((e) => e.event === name);
  }

  /** Closes the connection from the client side. */
  abort(): void {
    this.controller.abort();
  }

  async waitFor(name: string, timeoutMs = 5000, count = 1): Promise<SseEvent> {
    const start = Date.now();
    while (this.of(name).length < count) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(
          `Timeout à espera de "${name}" (recebidos: ${this.names.join(',') || 'nenhum'})`,
        );
      }
      await new Promise((r) => setTimeout(r, 10));
    }
    return this.of(name)[count - 1];
  }

  private async run(url: string, init: RequestInit): Promise<void> {
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          Accept: 'text/event-stream',
          Referer: 'http://localhost',
          ...(init.headers ?? {}),
        },
        signal: this.controller.signal,
      });
      this.status = res.status;
      this.headers = res.headers;
      if (!res.body) return;
      const decoder = new TextDecoder();
      let buffer = '';
      for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
        buffer += decoder.decode(chunk, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? '';
        for (const block of blocks) this.parse(block);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') throw error;
    }
  }

  private parse(block: string): void {
    let event = 'message';
    let data = '';
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data || event === 'ping') return;
    let parsed: unknown = data;
    try {
      parsed = JSON.parse(data);
    } catch {
      /* Keep the string. */
    }
    this.events.push({ event, data: parsed, at: Date.now() });
  }
}

export const htmlBody = (id: string): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    html: `<html><head><title>${id}</title></head><body>${id}</body></html>`,
  }),
});

export async function waitUntil(
  cond: () => boolean,
  timeoutMs = 5000,
  label = 'condição',
): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timeout à espera de: ${label}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}
