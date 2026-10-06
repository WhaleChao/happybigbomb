import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE = process.env.VITE_BASE && process.env.VITE_BASE !== './' ? process.env.VITE_BASE : '/happybigbomb/';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}${BASE}`,
    locale: 'zh-TW',
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-1440',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        // PW_CHANNEL=chrome 可改用本機 Google Chrome（內建 H.264 編碼器，能完整測 MP4 匯出）
        ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
        // 嵌入測試的宿主頁由 route 提供，Chromium 會把它視為公開網路而擋下對 localhost 的 iframe
        launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks'] },
      },
    },
    // 匯出流程只在桌機尺寸跑一次，其他尺寸只跑冒煙截圖
    { name: 'tablet-768', testIgnore: /export\.spec/, use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true } },
    {
      name: 'mobile-390',
      testIgnore: /export\.spec/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
    },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
