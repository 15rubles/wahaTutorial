/** A polite HTTP client: one request at a time, minimum spacing, retries, conditional GET. */

export interface HttpResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array;
}

/** Injected so tests never touch the network. */
export type Fetcher = (url: string, headers: Record<string, string>) => Promise<HttpResponse>;

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export const nodeFetcher: Fetcher = async (url, headers) => {
  const res = await fetch(url, { headers, redirect: 'follow' });
  const out: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  const body = res.status === 304 ? new Uint8Array() : new Uint8Array(await res.arrayBuffer());
  return { status: res.status, headers: out, body };
};

export interface PoliteClientOptions {
  readonly userAgent: string;
  readonly minIntervalMs: number;
  readonly maxRetries: number;
  readonly fetcher: Fetcher;
  readonly clock: Clock;
}

export interface Conditional {
  readonly etag?: string | undefined;
  readonly lastModified?: string | undefined;
}

export class PoliteClient {
  private lastRequestAt = Number.NEGATIVE_INFINITY;
  private count = 0;

  constructor(private readonly options: PoliteClientOptions) {}

  /** Number of HTTP requests actually sent (retries included). */
  get requestCount(): number {
    return this.count;
  }

  async get(url: string, conditional: Conditional = {}): Promise<HttpResponse> {
    const headers: Record<string, string> = { 'user-agent': this.options.userAgent };
    if (conditional.etag) headers['if-none-match'] = conditional.etag;
    if (conditional.lastModified) headers['if-modified-since'] = conditional.lastModified;

    let attempt = 0;
    for (;;) {
      await this.waitTurn();
      this.count += 1;
      try {
        const res = await this.options.fetcher(url, headers);
        if (res.status >= 500 && attempt < this.options.maxRetries) {
          attempt += 1;
          await this.options.clock.sleep(backoffMs(attempt));
          continue;
        }
        return res;
      } catch (error) {
        if (attempt >= this.options.maxRetries) throw error;
        attempt += 1;
        await this.options.clock.sleep(backoffMs(attempt));
      }
    }
  }

  private async waitTurn(): Promise<void> {
    const { clock, minIntervalMs } = this.options;
    const wait = this.lastRequestAt + minIntervalMs - clock.now();
    if (wait > 0) await clock.sleep(wait);
    this.lastRequestAt = clock.now();
  }
}

function backoffMs(attempt: number): number {
  return 2000 * 2 ** (attempt - 1);
}
