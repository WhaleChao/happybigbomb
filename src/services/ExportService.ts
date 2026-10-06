/**
 * 匯出服務：PNG／GIF／MP4 全部在瀏覽器內完成，不會上傳任何資料。
 *
 * 匯出時不讀取畫面上的 DOM 尺寸，而是用與預覽相同的幾何函式
 * （computeCellRects / computeMediaRect）在固定解析度重新繪製，
 * 因此成品與螢幕大小無關，且與預覽一致。
 */
import { FriendlyError, isAbortError, throwIfAborted, toFriendly } from '../lib/errors';
import { applyFiltersToPixels, filterToCss, isDefaultFilters, supportsCanvasFilter } from '../lib/filters';
import { clampRadius, computeCellRects, computeMediaRect, outputSize, unitToPx } from '../lib/geometry';
import { gifFrameIndexAt } from '../lib/gif';
import { MAX_ANIMATION_SECONDS } from '../lib/media';
import type { AspectRatioOption, CellState, Composition, Rect } from '../lib/types';

export type ExportFormat = 'png' | 'gif' | 'mp4';

export interface PngSize {
  id: string;
  label: string;
  longEdge: number;
}

export const PNG_SIZES: PngSize[] = [
  { id: 'fhd', label: '標準', longEdge: 1920 },
  { id: '2k', label: '高畫質', longEdge: 2560 },
  { id: '4k', label: '超高畫質', longEdge: 3840 },
];

export const GIF_LONG_EDGE = 720;
export const GIF_FPS = 15;
export const MP4_FPS = 30;
export const MP4_LONG_EDGES = [1920, 1280, 960];
/** 只有靜態照片時，動態檔案的預設長度（秒） */
export const MIN_ANIMATION_SECONDS = 3;

// ---------- 純函式（可單元測試） ----------

export function hasAnimatedMedia(cells: CellState[]): boolean {
  return cells.some((c) => c.media && (c.media.kind === 'video' || c.media.kind === 'gif'));
}

/** 動態匯出的長度：取最長的影片／GIF，介於 3～15 秒 */
export function animationDuration(cells: CellState[]): number {
  let max = MIN_ANIMATION_SECONDS;
  for (const c of cells) {
    if (c.media && (c.media.kind === 'video' || c.media.kind === 'gif') && c.media.duration > 0) {
      max = Math.max(max, c.media.duration);
    }
  }
  return Math.min(max, MAX_ANIMATION_SECONDS);
}

export function totalFrames(durationSec: number, fps: number): number {
  return Math.max(1, Math.round(durationSec * fps));
}

/**
 * GIF 的延遲以 1/100 秒為單位。直接四捨五入會讓總長度飄移，
 * 這裡以累積時間計算每張影格延遲，總長度保持精準。
 */
export function gifFrameDelaysMs(frameCount: number, fps: number): number[] {
  const delays: number[] = [];
  for (let i = 0; i < frameCount; i++) {
    const start = Math.round((i * 100) / fps);
    const end = Math.round(((i + 1) * 100) / fps);
    delays.push((end - start) * 10);
  }
  return delays;
}

