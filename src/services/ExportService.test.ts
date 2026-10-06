import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { FriendlyError } from '../lib/errors';
import { ASPECT_RATIOS, LAYOUTS, createEmptyCell } from '../lib/layouts';
import type { CellMedia, CellState, Composition } from '../lib/types';
import {
  AVC_CODECS,
  animationDuration,
  chooseAvcConfig,
  encodeGif,
  encodeMp4,
  exportComposition,
  exportFileName,
  gifFrameDelaysMs,
  hasAnimatedMedia,
  mp4Bitrate,
  paletteSampleIndices,
  samplePaletteSource,
  totalFrames,
  videoTimeAt,
  type Mp4Env,
  type RgbaFrame,
} from './ExportService';

const aspect916 = ASPECT_RATIOS.find((a) => a.id === '9:16')!;

function media(kind: CellMedia['kind'], duration = 0): CellMedia {
  return { kind, url: 'blob:test', thumbUrl: null, name: `x.${kind}`, width: 100, height: 100, duration };
}

function cellWith(m: CellMedia | null): CellState {
  return { ...createEmptyCell(), media: m };
}

function comp(cells: CellState[]): Composition {
  return { layout: LAYOUTS[4], aspect: aspect916, cells, gap: 4, radius: 0, background: '#000000' };
}

function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe('動態長度與影格計算', () => {
  it('只有照片時不算動態', () => {
    expect(hasAnimatedMedia([cellWith(media('image'))])).toBe(false);
    expect(hasAnimatedMedia([cellWith(media('gif', 2))])).toBe(true);
  });
  it('取最長的影片，介於 3～15 秒', () => {
    expect(animationDuration([cellWith(media('gif', 1.2))])).toBe(3);
    expect(animationDuration([cellWith(media('video', 7.5)), cellWith(media('gif', 2))])).toBe(7.5);
    expect(animationDuration([cellWith(media('video', 120))])).toBe(15);
  });
  it('影格數量', () => {
    expect(totalFrames(7.5, 30)).toBe(225);
    expect(totalFrames(0, 30)).toBe(1);
  });
  it('GIF 延遲以 1/100 秒累積，總長度不飄移', () => {
    const delays = gifFrameDelaysMs(45, 15); // 3 秒
    expect(delays.reduce((a, b) => a + b, 0)).toBe(3000);
    expect(delays.every((d) => d % 10 === 0)).toBe(true);
    expect(new Set(delays)).toEqual(new Set([60, 70]));
  });
  it('影片比匯出長度短時循環', () => {
    expect(videoTimeAt(5, 2)).toBeCloseTo(1);
    expect(videoTimeAt(2, 2)).toBe(0);
    expect(videoTimeAt(1.9999, 2)).toBeLessThan(2);
    expect(videoTimeAt(3, 0)).toBe(0);
    expect(videoTimeAt(3, Infinity)).toBe(0);
  });
});

describe('exportFileName', () => {
  it('以日期時間命名', () => {
    expect(exportFileName('mp4', new Date(2026, 9, 6, 9, 5, 7))).toBe('happybigbomb-20261006-090507.mp4');
  });
});

describe('MP4 編碼設定', () => {
  it('位元率限制在 2～16 Mbps', () => {
    expect(mp4Bitrate(100, 100, 30)).toBe(2_000_000);
    expect(mp4Bitrate(1080, 1920, 30)).toBe(6_220_800);
    expect(mp4Bitrate(4000, 4000, 60)).toBe(16_000_000);
  });

  it('選擇第一個瀏覽器支援的設定', async () => {
    const isConfigSupported = vi.fn(async (c: VideoEncoderConfig) => ({ supported: c.codec === AVC_CODECS[2], config: c }));
    const config = await chooseAvcConfig(aspect916, { isConfigSupported } as never);
    expect(config).toMatchObject({ codec: AVC_CODECS[2], width: 1080, height: 1920, framerate: 30 });
  });

  it('大尺寸不支援時改用較小尺寸', async () => {
    const isConfigSupported = vi.fn(async (c: VideoEncoderConfig) => ({ supported: c.height <= 1280, config: c }));
    const config = await chooseAvcConfig(aspect916, { isConfigSupported } as never);
    expect(config).toMatchObject({ width: 720, height: 1280 });
  });

  it('全部不支援（或丟錯）時回傳 null', async () => {
    const isConfigSupported = vi.fn(async () => {
      throw new Error('nope');
    });
    expect(await chooseAvcConfig(aspect916, { isConfigSupported } as never)).toBeNull();
  });
});

