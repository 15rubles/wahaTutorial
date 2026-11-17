import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';

export default defineProject({
  resolve: {
    // Test against workspace sources so `npm test` works without a prior build.
    alias: {
      '@battle-drill/engine': fileURLToPath(new URL('../engine/src/index.ts', import.meta.url)),
    },
  },
  test: {
    name: 'tutorial',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
