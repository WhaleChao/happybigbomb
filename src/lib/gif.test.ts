import { describe, expect, it } from 'vitest';
import { gifFrameIndexAt, gifKeepStep, normalizeGifDelay } from './gif';

describe('normalizeGifDelay', () => {
  it('0 或過小的延遲依瀏覽器行為視為 100ms', () => {
    expect(normalizeGifDelay(0)).toBe(100);
    expect(normalizeGifDelay(10)).toBe(100);
    expect(normalizeGifDelay(NaN)).toBe(100);
  });
  it('正常延遲保持不變', () => {
    expect(normalizeGifDelay(40)).toBe(40);
  });
});

describe('gifFrameIndexAt', () => {
  const delays = [100, 200, 100];
  it('依累積時間找影格', () => {
    expect(gifFrameIndexAt(delays, 0)).toBe(0);
    expect(gifFrameIndexAt(delays, 99)).toBe(0);
    expect(gifFrameIndexAt(delays, 100)).toBe(1);
    expect(gifFrameIndexAt(delays, 299)).toBe(1);
    expect(gifFrameIndexAt(delays, 300)).toBe(2);
  });
  it('超過總長度時循環', () => {
    expect(gifFrameIndexAt(delays, 400)).toBe(0);
    expect(gifFrameIndexAt(delays, 150 + 400 * 3)).toBe(1);
  });
  it('沒有影格時回傳 0', () => {
    expect(gifFrameIndexAt([], 500)).toBe(0);
  });
});

describe('gifKeepStep', () => {
  it('在預算內全部保留', () => {
    expect(gifKeepStep(100, 100, 100)).toBe(1);
  });
  it('超過預算時每隔幾張保留一張', () => {
    // 每張 4MB，預算 40MB → 最多 10 張；50 張需每 5 張留 1 張
    expect(gifKeepStep(50, 1000, 1000, 40 * 1000 * 1000)).toBe(5);
  });
});
