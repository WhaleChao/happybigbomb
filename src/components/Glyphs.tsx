import type { AspectRatioOption, LayoutTemplate } from '../lib/types';
import { computeCellRects } from '../lib/geometry';

/** 以實際版面資料畫出的縮圖，與成品完全一致 */
export function LayoutGlyph({ layout, size = 40 }: { layout: LayoutTemplate; size?: number }) {
  const w = size * 0.72;
  const h = size;
  const rects = computeCellRects(layout, w, h, 2);
  return (
    <svg className="glyph" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false">
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={1.5} />
      ))}
    </svg>
  );
}

export function RatioGlyph({ aspect, size = 28 }: { aspect: AspectRatioOption; size?: number }) {
  const s = size / Math.max(aspect.w, aspect.h);
  const w = aspect.w * s;
  const h = aspect.h * s;
  return (
    <svg className="glyph glyph-ratio" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
      <rect x={(size - w) / 2 + 0.75} y={(size - h) / 2 + 0.75} width={w - 1.5} height={h - 1.5} rx={2} />
    </svg>
  );
}

/** 品牌印記：朱紅方印 */
export function Seal() {
  return (
    <span className="seal" aria-hidden="true">
      霹
    </span>
  );
}