/** 影片比匯出長度短時循環播放（與預覽的 loop 一致） */
export function videoTimeAt(tSec: number, durationSec: number): number {
  if (!(durationSec > 0) || !Number.isFinite(durationSec)) return 0;
  const t = tSec % durationSec;
  // 避免剛好落在結尾導致抓不到畫面
  return Math.min(t, Math.max(0, durationSec - 0.001));
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function exportFileName(format: ExportFormat, now = new Date()): string {
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `happybigbomb-${stamp}.${format}`;
}

export function mp4Bitrate(width: number, height: number, fps: number): number {
  // 約 0.1 bit／像素／影格，限制在 2～16 Mbps
  return Math.round(Math.min(16_000_000, Math.max(2_000_000, width * height * fps * 0.1)));
}

export const AVC_CODECS = [
  'avc1.640033', // High 5.1
  'avc1.4d0033', // Main 5.1
  'avc1.42e033', // Baseline 5.1
  'avc1.640028', // High 4.0
  'avc1.42e028', // Baseline 4.0
  'avc1.42e01f', // Baseline 3.1
];

type EncoderCtor = Pick<typeof VideoEncoder, 'isConfigSupported'>;

/** 依序嘗試解析度與編碼設定，回傳瀏覽器支援的第一組 */
export async function chooseAvcConfig(
  aspect: AspectRatioOption,
  Encoder: EncoderCtor,
  fps = MP4_FPS,
  longEdges = MP4_LONG_EDGES,
): Promise<VideoEncoderConfig | null> {
  for (const edge of longEdges) {
    const { width, height } = outputSize(aspect, edge, true);
    for (const codec of AVC_CODECS) {
      const config: VideoEncoderConfig = {
        codec,
        width,
        height,
        bitrate: mp4Bitrate(width, height, fps),
        framerate: fps,
        avc: { format: 'avc' },
      };
      try {
        const res = await Encoder.isConfigSupported(config);
        if (res.supported) return config;
      } catch {
        // 某些瀏覽器對不認得的 codec 會直接丟錯，視為不支援
      }
    }
  }
  return null;
}

// ---------- 編碼器 ----------

export interface RgbaFrame {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface Progress {
  (ratio: number): void;
}

export interface GifEncodeOptions {
  width: number;
  height: number;
  frameCount: number;
  fps: number;
  getFrame: (index: number) => Promise<RgbaFrame> | RgbaFrame;
  onProgress?: Progress;
  signal?: AbortSignal;
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/** 從數張代表影格取樣建立共用色盤，避免靜態區塊在動畫中閃爍 */
export function samplePaletteSource(frames: RgbaFrame[], stride = 4): Uint8ClampedArray {
  const total = frames.reduce((n, f) => n + Math.ceil(f.data.length / 4 / stride), 0);
  const out = new Uint8ClampedArray(total * 4);
  let o = 0;
  for (const f of frames) {
    for (let p = 0; p < f.data.length; p += 4 * stride) {
      out[o++] = f.data[p];
      out[o++] = f.data[p + 1];
      out[o++] = f.data[p + 2];
      out[o++] = 255;
    }
  }
  return out.subarray(0, o);
}

/** 平均挑選最多 10 張影格建立色盤（只看頭尾容易漏掉中段出現的顏色） */
export function paletteSampleIndices(frameCount: number, max = 10): number[] {
  const n = Math.min(frameCount, max);
  if (n <= 1) return [0];
  return Array.from(new Set(Array.from({ length: n }, (_, k) => Math.round((k * (frameCount - 1)) / (n - 1)))));
}

export async function encodeGif(opts: GifEncodeOptions): Promise<Blob> {
  const { width, height, frameCount, fps, getFrame, onProgress, signal } = opts;
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  throwIfAborted(signal);

  const sampleIdx = paletteSampleIndices(frameCount);
  const samples: RgbaFrame[] = [];
  for (const i of sampleIdx) {
    throwIfAborted(signal);
    const f = await getFrame(i);
    // 每張只取部分像素，控制記憶體
    samples.push({ data: samplePaletteSource([f], 2 * sampleIdx.length), width: f.width, height: f.height });
    onProgress?.((samples.length / sampleIdx.length) * 0.1);
  }
  const palette = quantize(samplePaletteSource(samples, 1), 256, { format: 'rgb565' });
  samples.length = 0;

  const delays = gifFrameDelaysMs(frameCount, fps);
  const gif = GIFEncoder();
  for (let i = 0; i < frameCount; i++) {
    throwIfAborted(signal);
    const frame = await getFrame(i);
    const index = applyPalette(frame.data, palette, 'rgb565');
    gif.writeFrame(index, width, height, i === 0 ? { palette, delay: delays[i], repeat: 0 } : { delay: delays[i] });
    onProgress?.(0.1 + ((i + 1) / frameCount) * 0.9);
    await tick();
  }
  gif.finish();
  const bytes = gif.bytes();
  return new Blob([bytes as BlobPart], { type: 'image/gif' });
}

export interface Mp4Env {
  VideoEncoder: typeof VideoEncoder;
  VideoFrame: typeof VideoFrame;
}

export interface Mp4EncodeOptions {
  config: VideoEncoderConfig;
  frameCount: number;
  fps: number;
  getFrame: (index: number) => Promise<CanvasImageSource> | CanvasImageSource;
  onProgress?: Progress;
  signal?: AbortSignal;
  env?: Mp4Env;
}

export function getMp4Env(): Mp4Env | null {
  if (typeof window === 'undefined') return null;
  if (typeof window.VideoEncoder !== 'function' || typeof window.VideoFrame !== 'function') return null;
  return { VideoEncoder: window.VideoEncoder, VideoFrame: window.VideoFrame };
}

export async function encodeMp4(opts: Mp4EncodeOptions): Promise<Blob> {
  const { config, frameCount, fps, getFrame, onProgress, signal } = opts;
  const env = opts.env ?? getMp4Env();
  if (!env) throw mp4UnsupportedError();
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: config.width, height: config.height, frameRate: fps },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  let encodeError: unknown = null;
  const encoder = new env.VideoEncoder({
    output: (chunk, meta) => {
      // 這個回呼中丟出的錯誤不會傳回呼叫端，必須自己接住
      try {
        muxer.addVideoChunk(chunk, meta);
      } catch (e) {
        encodeError ??= e;
      }
    },
    error: (e) => {
      encodeError ??= e;
    },
  });

  try {
    encoder.configure(config);
    const frameDuration = 1_000_000 / fps;
    const keyEvery = fps * 2;
    for (let i = 0; i < frameCount; i++) {
      throwIfAborted(signal);
      if (encodeError) throw encodeError;
      const source = await getFrame(i);
      const frame = new env.VideoFrame(source, {
        timestamp: Math.round(i * frameDuration),
        duration: Math.round(frameDuration),
      });
      try {
        encoder.encode(frame, { keyFrame: i % keyEvery === 0 });
      } finally {
        frame.close();
      }
      // 背壓：編碼佇列太長時稍等，避免記憶體暴增
      while (encoder.encodeQueueSize > 4) {
        await new Promise((r) => setTimeout(r, 4));
        if (encodeError) throw encodeError;
      }
      onProgress?.((i + 1) / frameCount);
      await tick();
    }
    await encoder.flush();
    if (encodeError) throw encodeError;
    muxer.finalize();
    return new Blob([muxer.target.buffer], { type: 'video/mp4' });
  } finally {
    if (encoder.state !== 'closed') {
      try {
        encoder.close();
      } catch {
        /* 已關閉 */
      }
    }
  }
}

/** 這個瀏覽器能否以 H.264 製作 MP4（有 WebCodecs 不代表一定有 H.264 編碼器） */
export async function canExportMp4(aspect: AspectRatioOption): Promise<boolean> {
  const env = getMp4Env();
  if (!env) return false;
  try {
    return (await chooseAvcConfig(aspect, env.VideoEncoder)) !== null;
  } catch {
    return false;
  }
}

export function mp4UnsupportedError(): FriendlyError {
  return new FriendlyError(
    '這個瀏覽器無法在本機製作 MP4',
    '請改用最新版的 Chrome、Edge、Safari 或 Firefox，或改匯出 GIF。',
  );
}

// ---------- 畫面合成 ----------

type Source =
  | { kind: 'image'; el: HTMLImageElement; w: number; h: number }
  | { kind: 'video'; el: HTMLVideoElement; w: number; h: number; duration: number }
  | { kind: 'gif'; frames: HTMLCanvasElement[]; delays: number[]; w: number; h: number }
  | null;

function loadImageEl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

function loadVideoEl(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error('video load failed'));
    v.src = url;
  });
}

