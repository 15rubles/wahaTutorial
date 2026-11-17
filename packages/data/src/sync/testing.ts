import type { Clock, Fetcher, HttpResponse } from './http.js';

/** Virtual clock: sleep advances time instantly. */
export function fakeClock(
  start = Date.UTC(2026, 0, 1),
): Clock & { advance(ms: number): void; sleeps: number[] } {
  let t = start;
  const sleeps: number[] = [];
  return {
    sleeps,
    now: () => t,
    sleep: async (ms) => {
      sleeps.push(ms);
      t += ms;
    },
    advance: (ms) => {
      t += ms;
    },
  };
}

export interface FakeFile {
  body: string;
  etag: string;
}

/** In-memory server that honours If-None-Match and records every request with its time. */
export function fakeServer(clock: Clock, files: Record<string, FakeFile>) {
  const requests: { url: string; at: number; headers: Record<string, string> }[] = [];
  const failNext = new Map<string, number>();
  const fetcher: Fetcher = async (url, headers) => {
    requests.push({ url, at: clock.now(), headers });
    const failures = failNext.get(url) ?? 0;
    if (failures > 0) {
      failNext.set(url, failures - 1);
      throw new Error('socket hang up');
    }
    const path = new URL(url).pathname;
    const file = files[path];
    if (!file) return { status: 404, headers: {}, body: new Uint8Array() } satisfies HttpResponse;
    if (headers['if-none-match'] === file.etag)
      return { status: 304, headers: { etag: file.etag }, body: new Uint8Array() };
    return { status: 200, headers: { etag: file.etag }, body: new TextEncoder().encode(file.body) };
  };
  return { fetcher, requests, files, failNext };
}
