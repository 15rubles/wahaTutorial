import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const src = (pkg: string) =>
  fileURLToPath(new URL(`../../packages/${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Use workspace sources directly so dev and tests work without building packages first.
    alias: {
      '@battle-drill/engine': src('engine'),
      '@battle-drill/tutorial': src('tutorial'),
    },
  },
  server: {
    port: 5173,
  },
});
