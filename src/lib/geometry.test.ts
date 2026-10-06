import { describe, expect, it } from 'vitest';
import { clampOffset, clampRadius, clampScale, computeCellRects, computeMediaRect, fitAspect, outputSize, unitToPx } from './geometry';
import { ASPECT_RATIOS, LAYOUTS } from './layouts';

const aspect = (id: string) => ASPECT_RATIOS.find((a) => a.id === id)!;
const layout = (id: string) => LAYOUTS.find((l) => l.id === id)!;

describe('outputSize', () => {
  it('直式以高為長邊', () => {
    expect(outputSize(aspect('9:16'), 1920)).toEqual({ width: 1080, height: 1920 });
  });
  it('橫式以寬為長邊', () => {
    expect(outputSize(aspect('16:9'), 1920)).toEqual({ width: 1920, height: 1080 });
  });
  it('影片模式保證偶數尺寸', () => {
    const { width, height } = outputSize(aspect('4:5'), 1281, true);
    expect(width % 2).toBe(0);
    expect(height % 2).toBe(0);
  });
});

describe('fitAspect', () => {
  it('在寬鬆空間中以高度為限', () => {
    expect(fitAspect(1000, 800, aspect('9:16'))).toEqual({ width: 450, height: 800 });
  });
  it('在窄空間中以寬度為限', () => {
    expect(fitAspect(360, 2000, aspect('1:1'))).toEqual({ width: 360, height: 360 });
  });
  it('空間為 0 時回傳 0', () => {
    expect(fitAspect(0, 100, aspect('1:1'))).toEqual({ width: 0, height: 0 });
  });
});

describe('computeCellRects', () => {
  it('四格加間距：各格大小一致且不重疊', () => {
    const rects = computeCellRects(layout('grid-4'), 210, 410, 10);
    expect(rects).toEqual([
      { x: 0, y: 0, w: 100, h: 200 },
      { x: 110, y: 0, w: 100, h: 200 },
      { x: 0, y: 210, w: 100, h: 200 },
      { x: 110, y: 210, w: 100, h: 200 },
    ]);
  });
  it('跨欄格子包含中間的間距', () => {
    const [top] = computeCellRects(layout('top1-bottom3'), 320, 200, 10);
    expect(top).toEqual({ x: 0, y: 0, w: 320, h: 95 });
  });
  it('每個版面的格子都剛好鋪滿畫布', () => {
    for (const l of LAYOUTS) {
      const rects = computeCellRects(l, 900, 1600, 0);
      const area = rects.reduce((s, r) => s + r.w * r.h, 0);
      expect(area).toBeCloseTo(900 * 1600, 3);
    }
  });
});

describe('computeMediaRect', () => {
  it('cover：較寬的照片以高度填滿並置中裁切', () => {
    expect(computeMediaRect(100, 100, 200, 100, 'cover', 100, 0, 0)).toEqual({ x: -50, y: 0, w: 200, h: 100 });
  });
  it('contain：較寬的照片以寬度完整顯示', () => {
    expect(computeMediaRect(100, 100, 200, 100, 'contain', 100, 0, 0)).toEqual({ x: 0, y: 25, w: 100, h: 50 });
  });
  it('縮放以格子中心為準，位移以格子比例計算', () => {
    const r = computeMediaRect(100, 200, 100, 200, 'cover', 200, 0.1, -0.25);
    expect(r).toEqual({ x: -50 + 10, y: -100 - 50, w: 200, h: 400 });
  });
  it('預覽與匯出等比例：放大 3 倍時所有數值也放大 3 倍', () => {
    const a = computeMediaRect(120, 90, 4000, 3000, 'cover', 135, 0.2, 0.1);
    const b = computeMediaRect(360, 270, 4000, 3000, 'cover', 135, 0.2, 0.1);
    expect(b.x).toBeCloseTo(a.x * 3);
    expect(b.y).toBeCloseTo(a.y * 3);
    expect(b.w).toBeCloseTo(a.w * 3);
    expect(b.h).toBeCloseTo(a.h * 3);
  });
  it('媒體尺寸未知時回傳整格', () => {
    expect(computeMediaRect(50, 60, 0, 0, 'cover', 100, 0, 0)).toEqual({ x: 0, y: 0, w: 50, h: 60 });
  });
});

describe('其他工具', () => {
  it('畫布單位以短邊 / 360 計算', () => {
    expect(unitToPx(1080, 1920)).toBe(3);
  });
  it('圓角不超過短邊一半', () => {
    expect(clampRadius(500, { x: 0, y: 0, w: 40, h: 100 })).toBe(20);
  });
  it('縮放與位移有上下限', () => {
    expect(clampScale(10)).toBe(50);
    expect(clampScale(9999)).toBe(400);
    expect(clampOffset(5)).toBe(1.5);
    expect(clampOffset(-5)).toBe(-1.5);
  });
});