export function seekVideo(v: HTMLVideoElement, t: number, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(v.currentTime - t) < 0.0005 && v.readyState >= 2) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      v.removeEventListener('seeked', finish);
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    v.addEventListener('seeked', finish);
    v.currentTime = t;
  });
}

function roundRectPath(ctx: CanvasRenderingContext2D, r: Rect, radius: number): void {
  ctx.beginPath();
  if (radius <= 0) {
    ctx.rect(r.x, r.y, r.w, r.h);
    return;
  }
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(r.x, r.y, r.w, r.h, radius);
    return;
  }
  const { x, y, w, h } = r;
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export class CompositionRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  /** 瀏覽器不支援 canvas 濾鏡時，模糊會被略過 */
  blurSkipped = false;
  private sources: Source[] = [];
  private scratch: HTMLCanvasElement | null = null;
  private comp: Composition;

  private constructor(comp: Composition, width: number, height: number, willReadFrequently: boolean) {
    this.comp = comp;
    this.width = width;
    this.height = height;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.canvas.getContext('2d', { willReadFrequently, alpha: false });
    if (!ctx) {
      throw new FriendlyError('圖片尺寸超過這台裝置的上限', '請改選較小的匯出尺寸再試一次。');
    }
    this.ctx = ctx;
  }

  static async create(
    comp: Composition,
    width: number,
    height: number,
    opts: { willReadFrequently?: boolean; signal?: AbortSignal } = {},
  ): Promise<CompositionRenderer> {
    const r = new CompositionRenderer(comp, width, height, !!opts.willReadFrequently);
    try {
      r.sources = await Promise.all(
        comp.cells.map(async (cell): Promise<Source> => {
          const m = cell.media;
          if (!m) return null;
          if (m.kind === 'gif' && m.gifFrames?.length) {
            return {
              kind: 'gif',
              frames: m.gifFrames.map((f) => f.canvas),
              delays: m.gifFrames.map((f) => f.delay),
              w: m.width,
              h: m.height,
            };
          }
          if (m.kind === 'video') {
            const el = await loadVideoEl(m.url);
            return { kind: 'video', el, w: el.videoWidth || m.width, h: el.videoHeight || m.height, duration: el.duration || m.duration };
          }
          const el = await loadImageEl(m.url);
          return { kind: 'image', el, w: el.naturalWidth || m.width, h: el.naturalHeight || m.height };
        }),
      );
      throwIfAborted(opts.signal);
    } catch (err) {
      r.dispose();
      if (isAbortError(err)) throw err;
      throw new FriendlyError('有檔案在匯出時讀不到', '請把出問題的格子重新加入檔案後再匯出一次。', { cause: err });
    }
    return r;
  }

  /** 把所有影片移到指定時間，並畫出該時間的完整畫面 */
  async renderAt(tSec: number): Promise<void> {
    const seeks: Promise<void>[] = [];
    for (const s of this.sources) {
      if (s?.kind === 'video') seeks.push(seekVideo(s.el, videoTimeAt(tSec, s.duration)));
    }
    if (seeks.length) await Promise.all(seeks);
    this.draw(tSec);
  }

  draw(tSec: number): void {
    const { ctx, width, height, comp } = this;
    const unit = unitToPx(width, height);
    const rects = computeCellRects(comp.layout, width, height, comp.gap * unit);
    const canFilter = supportsCanvasFilter();

    ctx.save();
    ctx.fillStyle = comp.background;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    rects.forEach((rect, i) => {
      const cell = comp.cells[i];
      const src = this.sources[i];
      if (!cell || !src) return;

      let image: CanvasImageSource;
      if (src.kind === 'gif') image = src.frames[gifFrameIndexAt(src.delays, tSec * 1000)];
      else image = src.el;

      const m = computeMediaRect(rect.w, rect.h, src.w, src.h, cell.fit, cell.scale, cell.offsetX, cell.offsetY);
      const radius = clampRadius(comp.radius * unit, rect);

      ctx.save();
      roundRectPath(ctx, rect, radius);
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (isDefaultFilters(cell.filters)) {
        ctx.drawImage(image, rect.x + m.x, rect.y + m.y, m.w, m.h);
      } else if (canFilter) {
        ctx.filter = filterToCss(cell.filters, cell.filters.blur * unit);
        ctx.drawImage(image, rect.x + m.x, rect.y + m.y, m.w, m.h);
        ctx.filter = 'none';
      } else {
        this.drawWithPixelFilter(image, rect, m, cell);
      }
      ctx.restore();
    });
  }

  private drawWithPixelFilter(image: CanvasImageSource, rect: Rect, m: Rect, cell: CellState): void {
    const w = Math.max(1, Math.ceil(rect.w));
    const h = Math.max(1, Math.ceil(rect.h));
    if (!this.scratch) this.scratch = document.createElement('canvas');
    const sc = this.scratch;
    if (sc.width !== w || sc.height !== h) {
      sc.width = w;
      sc.height = h;
    }
    const sctx = sc.getContext('2d', { willReadFrequently: true });
    if (!sctx) return;
    sctx.clearRect(0, 0, w, h);
    sctx.drawImage(image, m.x, m.y, m.w, m.h);
    const data = sctx.getImageData(0, 0, w, h);
    applyFiltersToPixels(data.data, cell.filters);
    sctx.putImageData(data, 0, 0);
    if (cell.filters.blur > 0) this.blurSkipped = true;
    this.ctx.drawImage(sc, rect.x, rect.y);
  }

  dispose(): void {
    for (const s of this.sources) {
      if (s?.kind === 'video') {
        s.el.pause();
        s.el.removeAttribute('src');
        s.el.load();
      } else if (s?.kind === 'image') {
        s.el.removeAttribute('src');
      }
    }
    this.sources = [];
    if (this.scratch) {
      this.scratch.width = this.scratch.height = 0;
      this.scratch = null;
    }
    this.canvas.width = this.canvas.height = 0;
  }
}

