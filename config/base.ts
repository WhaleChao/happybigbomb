/** GitHub Pages 的專案路徑；接入其他系統時以 VITE_BASE 覆寫 */
export const DEFAULT_BASE = '/happybigbomb/';

/**
 * 把 VITE_BASE 整理成 Vite 可用的 base：
 * - 未設定 → /happybigbomb/
 * - "./" 或 "." → 相對路徑（可放在任何子目錄）
 * - "tools/collage" → /tools/collage/
 * - 完整網址 → 補上結尾斜線
 */
export function normalizeBase(raw: string | undefined): string {
  const value = (raw ?? '').trim();
  if (!value) return DEFAULT_BASE;
  if (value === '.' || value === './') return './';
  if (/^https?:\/\//.test(value)) return value.endsWith('/') ? value : `${value}/`;
  let base = value.startsWith('/') ? value : `/${value}`;
  if (!base.endsWith('/')) base += '/';
  return base;
}
