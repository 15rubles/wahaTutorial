/** The one JSON error shape the backend uses (DESIGN.md section 10). */
export type ApiFieldError = { field: string; message: string };
export type ApiErrorBody = { code: string; message: string; fieldErrors: ApiFieldError[] };

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | undefined;

  constructor(status: number, body: ApiErrorBody | undefined) {
    super(body?.message ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }

  get code(): string | undefined {
    return this.body?.code;
  }

  fieldError(field: string): string | undefined {
    return this.body?.fieldErrors?.find((f) => f.field === field)?.message;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).code === 'string' &&
    typeof (value as Record<string, unknown>).message === 'string'
  );
}

const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'X-XSRF-TOKEN';

export function readCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) return decodeURIComponent(trimmed.slice(prefix.length));
  }
  return undefined;
}

async function csrfToken(): Promise<string | undefined> {
  const existing = readCookie(CSRF_COOKIE);
  if (existing) return existing;
  const res = await fetch('/api/auth/csrf', { method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } });
  const body: unknown = await res.json().catch(() => undefined);
  const fromBody =
    typeof body === 'object' && body !== null && typeof (body as Record<string, unknown>).token === 'string'
      ? ((body as Record<string, unknown>).token as string)
      : undefined;
  return readCookie(CSRF_COOKIE) ?? fromBody;
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new ApiError(res.status, isApiErrorBody(body) ? body : undefined);
  }
  return body as T;
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
    ...(signal ? { signal } : {}),
  });
  return parse<T>(res);
}

type Method = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function apiSend<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const token = await csrfToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers[CSRF_HEADER] = token;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    ...(payload !== undefined ? { body: payload } : {}),
  });
  return parse<T>(res);
}

/** Downloads a binary/text response (for admin exports); throws ApiError like the JSON helpers. */
export async function apiGetBlob(path: string): Promise<Blob> {
  const res = await fetch(path, { method: 'GET', credentials: 'same-origin' });
  if (!res.ok) await parse(res);
  return res.blob();
}
