import type { Page } from '@playwright/test';
import { createRequire } from 'node:module';

// gifenc 是 CommonJS 套件，在 Node 端用 require 載入
const { GIFEncoder, applyPalette, quantize } = createRequire(import.meta.url)('gifenc') as typeof import('gifenc');

export interface FilePayload {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/** 在瀏覽器裡畫出測試用照片（不需把二進位檔放進版本庫） */
export async function makePhotos(page: Page, count: number, w = 1600, h = 1200): Promise<FilePayload[]> {
  const list = await page.evaluate(
    async ({ count, w, h }) => {
      const hues = [12, 38, 150, 205, 265, 330, 90, 180, 300];
      const out: string[] = [];
      for (let i = 0; i < count; i++) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d')!;
        const hue = hues[i % hues.length];
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, `hsl(${hue} 70% 62%)`);
        g.addColorStop(1, `hsl(${(hue + 40) % 360} 55% 28%)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgb(255 255 255 / 0.85)';
        ctx.beginPath();
        ctx.arc(w * 0.62, h * 0.4, Math.min(w, h) * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgb(0 0 0 / 0.25)';
        ctx.fillRect(0, h * 0.72, w, h * 0.28);
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(h * 0.12)}px sans-serif`;
        ctx.fillText(String(i + 1), w * 0.06, h * 0.9);
        out.push(c.toDataURL('image/jpeg', 0.9).split(',')[1]);
      }
      return out;
    },
    { count, w, h },
  );
  return list.map((b64, i) => ({ name: `photo-${i + 1}.jpg`, mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') }));
}

/** 以 gifenc 產生 4 張影格、每張 200ms 的循環 GIF */
export function makeGif(): FilePayload {
  const w = 120;
  const h = 120;
  const gif = GIFEncoder();
  const colors = [
    [194, 58, 30],
    [242, 193, 78],
    [79, 174, 107],
    [61, 123, 217],
  ];
  colors.forEach(([r, g, b], f) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = (y * w + x) * 4;
        const inBox = x > 20 + f * 15 && x < 60 + f * 15 && y > 40 && y < 80;
        data[p] = inBox ? 255 : r;
        data[p + 1] = inBox ? 255 : g;
        data[p + 2] = inBox ? 255 : b;
        data[p + 3] = 255;
      }
    }
    const palette = quantize(data, 16);
    gif.writeFrame(applyPalette(data, palette), w, h, { palette, delay: 200, repeat: f === 0 ? 0 : undefined });
  });
  gif.finish();
  return { name: 'loop.gif', mimeType: 'image/gif', buffer: Buffer.from(gif.bytes()) };
}

/** 用 MediaRecorder 錄一段 2 秒的 WebM 測試影片 */
export async function makeVideo(page: Page): Promise<FilePayload | null> {
  const b64 = await page.evaluate(async () => {
    if (typeof MediaRecorder === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 240;
    const ctx = c.getContext('2d')!;
    const stream = c.captureStream(30);
    const type = MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
    const rec = new MediaRecorder(stream, { mimeType: type });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise<void>((r) => (rec.onstop = () => r()));
    rec.start(100);
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const draw = () => {
        const t = (performance.now() - start) / 1000;
        ctx.fillStyle = `hsl(${(t * 180) % 360} 60% 45%)`;
        ctx.fillRect(0, 0, 320, 240);
        ctx.fillStyle = '#fff';
        ctx.fillRect(20 + ((t * 120) % 260), 100, 40, 40);
        if (t < 2) requestAnimationFrame(draw);
        else resolve();
      };
      draw();
    });
    rec.stop();
    await done;
    const blob = new Blob(chunks, { type: 'video/webm' });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  });
  return b64 ? { name: 'clip.webm', mimeType: 'video/webm', buffer: Buffer.from(b64, 'base64') } : null;
}
