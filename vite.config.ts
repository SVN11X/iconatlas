/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

// CSP estricta solo en producción (el servidor de desarrollo inyecta scripts en línea).
const csp: Plugin = {
  name: 'iconatlas-csp',
  apply: 'build',
  transformIndexHtml(html) {
    const policy = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'";
    return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
  },
};

// GitHub Pages publica el sitio bajo /<repositorio>/. BASE_PATH permite
// cambiarlo (p. ej. "/" para un dominio propio o un repositorio USUARIO.github.io).
const base = process.env.BASE_PATH ?? '/iconatlas/';

export default defineConfig({
  base,
  plugins: [react(), csp],
  worker: { format: 'es' },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'], // Los scripts CLI se prueban con el ejecutor nativo de Node.
    exclude: ['e2e/**', 'node_modules/**'],
    testTimeout: 30000,
  },
});
