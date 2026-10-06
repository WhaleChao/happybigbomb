/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { normalizeBase } from './config/base';

/**
 * 建置時加入 Content-Security-Policy：只允許載入自己網域的檔案，
 * 確保產物不會連到任何外部服務（開發模式不加，以免擋到 HMR）。
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "font-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'happybigbomb-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: normalizeBase(process.env.VITE_BASE ?? env.VITE_BASE),
    plugins: [react(), cspPlugin()],
    build: {
      outDir: 'dist',
      assetsInlineLimit: 0,
      sourcemap: false,
      target: 'es2022',
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}', 'config/**/*.test.ts'],
      restoreMocks: true,
    },
  };
});
