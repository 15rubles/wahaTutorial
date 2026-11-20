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
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).code === 'string' &&
    typeof (value as Record<string, unknown>).message === 'string'
  );
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
    ...(signal ? { signal } : {}),
  });
  const body: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new ApiError(res.status, isApiErrorBody(body) ? body : undefined);
  }
  return body as T;
}
