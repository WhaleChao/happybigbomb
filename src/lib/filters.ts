import type { Filters } from './types';

export const DEFAULT_FILTERS: Filters = Object.freeze({
  brightness: 100,
  contrast: 100,
  saturate: 100,
  blur: 0,
  grayscale: 0,
  sepia: 0,
}) as Filters;

export interface FilterPreset {
  id: string;
  name: string;
  filters: Filters;
}

export const PRESETS: FilterPreset[] = [
  { id: 'original', name: '原始', filters: { ...DEFAULT_FILTERS } },
  { id: 'warm', name: '暖色', filters: { brightness: 105, contrast: 105, saturate: 130, blur: 0, grayscale: 0, sepia: 20 } },
  { id: 'cool', name: '冷色', filters: { brightness: 100, contrast: 110, saturate: 80, blur: 0, grayscale: 0, sepia: 0 } },
  { id: 'vintage', name: '復古', filters: { brightness: 95, contrast: 90, saturate: 70, blur: 0, grayscale: 0, sepia: 50 } },
  { id: 'mono', name: '黑白', filters: { brightness: 110, contrast: 120, saturate: 0, blur: 0, grayscale: 100, sepia: 0 } },
  { id: 'punch', name: '高對比', filters: { brightness: 110, contrast: 150, saturate: 120, blur: 0, grayscale: 0, sepia: 0 } },
  { id: 'soft', name: '柔焦', filters: { brightness: 105, contrast: 95, saturate: 90, blur: 1, grayscale: 0, sepia: 0 } },
  { id: 'drama', name: '戲劇', filters: { brightness: 90, contrast: 140, saturate: 110, blur: 0, grayscale: 0, sepia: 10 } },
];

export function isDefaultFilters(f: Filters): boolean {
  return (
    f.brightness === 100 && f.contrast === 100 && f.saturate === 100 && f.blur === 0 && f.grayscale === 0 && f.sepia === 0
  );
}

export function filtersEqual(a: Filters, b: Filters): boolean {
  return (
    a.brightness === b.brightness &&
    a.contrast === b.contrast &&
    a.saturate === b.saturate &&
    a.blur === b.blur &&
    a.grayscale === b.grayscale &&
    a.sepia === b.sepia
  );
}

/**
 * 轉成 CSS / Canvas 共用的 filter 字串。
 * @param blurPx 模糊實際要用的像素值（已依畫布尺寸換算）
 */
export function filterToCss(f: Filters, blurPx = f.blur): string {
  if (isDefaultFilters(f)) return 'none';
  const parts = [
    `brightness(${f.brightness}%)`,
    `contrast(${f.contrast}%)`,
    `saturate(${f.saturate}%)`,
  ];
  if (blurPx > 0) parts.push(`blur(${round(blurPx, 3)}px)`);
  parts.push(`grayscale(${f.grayscale}%)`, `sepia(${f.sepia}%)`);
  return parts.join(' ');
}

function round(n: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

type Matrix3 = [number, number, number, number, number, number, number, number, number];

/** CSS Filter Effects 規格中的 saturate 矩陣 */
function saturateMatrix(s: number): Matrix3 {
  return [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
  ];
}

function grayscaleMatrix(amount: number): Matrix3 {
  const a = 1 - Math.min(1, Math.max(0, amount));
  return [
    0.2126 + 0.7874 * a, 0.7152 - 0.7152 * a, 0.0722 - 0.0722 * a,
    0.2126 - 0.2126 * a, 0.7152 + 0.2848 * a, 0.0722 - 0.0722 * a,
    0.2126 - 0.2126 * a, 0.7152 - 0.7152 * a, 0.0722 + 0.9278 * a,
  ];
}

function sepiaMatrix(amount: number): Matrix3 {
  const a = 1 - Math.min(1, Math.max(0, amount));
  return [
    0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a,
    0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a,
    0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a,
  ];
}

/**
 * 不支援 ctx.filter 的瀏覽器（例如部分 Safari）使用的像素級濾鏡。
 * 依 CSS 規格的順序套用 brightness → contrast → saturate → grayscale → sepia。
 * 模糊無法以逐像素方式重現，會被略過（呼叫端應告知使用者）。
 */
export function applyFiltersToPixels(data: Uint8ClampedArray, f: Filters): void {
  if (isDefaultFilters({ ...f, blur: 0 })) return;
  const b = f.brightness / 100;
  const k = f.contrast / 100;
  const ops: Matrix3[] = [];
  if (f.saturate !== 100) ops.push(saturateMatrix(f.saturate / 100));
  if (f.grayscale !== 0) ops.push(grayscaleMatrix(f.grayscale / 100));
  if (f.sepia !== 0) ops.push(sepiaMatrix(f.sepia / 100));

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] / 255;
    let g = data[i + 1] / 255;
    let bl = data[i + 2] / 255;
    // brightness
    r *= b; g *= b; bl *= b;
    // contrast
    r = (r - 0.5) * k + 0.5;
    g = (g - 0.5) * k + 0.5;
    bl = (bl - 0.5) * k + 0.5;
    // CSS 每個濾鏡之間都會截斷到 0–1
    r = clamp01(r); g = clamp01(g); bl = clamp01(bl);
    for (const m of ops) {
      const nr = m[0] * r + m[1] * g + m[2] * bl;
      const ng = m[3] * r + m[4] * g + m[5] * bl;
      const nb = m[6] * r + m[7] * g + m[8] * bl;
      r = clamp01(nr); g = clamp01(ng); bl = clamp01(nb);
    }
    data[i] = r * 255;
    data[i + 1] = g * 255;
    data[i + 2] = bl * 255;
  }
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

let canvasFilterSupport: boolean | null = null;

/** 偵測 CanvasRenderingContext2D.filter 是否真的有效 */
export function supportsCanvasFilter(): boolean {
  if (canvasFilterSupport !== null) return canvasFilterSupport;
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx || !('filter' in ctx)) {
      canvasFilterSupport = false;
    } else {
      ctx.filter = 'brightness(50%)';
      canvasFilterSupport = ctx.filter === 'brightness(50%)';
    }
  } catch {
    canvasFilterSupport = false;
  }
  return canvasFilterSupport;
}
