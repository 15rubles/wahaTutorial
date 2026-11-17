import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { dataPlugin } from './dataPlugin.js';

const src = (pkg: string) =>
  fileURLToPath(new URL(`../../packages/${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  plugins: [react(), dataPlugin()],
  resolve: {
    // Use workspace sources directly so dev and tests work without building packages first.
    alias: {
      '@battle-drill/data': src('data'),
      '@battle-drill/engine': src('engine'),
      '@battle-drill/tutorial': src('tutorial'),
    },
  },
  server: {
    port: 5173,
  },
});
