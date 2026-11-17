/**
 * Dev / preview server plugin that serves the local data cache to the browser.
 *   /data/*          -> BATTLE_DRILL_DATA_DIR (default data-cache/normalized), the user's own cache
 *   /fixture-data/*  -> fixtures/normalized, invented demo data
 * Nothing from the cache is bundled into the build output.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, normalize, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

function handler(mounts: Record<string, string>) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    for (const [prefix, dir] of Object.entries(mounts)) {
      if (!url.pathname.startsWith(prefix + '/')) continue;
      const rel = normalize(decodeURIComponent(url.pathname.slice(prefix.length + 1)));
      const file = join(dir, rel);
      if (
        !file.startsWith(dir + sep) ||
        !rel.endsWith('.json') ||
        !existsSync(file) ||
        !statSync(file).isFile()
      ) {
        res.statusCode = 404;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: 'not found', path: url.pathname }));
        return;
      }
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.setHeader('cache-control', 'no-cache');
      createReadStream(file).pipe(res);
      return;
    }
    next();
  };
}

export function dataPlugin(): Plugin {
  const dataDir = resolve(
    REPO_ROOT,
    process.env['BATTLE_DRILL_DATA_DIR'] ?? 'data-cache/normalized',
  );
  const mounts = { '/data': dataDir, '/fixture-data': resolve(REPO_ROOT, 'fixtures/normalized') };
  return {
    name: 'battle-drill-data',
    configureServer(server) {
      server.middlewares.use(handler(mounts));
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler(mounts));
    },
  };
}
