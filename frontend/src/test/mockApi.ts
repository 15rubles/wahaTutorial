import { vi } from 'vitest';

export type MockReply = { status?: number; body?: unknown } | ((req: { url: string; method: string; body: unknown }) => { status?: number; body?: unknown });

/**
 * Routes fetch calls to handlers keyed by "METHOD /path" (query string ignored unless the key has one).
 * Unknown routes answer 404 in the shared error shape. Returns the spy so tests can inspect calls.
 */
export function mockApi(handlers: Record<string, MockReply>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    const bare = path.split('?')[0] ?? path;
    const handler = handlers[`${method} ${path}`] ?? handlers[`${method} ${bare}`];
    let body: unknown = undefined;
    if (typeof init?.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    if (!handler) {
      if (bare === '/api/health') return json(200, { status: 'UP', database: 'UP', checkedAt: '2026-01-01T00:00:00Z' });
      if (bare === '/api/auth/csrf') return json(200, { headerName: 'X-XSRF-TOKEN', token: 'test-token' });
      return json(404, { code: 'NOT_FOUND', message: `No mock for ${method} ${path}`, fieldErrors: [] });
    }
    const reply = typeof handler === 'function' ? handler({ url: path, method, body }) : handler;
    return json(reply.status ?? 200, reply.body);
  });
}

function json(status: number, body: unknown): Response {
  if (status === 204) return new Response(null, { status });
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const anon = { status: 401, body: { code: 'UNAUTHENTICATED', message: 'Please sign in', fieldErrors: [] } };
export const userMe = { body: { id: 2, username: 'friend', email: 'f@example.test', role: 'USER' } };
export const adminMe = { body: { id: 1, username: 'boss', email: 'b@example.test', role: 'ADMIN' } };
