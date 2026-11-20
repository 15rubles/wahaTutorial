import { ApiError, apiGet } from './client';
import { mockFetchJson } from '../test/renderApp';

describe('apiGet', () => {
  it('returns the parsed body on success', async () => {
    mockFetchJson(200, { hello: 'world' });
    await expect(apiGet<{ hello: string }>('/api/x')).resolves.toEqual({ hello: 'world' });
  });

  it('throws an ApiError carrying the shared error shape', async () => {
    mockFetchJson(404, { code: 'NOT_FOUND', message: 'Not found', fieldErrors: [] });
    const err = await apiGet('/api/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
    expect((err as ApiError).body?.code).toBe('NOT_FOUND');
  });

  it('throws an ApiError without body when the response is not the error shape', async () => {
    mockFetchJson(500, 'oops');
    const err = (await apiGet('/api/x').catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(500);
    expect(err.body).toBeUndefined();
  });
});