// ---------- 對外 API ----------

export interface ExportRequest {
  format: ExportFormat;
  /** 只對 PNG 有效 */
  longEdge?: number;
  onProgress?: Progress;
  signal?: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
  /** 需要提醒使用者的事項（例如模糊被略過） */
  notes: string[];
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else
        reject(
          new FriendlyError('圖片太大，這台裝置無法輸出', '請在匯出設定改選較小的尺寸（例如「標準」）再試一次。'),
        );
    }, type);
  });
}

export async function exportComposition(comp: Composition, req: ExportRequest): Promise<ExportResult> {
  const { format, onProgress, signal } = req;
  if (!comp.cells.some((c) => c.media)) {
    throw new FriendlyError('畫面上還沒有照片', '先點選任一格子加入照片或影片，再按匯出。');
  }
  if (format !== 'png' && !hasAnimatedMedia(comp.cells)) {
    throw new FriendlyError('目前只有靜態照片', '動態檔案需要至少一段影片或 GIF；只有照片時請匯出 PNG。');
  }

  let renderer: CompositionRenderer | null = null;
  try {
    if (format === 'png') {
      const { width, height } = outputSize(comp.aspect, req.longEdge ?? PNG_SIZES[0].longEdge);
      renderer = await CompositionRenderer.create(comp, width, height, { signal });
      await renderer.renderAt(0);
      onProgress?.(0.6);
      const blob = await canvasToBlob(renderer.canvas, 'image/png');
      onProgress?.(1);
      return { blob, filename: exportFileName('png'), width, height, notes: notesFor(renderer) };
    }

    const duration = animationDuration(comp.cells);

    if (format === 'gif') {
      const { width, height } = outputSize(comp.aspect, GIF_LONG_EDGE);
      const r = (renderer = await CompositionRenderer.create(comp, width, height, { willReadFrequently: true, signal }));
      const frameCount = totalFrames(duration, GIF_FPS);
      const blob = await encodeGif({
        width,
        height,
        frameCount,
        fps: GIF_FPS,
        signal,
        onProgress,
        getFrame: async (i) => {
          await r.renderAt(i / GIF_FPS);
          return r.ctx.getImageData(0, 0, width, height);
        },
      });
      return { blob, filename: exportFileName('gif'), width, height, notes: notesFor(r) };
    }

    // mp4
    const env = getMp4Env();
    if (!env) throw mp4UnsupportedError();
    const config = await chooseAvcConfig(comp.aspect, env.VideoEncoder);
    if (!config) throw mp4UnsupportedError();
    const r = (renderer = await CompositionRenderer.create(comp, config.width, config.height, { signal }));
    const frameCount = totalFrames(duration, MP4_FPS);
    const blob = await encodeMp4({
      config,
      frameCount,
      fps: MP4_FPS,
      env,
      signal,
      onProgress,
      getFrame: async (i) => {
        await r.renderAt(i / MP4_FPS);
        return r.canvas;
      },
    });
    return { blob, filename: exportFileName('mp4'), width: config.width, height: config.height, notes: notesFor(r) };
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw toFriendly(err, format === 'mp4' ? '影片編碼失敗' : '匯出失敗');
  } finally {
    renderer?.dispose();
  }
}

function notesFor(r: CompositionRenderer): string[] {
  return r.blurSkipped ? ['這個瀏覽器不支援在匯出時套用「模糊」，其他調整都已保留。'] : [];
}

/** 判斷是否為手機／平板（決定是否優先使用分享面板） */
function prefersShareSheet(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /Android|iPhone|iPad|iPod|Mobi/i.test(ua) || iPadOS;
}

/**
 * 把檔案交給使用者：手機優先開分享面板（可直接存到相簿），
 * 其他情況用下載連結。回傳 'cancelled' 表示使用者關掉分享面板。
 */
export async function deliverBlob(blob: Blob, filename: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (prefersShareSheet() && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], filename, { type: blob.type });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return 'shared';
      }
    } catch (err) {
      if (isAbortError(err)) return 'cancelled';
      // 其他錯誤（例如 iframe 未開放 web-share、或失去使用者手勢）改用下載
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}
