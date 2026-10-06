export type MediaKind = 'image' | 'video' | 'gif';
export type Fit = 'cover' | 'contain';

export interface Filters {
  brightness: number;
  contrast: number;
  saturate: number;
  /** 以「畫布單位」計算的模糊半徑；預覽與匯出依各自尺寸換算成像素 */
  blur: number;
  grayscale: number;
  sepia: number;
}

export interface GifFrame {
  canvas: HTMLCanvasElement;
  /** 毫秒 */
  delay: number;
}

export interface CellMedia {
  kind: MediaKind;
  /** 原始檔案的 object URL（只存在瀏覽器記憶體內） */
  url: string;
  /** 小縮圖，用於風格預設預覽；可能為 null */
  thumbUrl: string | null;
  name: string;
  width: number;
  height: number;
  /** 秒；靜態照片為 0 */
  duration: number;
  gifFrames?: GifFrame[];
}

export interface CellState {
  media: CellMedia | null;
  filters: Filters;
  fit: Fit;
  /** 百分比，100 為原始填滿 */
  scale: number;
  /** 相對於格子寬度的位移比例 */
  offsetX: number;
  /** 相對於格子高度的位移比例 */
  offsetY: number;
}

export interface LayoutCell {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

export interface LayoutTemplate {
  id: string;
  name: string;
  rows: number;
  cols: number;
  cells: LayoutCell[];
}

export interface AspectRatioOption {
  id: string;
  label: string;
  w: number;
  h: number;
}

export interface Composition {
  layout: LayoutTemplate;
  aspect: AspectRatioOption;
  cells: CellState[];
  /** 間距（畫布單位） */
  gap: number;
  /** 圓角（畫布單位） */
  radius: number;
  background: string;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
