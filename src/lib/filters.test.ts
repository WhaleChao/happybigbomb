import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, PRESETS, applyFiltersToPixels, filterToCss, filtersEqual, isDefaultFilters } from './filters';

describe('filterToCss', () => {
  it('預設值不加任何濾鏡（避免多餘的重新取樣）', () => {
    expect(filterToCss(DEFAULT_FILTERS)).toBe('none');
  });
  it('依 CSS 規格順序輸出，並使用換算後的模糊像素', () => {
    const css = filterToCss({ ...DEFAULT_FILTERS, brightness: 120, blur: 2 }, 6);
    expect(css).toBe('brightness(120%) contrast(100%) saturate(100%) blur(6px) grayscale(0%) sepia(0%)');
  });
  it('模糊為 0 時不輸出 blur()', () => {
    expect(filterToCss({ ...DEFAULT_FILTERS, sepia: 30 })).not.toContain('blur');
  });
});

describe('預設風格', () => {
  it('「原始」等同預設值，其他都不同', () => {
    expect(isDefaultFilters(PRESETS[0].filters)).toBe(true);
    expect(PRESETS.slice(1).every((p) => !filtersEqual(p.filters, DEFAULT_FILTERS))).toBe(true);
  });
});

describe('applyFiltersToPixels（不支援 canvas 濾鏡時的備援）', () => {
  const px = (...rgb: number[]) => new Uint8ClampedArray([...rgb, 255]);

  it('預設值不改動像素', () => {
    const d = px(10, 120, 250);
    applyFiltersToPixels(d, DEFAULT_FILTERS);
    expect(Array.from(d)).toEqual([10, 120, 250, 255]);
  });
  it('亮度 50% 讓數值減半', () => {
    const d = px(200, 100, 50);
    applyFiltersToPixels(d, { ...DEFAULT_FILTERS, brightness: 50 });
    expect(Array.from(d)).toEqual([100, 50, 25, 255]);
  });
  it('灰階 100% 讓 RGB 相等', () => {
    const d = px(255, 0, 0);
    applyFiltersToPixels(d, { ...DEFAULT_FILTERS, grayscale: 100 });
    expect(d[0]).toBe(d[1]);
    expect(d[1]).toBe(d[2]);
    expect(d[0]).toBe(54); // 0.2126 × 255
  });
  it('對比 0% 讓所有顏色變成中灰', () => {
    const d = px(0, 255, 30);
    applyFiltersToPixels(d, { ...DEFAULT_FILTERS, contrast: 0 });
    expect(Array.from(d.slice(0, 3))).toEqual([128, 128, 128]);
  });
  it('不改動透明度', () => {
    const d = new Uint8ClampedArray([100, 100, 100, 77]);
    applyFiltersToPixels(d, { ...DEFAULT_FILTERS, sepia: 100 });
    expect(d[3]).toBe(77);
  });
});
