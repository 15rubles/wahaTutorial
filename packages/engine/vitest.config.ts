import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';

export default defineProject({
  resolve: {
    alias: {
      '@battle-drill/data': fileURLToPath(new URL('../data/src/index.ts', import.meta.url)),
    },
  },
  test: {
    name: 'engine',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
