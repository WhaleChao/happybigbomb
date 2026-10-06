import type { AspectRatioOption, Fit, LayoutTemplate, Rect } from './types';

/**
 * 「畫布單位」：以畫布短邊的 1/360 為 1 單位。
 * 間距、圓角、模糊都用這個單位儲存，預覽與匯出各自換算成像素，
 * 因此不論螢幕大小或匯出解析度，成品都與預覽一致。
 */
export const UNIT_BASE = 360;

export function unitToPx(canvasWidth: number, canvasHeight: number): number {
  return Math.min(canvasWidth, canvasHeight) / UNIT_BASE;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** 依長邊計算輸出尺寸；even=true 時保證寬高為偶數（影片編碼需要） */
export function outputSize(aspect: AspectRatioOption, longEdge: number, even = false): { width: number; height: number } {
  let width: number;
  let height: number;
  if (aspect.w >= aspect.h) {
    width = longEdge;
    height = (longEdge * aspect.h) / aspect.w;
  } else {
    height = longEdge;
    width = (longEdge * aspect.w) / aspect.h;
  }
  width = Math.round(width);
  height = Math.round(height);
  if (even) {
    width -= width % 2;
    height -= height % 2;
  }
  return { width: Math.max(2, width), height: Math.max(2, height) };
}

/** 在可用空間內放入指定比例的最大矩形 */
export function fitAspect(availW: number, availH: number, aspect: AspectRatioOption): { width: number; height: number } {
  if (availW <= 0 || availH <= 0) return { width: 0, height: 0 };
  const ar = aspect.w / aspect.h;
  let width = availW;
  let height = width / ar;
  if (height > availH) {
    height = availH;
    width = height * ar;
  }
  return { width: Math.floor(width), height: Math.floor(height) };
}

/** 計算版面中每一格的位置（與 CSS grid 等寬軌道 + gap 的結果相同） */
export function computeCellRects(layout: LayoutTemplate, width: number, height: number, gapPx: number): Rect[] {
  const gap = Math.max(0, gapPx);
  const trackW = (width - gap * (layout.cols - 1)) / layout.cols;
  const trackH = (height - gap * (layout.rows - 1)) / layout.rows;
  return layout.cells.map((cell) => ({
    x: cell.col * (trackW + gap),
    y: cell.row * (trackH + gap),
    w: Math.max(0, cell.colSpan * trackW + (cell.colSpan - 1) * gap),
    h: Math.max(0, cell.rowSpan * trackH + (cell.rowSpan - 1) * gap),
  }));
}

/**
 * 計算媒體在格子內的繪製矩形（座標相對於格子左上角）。
 * fit：cover 填滿裁切／contain 完整顯示；scale 以格子中心縮放；
 * offsetX/offsetY 為格子寬高的比例。
 */
export function computeMediaRect(
  cellW: number,
  cellH: number,
  mediaW: number,
  mediaH: number,
  fit: Fit,
  scale: number,
  offsetX: number,
  offsetY: number,
): Rect {
  if (!(mediaW > 0) || !(mediaH > 0) || !(cellW > 0) || !(cellH > 0)) {
    return { x: 0, y: 0, w: cellW, h: cellH };
  }
  const cellAR = cellW / cellH;
  const mediaAR = mediaW / mediaH;
  let w: number;
  let h: number;
  const wider = mediaAR > cellAR;
  if ((fit === 'cover') === wider) {
    // cover 且媒體較寬，或 contain 且媒體較窄 → 以高度為準
    h = cellH;
    w = cellH * mediaAR;
  } else {
    w = cellW;
    h = cellW / mediaAR;
  }
  const s = scale / 100;
  w *= s;
  h *= s;
  return {
    x: (cellW - w) / 2 + offsetX * cellW,
    y: (cellH - h) / 2 + offsetY * cellH,
    w,
    h,
  };
}

/** 圓角不得超過格子短邊的一半 */
export function clampRadius(radiusPx: number, rect: Rect): number {
  return clamp(radiusPx, 0, Math.min(rect.w, rect.h) / 2);
}

export const SCALE_MIN = 50;
export const SCALE_MAX = 400;
/** 位移上限：避免把照片拖到完全看不見 */
export const OFFSET_LIMIT = 1.5;

export function clampScale(n: number): number {
  return clamp(Math.round(n), SCALE_MIN, SCALE_MAX);
}

export function clampOffset(n: number): number {
  return clamp(n, -OFFSET_LIMIT, OFFSET_LIMIT);
}
