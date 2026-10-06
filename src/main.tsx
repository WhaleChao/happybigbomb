import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { embedTargetOrigin, isInIframe, readEmbedParams, resolveEmbedMode, startHeightReporter } from './lib/embed';
import './index.css';

const embedded = resolveEmbedMode();
const { theme } = readEmbedParams(window.location.search);
document.documentElement.dataset.embedded = embedded ? 'true' : 'false';

if (embedded && isInIframe() && window.parent) {
  // 量測 #root（而不是 html），iframe 比內容高時才能正確回報變矮
  startHeightReporter(window.parent, embedTargetOrigin(window.location.search), document.getElementById('root')!);
}

// 離線快取只在獨立網站啟用；嵌入時不註冊，避免干擾宿主網站
if (import.meta.env.PROD && !embedded && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* 註冊失敗不影響使用 */
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App embedded={embedded} initialTheme={theme} />
  </StrictMode>,
);
