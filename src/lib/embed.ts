/**
 * 嵌入模式：被放進其他網站的 iframe 時使用。
 * - 以 ?embed=1 強制開啟，或自動偵測位於 iframe 內
 * - 版面改用內容自然高度，並以 postMessage 回報高度給父頁面
 */

export const HEIGHT_MESSAGE_TYPE = 'happybigbomb:height';

export interface HeightMessage {
  type: typeof HEIGHT_MESSAGE_TYPE;
  height: number;
}

export function isInIframe(win: Window = window): boolean {
  try {
    return win.self !== win.top;
  } catch {
    // 跨網域存取 top 會丟錯，代表一定在 iframe 內
    return true;
  }
}

export function readEmbedParams(search: string): { embed: boolean | null; parentOrigin: string | null; theme: 'light' | 'dark' | null } {
  const params = new URLSearchParams(search);
  const raw = params.get('embed');
  const embed = raw === null ? null : raw !== '0' && raw !== 'false';
  const theme = params.get('theme');
  return {
    embed,
    parentOrigin: normalizeOrigin(params.get('parentOrigin')),
    theme: theme === 'light' || theme === 'dark' ? theme : null,
  };
}

/** 只接受合法的 http(s) origin；其他一律視為未設定 */
export function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function resolveEmbedMode(win: Window = window): boolean {
  const { embed } = readEmbedParams(win.location.search);
  if (embed !== null) return embed;
  return isInIframe(win);
}

/** 回報高度給父頁面；回傳停止函式 */
export function startHeightReporter(target: Window, origin: string, root: HTMLElement = document.documentElement): () => void {
  let last = -1;
  let scheduled = false;
  let frame = 0;
  const send = () => {
    scheduled = false;
    const height = Math.ceil(root.scrollHeight);
    if (height === last) return;
    last = height;
    const msg: HeightMessage = { type: HEIGHT_MESSAGE_TYPE, height };
    target.postMessage(msg, origin);
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    frame = requestAnimationFrame(send);
  };
  const ro = new ResizeObserver(schedule);
  ro.observe(root);
  if (document.body) ro.observe(document.body);
  window.addEventListener('load', schedule);
  schedule();
  return () => {
    ro.disconnect();
    window.removeEventListener('load', schedule);
    if (scheduled) cancelAnimationFrame(frame);
  };
}

export function embedTargetOrigin(search: string): string {
  return readEmbedParams(search).parentOrigin ?? normalizeOrigin(import.meta.env.VITE_EMBED_PARENT_ORIGIN) ?? '*';
}
