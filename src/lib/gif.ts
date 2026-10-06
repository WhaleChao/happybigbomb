import type { GifFrame } from './types';

/**
 * 瀏覽器對 GIF 延遲的實際處理：小於等於 10ms（含 0）一律視為 100ms。
 * 若照原值播放，匯出的速度會和預覽不同。
 */
export function normalizeGifDelay(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 10) return 100;
  return ms;
}

/** 給定時間點（毫秒），回傳應顯示第幾張影格；會自動循環 */
export function gifFrameIndexAt(delays: number[], timeMs: number): number {
  if (delays.length === 0) return 0;
  const total = delays.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let t = ((timeMs % total) + total) % total;
  for (let i = 0; i < delays.length; i++) {
    if (t < delays[i]) return i;
    t -= delays[i];
  }
  return delays.length - 1;
}

/** 解碼後影格總像素的記憶體預算（位元組） */
export const GIF_MEMORY_BUDGET = 256 * 1024 * 1024;

/**
 * 影格太多時要每隔幾張保留一張，讓總記憶體控制在預算內。
 * 回傳 1 代表全部保留。
 */
export function gifKeepStep(frameCount: number, width: number, height: number, budget = GIF_MEMORY_BUDGET): number {
  const perFrame = Math.max(1, width * height * 4);
  const maxFrames = Math.max(1, Math.floor(budget / perFrame));
  return frameCount <= maxFrames ? 1 : Math.ceil(frameCount / maxFrames);
}

export interface DecodedGif {
  width: number;
  height: number;
  frames: GifFrame[];
  /** 秒 */
  duration: number;
}

/** 把 GIF 解成完整合成後的影格（正確處理 disposal 2／3） */
export async function decodeGif(buffer: ArrayBuffer): Promise<DecodedGif> {
  const { parseGIF, decompressFrames } = await import('gifuct-js');
  const gif = parseGIF(buffer);
  const raw = decompressFrames(gif, true);
  const width = gif.lsd.width;
  const height = gif.lsd.height;
  if (!raw.length || !width || !height) throw new Error('GIF 沒有可用的影格');

  const work = document.createElement('canvas');
  work.width = width;
  work.height = height;
  const ctx = work.getContext('2d', { willReadFrequently: true });
  const patchCanvas = document.createElement('canvas');
  const pctx = patchCanvas.getContext('2d');
  if (!ctx || !pctx) throw new Error('無法建立畫布');

  const step = gifKeepStep(raw.length, width, height);
  const frames: GifFrame[] = [];

  for (let i = 0; i < raw.length; i++) {
    const frame = raw[i];
    const prev = i > 0 ? raw[i - 1] : null;
    if (prev && prev.disposalType === 2) {
      ctx.clearRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height);
    }
    const restore = frame.disposalType === 3 ? ctx.getImageData(0, 0, width, height) : null;

    patchCanvas.width = frame.dims.width;
    patchCanvas.height = frame.dims.height;
    const imageData = new ImageData(new Uint8ClampedArray(frame.patch), frame.dims.width, frame.dims.height);
    pctx.putImageData(imageData, 0, 0);
    ctx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);

    if (i % step === 0) {
      const snapshot = document.createElement('canvas');
      snapshot.width = width;
      snapshot.height = height;
      snapshot.getContext('2d')?.drawImage(work, 0, 0);
      frames.push({ canvas: snapshot, delay: 0 });
    }
    // 被略過的影格時間併入最近一張保留的影格，總長度不變
    frames[frames.length - 1].delay += normalizeGifDelay(frame.delay);

    if (restore) ctx.putImageData(restore, 0, 0);
  }

  // 釋放暫存畫布
  work.width = work.height = 0;
  patchCanvas.width = patchCanvas.height = 0;

  const duration = frames.reduce((a, f) => a + f.delay, 0) / 1000;
  return { width, height, frames, duration };
}
