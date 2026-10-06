import { describe, expect, it } from 'vitest';
import { planPlacement } from './placement';

describe('planPlacement', () => {
  it('依序填入空白格子', () => {
    expect(planPlacement([true, false, true, false], 2)).toEqual({ targets: [1, 3], overflow: 0 });
  });
  it('檔案比空格多時回報放不下的數量', () => {
    expect(planPlacement([false, true, false], 4)).toEqual({ targets: [0, 2], overflow: 2 });
  });
  it('全部都滿時從第 1 格開始替換', () => {
    expect(planPlacement([true, true, true], 2)).toEqual({ targets: [0, 1], overflow: 0 });
  });
  it('指定起始格：先替換該格，再往後找空格並繞回開頭', () => {
    expect(planPlacement([false, true, true, false], 3, 2)).toEqual({ targets: [2, 3, 0], overflow: 0 });
  });
  it('沒有格子時全部放不下', () => {
    expect(planPlacement([], 2)).toEqual({ targets: [], overflow: 2 });
  });
});
