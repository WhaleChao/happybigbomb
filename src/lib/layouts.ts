import type { AspectRatioOption, CellState, LayoutCell, LayoutTemplate } from './types';
import { DEFAULT_FILTERS } from './filters';

const c = (row: number, col: number, rowSpan = 1, colSpan = 1): LayoutCell => ({ row, col, rowSpan, colSpan });

/** 均分格線：rows × cols */
function uniform(rows: number, cols: number): LayoutCell[] {
  const cells: LayoutCell[] = [];
  for (let r = 0; r < rows; r++) for (let col = 0; col < cols; col++) cells.push(c(r, col));
  return cells;
}

export const LAYOUTS: LayoutTemplate[] = [
  { id: 'cols-2', name: '左右兩格', rows: 1, cols: 2, cells: uniform(1, 2) },
  { id: 'rows-2', name: '上下兩格', rows: 2, cols: 1, cells: uniform(2, 1) },
  { id: 'cols-3', name: '三欄', rows: 1, cols: 3, cells: uniform(1, 3) },
  { id: 'rows-3', name: '三列', rows: 3, cols: 1, cells: uniform(3, 1) },
  { id: 'grid-4', name: '四格', rows: 2, cols: 2, cells: uniform(2, 2) },
  { id: 'top1-bottom2', name: '上一下二', rows: 2, cols: 2, cells: [c(0, 0, 1, 2), c(1, 0), c(1, 1)] },
  { id: 'top2-bottom1', name: '上二下一', rows: 2, cols: 2, cells: [c(0, 0), c(0, 1), c(1, 0, 1, 2)] },
  { id: 'left1-right2', name: '左一右二', rows: 2, cols: 2, cells: [c(0, 0, 2, 1), c(0, 1), c(1, 1)] },
  { id: 'left2-right1', name: '左二右一', rows: 2, cols: 2, cells: [c(0, 0), c(1, 0), c(0, 1, 2, 1)] },
  { id: 'top1-bottom3', name: '上一下三', rows: 2, cols: 3, cells: [c(0, 0, 1, 3), c(1, 0), c(1, 1), c(1, 2)] },
  { id: 'top3-bottom1', name: '上三下一', rows: 2, cols: 3, cells: [c(0, 0), c(0, 1), c(0, 2), c(1, 0, 1, 3)] },
  { id: 'grid-6', name: '六格', rows: 2, cols: 3, cells: uniform(2, 3) },
  { id: 'grid-9', name: '九宮格', rows: 3, cols: 3, cells: uniform(3, 3) },
];

/** 預設版面：四格（與舊版的預設行為相同） */
export const DEFAULT_LAYOUT_INDEX = LAYOUTS.findIndex((l) => l.id === 'grid-4');

export const ASPECT_RATIOS: AspectRatioOption[] = [
  { id: '9:16', label: '限時動態', w: 9, h: 16 },
  { id: '4:5', label: '貼文直式', w: 4, h: 5 },
  { id: '1:1', label: '正方形', w: 1, h: 1 },
  { id: '3:4', label: '直式經典', w: 3, h: 4 },
  { id: '4:3', label: '橫式經典', w: 4, h: 3 },
  { id: '16:9', label: '橫向寬螢幕', w: 16, h: 9 },
];

export function createEmptyCell(): CellState {
  return {
    media: null,
    filters: { ...DEFAULT_FILTERS },
    fit: 'cover',
    scale: 100,
    offsetX: 0,
    offsetY: 0,
  };
}

/**
 * 換版面時依序保留原本的格子內容。
 * 回傳新的格子陣列，以及因為新版面格數較少而被移除的格子（呼叫端負責釋放其資源）。
 */
export function remapCells(prev: CellState[], layout: LayoutTemplate): { cells: CellState[]; dropped: CellState[] } {
  const cells = layout.cells.map((_, i) => prev[i] ?? createEmptyCell());
  return { cells, dropped: prev.slice(layout.cells.length) };
}
