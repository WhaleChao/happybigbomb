import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT_INDEX, LAYOUTS, createEmptyCell, remapCells } from './layouts';

describe('LAYOUTS', () => {
  it('預設版面是四格', () => {
    expect(LAYOUTS[DEFAULT_LAYOUT_INDEX].id).toBe('grid-4');
  });
  it('每個版面的格子剛好覆蓋整個格線、沒有重疊', () => {
    for (const l of LAYOUTS) {
      const seen = new Set<string>();
      for (const c of l.cells) {
        for (let r = c.row; r < c.row + c.rowSpan; r++) {
          for (let k = c.col; k < c.col + c.colSpan; k++) {
            const key = `${r},${k}`;
            expect(seen.has(key), `${l.id} 重疊於 ${key}`).toBe(false);
            seen.add(key);
          }
        }
      }
      expect(seen.size, l.id).toBe(l.rows * l.cols);
    }
  });
  it('id 不重複', () => {
    expect(new Set(LAYOUTS.map((l) => l.id)).size).toBe(LAYOUTS.length);
  });
});

describe('remapCells', () => {
  it('換成格數較少的版面時，回傳被移除的格子以便釋放記憶體', () => {
    const prev = Array.from({ length: 4 }, (_, i) => ({ ...createEmptyCell(), scale: 100 + i }));
    const { cells, dropped } = remapCells(prev, LAYOUTS.find((l) => l.id === 'cols-2')!);
    expect(cells.map((c) => c.scale)).toEqual([100, 101]);
    expect(dropped.map((c) => c.scale)).toEqual([102, 103]);
  });
  it('換成格數較多的版面時補上空白格子', () => {
    const { cells, dropped } = remapCells([createEmptyCell()], LAYOUTS.find((l) => l.id === 'grid-9')!);
    expect(cells).toHaveLength(9);
    expect(dropped).toHaveLength(0);
  });
});
