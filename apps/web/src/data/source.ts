/** Where the browser loads normalized data from. */
export type DataSource = 'cache' | 'fixture';

export const DATA_BASE: Record<DataSource, string> = {
  cache: '/data',
  fixture: '/fixture-data',
};

const KEY = 'battle-drill.data-source';

export function initialDataSource(): DataSource {
  try {
    const param = new URLSearchParams(window.location.search).get('data');
    if (param === 'fixture' || param === 'cache') return param;
    const stored = window.localStorage.getItem(KEY);
    if (stored === 'fixture' || stored === 'cache') return stored;
  } catch {
    // Storage can be unavailable (private mode); fall through.
  }
  return 'cache';
}

export function rememberDataSource(source: DataSource): void {
  try {
    window.localStorage.setItem(KEY, source);
  } catch {
    // Not fatal.
  }
}

export class DataMissingError extends Error {
  constructor(readonly path: string) {
    super(`Data file not found: ${path}`);
  }
}

export async function fetchJson<T>(source: DataSource, path: string): Promise<T> {
  const res = await fetch(`${DATA_BASE[source]}/${path}`);
  if (res.status === 404) throw new DataMissingError(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}
