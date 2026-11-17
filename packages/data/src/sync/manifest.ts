import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface ManifestEntry {
  readonly key: string;
  readonly url: string;
  readonly etag?: string | undefined;
  readonly lastModified?: string | undefined;
  /** ISO time of the last request that returned 200 or 304. */
  readonly checkedAt: string;
  /** ISO time the stored bytes were downloaded. */
  readonly fetchedAt: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface Manifest {
  readonly version: 1;
  /** ISO time of the last sync that finished without failures. */
  readonly lastSuccessfulSyncAt?: string | undefined;
  /** Value of Last_update.csv at the last successful sync. */
  readonly sourceLastUpdate?: string | undefined;
  readonly files: Readonly<Record<string, ManifestEntry>>;
}

export const MANIFEST_FILE = '_manifest.json';

export function emptyManifest(): Manifest {
  return { version: 1, files: {} };
}

export async function loadManifest(rawDir: string): Promise<Manifest> {
  try {
    const text = await readFile(join(rawDir, MANIFEST_FILE), 'utf8');
    const parsed = JSON.parse(text) as Manifest;
    return parsed.version === 1 ? parsed : emptyManifest();
  } catch {
    return emptyManifest();
  }
}

export async function saveManifest(rawDir: string, manifest: Manifest): Promise<void> {
  const file = join(rawDir, MANIFEST_FILE);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}
