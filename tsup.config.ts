import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  minify: false,
  bundle: true,
  splitting: false,
  external: ['better-sqlite3'],
  shims: true,
  onSuccess: 'chmod +x dist/server.js',
});