describe('encodeGif', () => {
  const W = 8;
  const H = 6;
  const colors = [
    [230, 40, 20],
    [20, 200, 60],
    [30, 60, 220],
  ];
  const frameAt = (i: number): RgbaFrame => {
    const data = new Uint8ClampedArray(W * H * 4);
    const [r, g, b] = colors[i % colors.length];
    for (let p = 0; p < data.length; p += 4) {
      data[p] = r;
      data[p + 1] = g;
      data[p + 2] = b;
      data[p + 3] = 255;
    }
    return { data, width: W, height: H };
  };

  it('產生可被解碼、會無限循環的 GIF，影格數與延遲正確', async () => {
    const progress: number[] = [];
    const blob = await encodeGif({ width: W, height: H, frameCount: 6, fps: 15, getFrame: frameAt, onProgress: (p) => progress.push(p) });
    expect(blob.type).toBe('image/gif');
    const bytes = await blobBytes(blob);
    expect(new TextDecoder().decode(bytes.slice(0, 6))).toBe('GIF89a');
    expect(new TextDecoder().decode(bytes)).toContain('NETSCAPE2.0'); // 循環播放
    const gif = parseGIF(bytes.buffer as ArrayBuffer);
    expect(gif.lsd).toMatchObject({ width: W, height: H });
    const frames = decompressFrames(gif, true);
    expect(frames).toHaveLength(6);
    expect(frames.map((f) => f.delay)).toEqual(gifFrameDelaysMs(6, 15));
    // 顏色在共用色盤中被保留
    const firstPixel = Array.from(frames[1].patch.slice(0, 3));
    expect(Math.abs(firstPixel[1] - 200)).toBeLessThan(12);
    expect(progress.at(-1)).toBe(1);
  });

  it('可以中途取消', async () => {
    const controller = new AbortController();
    const getFrame = vi.fn((i: number) => {
      if (i === 3) controller.abort();
      return frameAt(i);
    });
    await expect(encodeGif({ width: W, height: H, frameCount: 10, fps: 15, getFrame, signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('色盤取樣平均分布在整段動畫', () => {
    expect(paletteSampleIndices(1)).toEqual([0]);
    expect(paletteSampleIndices(6)).toEqual([0, 1, 2, 3, 4, 5]);
    const idx = paletteSampleIndices(225);
    expect(idx).toHaveLength(10);
    expect(idx[0]).toBe(0);
    expect(idx.at(-1)).toBe(224);
  });

  it('色盤取樣只取 RGB 並把透明度設為不透明', () => {
    const src = samplePaletteSource([{ data: new Uint8ClampedArray([1, 2, 3, 0, 4, 5, 6, 0]), width: 2, height: 1 }], 1);
    expect(Array.from(src)).toEqual([1, 2, 3, 255, 4, 5, 6, 255]);
  });
});

/** 模擬 WebCodecs：讓 MP4 封裝流程可以在 Node 中驗證 */
function fakeEnv(opts: { failAt?: number } = {}) {
  const encoded: { keyFrame: boolean; timestamp: number }[] = [];
  class FakeChunk {
    readonly type: 'key' | 'delta';
    readonly timestamp: number;
    readonly duration: number;
    private data: Uint8Array;
    constructor(type: 'key' | 'delta', timestamp: number, duration: number, data: Uint8Array) {
      this.type = type;
      this.timestamp = timestamp;
      this.duration = duration;
      this.data = data;
    }
    get byteLength() {
      return this.data.byteLength;
    }
    copyTo(dst: Uint8Array) {
      dst.set(this.data);
    }
  }
  vi.stubGlobal('EncodedVideoChunk', FakeChunk);
  let closedFrames = 0;
  class FakeFrame {
    timestamp: number;
    duration: number;
    constructor(_src: unknown, init: { timestamp: number; duration: number }) {
      this.timestamp = init.timestamp;
      this.duration = init.duration;
    }
    close() {
      closedFrames++;
    }
  }
  class FakeEncoder {
    state: 'unconfigured' | 'configured' | 'closed' = 'unconfigured';
    encodeQueueSize = 0;
    private config!: VideoEncoderConfig;
    private sent = 0;
    private output: (chunk: unknown, meta?: unknown) => void;
    private error: (e: Error) => void;
    constructor(init: { output: (chunk: unknown, meta?: unknown) => void; error: (e: Error) => void }) {
      this.output = init.output;
      this.error = init.error;
    }
    static async isConfigSupported(c: VideoEncoderConfig) {
      return { supported: true, config: c };
    }
    configure(c: VideoEncoderConfig) {
      this.config = c;
      this.state = 'configured';
    }
    encode(frame: FakeFrame, o: { keyFrame: boolean }) {
      if (opts.failAt === this.sent) {
        this.error(new Error('硬體編碼器錯誤'));
        return;
      }
      encoded.push({ keyFrame: o.keyFrame, timestamp: frame.timestamp });
      const data = new Uint8Array([0, 0, 0, 2, 0x65, this.sent & 255]);
      const chunk = new FakeChunk(o.keyFrame ? 'key' : 'delta', frame.timestamp, frame.duration, data);
      const meta =
        this.sent === 0
          ? { decoderConfig: { codec: this.config.codec, codedWidth: this.config.width, codedHeight: this.config.height, description: new Uint8Array([1, 0x64, 0, 0x33, 0xff]) } }
          : undefined;
      this.sent++;
      this.output(chunk, meta);
    }
    async flush() {}
    close() {
      this.state = 'closed';
    }
  }
  const env = { VideoEncoder: FakeEncoder, VideoFrame: FakeFrame } as unknown as Mp4Env;
  return { env, encoded, closedFrames: () => closedFrames };
}

describe('encodeMp4', () => {
  afterEach(() => vi.unstubAllGlobals());
  const config: VideoEncoderConfig = { codec: 'avc1.640033', width: 64, height: 112, bitrate: 2_000_000, framerate: 30 };

  it('產生含 ftyp/moov/avcC 的 MP4，每 2 秒一個關鍵影格，影格都有釋放', async () => {
    const { env, encoded, closedFrames } = fakeEnv();
    const blob = await encodeMp4({ config, frameCount: 90, fps: 30, env, getFrame: () => ({}) as CanvasImageSource });
    expect(blob.type).toBe('video/mp4');
    const text = new TextDecoder('latin1').decode(await blobBytes(blob));
    expect(text.slice(4, 8)).toBe('ftyp');
    expect(text).toContain('moov');
    expect(text).toContain('avcC');
    expect(encoded).toHaveLength(90);
    expect(encoded.filter((e) => e.keyFrame).map((e) => e.timestamp)).toEqual([0, 2_000_000]);
    expect(closedFrames()).toBe(90);
  });

  it('編碼器回報錯誤時中止並丟出錯誤，而不是產生壞檔', async () => {
    const { env } = fakeEnv({ failAt: 5 });
    await expect(encodeMp4({ config, frameCount: 30, fps: 30, env, getFrame: () => ({}) as CanvasImageSource })).rejects.toThrow('硬體編碼器錯誤');
  });

  it('沒有 WebCodecs 時給出白話說明', async () => {
    vi.stubGlobal('VideoEncoder', undefined);
    await expect(encodeMp4({ config, frameCount: 1, fps: 30, getFrame: () => ({}) as CanvasImageSource })).rejects.toBeInstanceOf(FriendlyError);
    vi.unstubAllGlobals();
  });
});

describe('exportComposition 的防呆', () => {
  it('沒有任何檔案時提示先加入照片', async () => {
    await expect(exportComposition(comp([cellWith(null)]), { format: 'png' })).rejects.toMatchObject({ title: '畫面上還沒有照片' });
  });
  it('只有照片卻要匯出動態檔案時說明原因', async () => {
    await expect(exportComposition(comp([cellWith(media('image'))]), { format: 'gif' })).rejects.toMatchObject({
      title: '目前只有靜態照片',
    });
  });
});
