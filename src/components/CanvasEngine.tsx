import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, DragEvent, KeyboardEvent, PointerEvent } from 'react';
import { ImagePlus, LoaderCircle } from 'lucide-react';
import { filterToCss } from '../lib/filters';
import {
  clampOffset,
  clampRadius,
  clampScale,
  computeCellRects,
  computeMediaRect,
  fitAspect,
  unitToPx,
} from '../lib/geometry';
import { ACCEPT } from '../lib/media';
import type { CellState, Composition, GifFrame, Rect } from '../lib/types';

interface CanvasEngineProps {
  comp: Composition;
  selected: number | null;
  loading: ReadonlySet<number>;
  reducedMotion: boolean;
  onSelect: (index: number | null) => void;
  onCellChange: (index: number, patch: Partial<CellState>) => void;
  onCellFiles: (index: number, files: File[]) => void;
  onClearCell: (index: number) => void;
}

interface Gesture {
  index: number;
  pointers: Map<number, { x: number; y: number }>;
  startX: number;
  startY: number;
  startOffsetX: number;
  startOffsetY: number;
  startScale: number;
  startDist: number | null;
  moved: boolean;
}

/** 依背景亮度決定空白格子的文字色，深底用淺字、淺底用深字 */
function toneFor(hex: string): 'light' | 'dark' {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 'light';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? 'dark' : 'light';
}

const KIND_LABEL = { image: '照片', video: '影片', gif: 'GIF 動圖' } as const;

function centroid(points: Map<number, { x: number; y: number }>): { x: number; y: number } {
  let x = 0;
  let y = 0;
  points.forEach((p) => {
    x += p.x;
    y += p.y;
  });
  const n = Math.max(1, points.size);
  return { x: x / n, y: y / n };
}

function pinchDistance(points: Map<number, { x: number; y: number }>): number | null {
  if (points.size < 2) return null;
  const [a, b] = Array.from(points.values());
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 減少動態效果時，GIF 只顯示第一張影格 */
function GifStill({ frame, style }: { frame: GifFrame; style: CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = frame.canvas.width;
    c.height = frame.canvas.height;
    c.getContext('2d')?.drawImage(frame.canvas, 0, 0);
  }, [frame]);
  return <canvas ref={ref} className="cell-media" style={style} aria-hidden="true" />;
}

interface CellHandlers {
  pointerDown: (i: number, e: PointerEvent<HTMLDivElement>) => void;
  pointerMove: (i: number, e: PointerEvent<HTMLDivElement>) => void;
  pointerUp: (i: number, e: PointerEvent<HTMLDivElement>) => void;
  keyDown: (i: number, e: KeyboardEvent<HTMLDivElement>) => void;
  focus: (i: number) => void;
  drop: (i: number, e: DragEvent<HTMLDivElement>) => void;
  click: (i: number) => void;
}

interface CellViewProps {
  index: number;
  rect: Rect;
  radius: number;
  unit: number;
  cell: CellState;
  isSelected: boolean;
  isLoading: boolean;
  isDragging: boolean;
  reducedMotion: boolean;
  tone: 'light' | 'dark';
  handlers: CellHandlers;
}

const CellView = memo(function CellView({
  index,
  rect,
  radius,
  unit,
  cell,
  isSelected,
  isLoading,
  isDragging,
  reducedMotion,
  tone,
  handlers,
}: CellViewProps) {
  const [dropOver, setDropOver] = useState(false);
  const media = cell.media;
  const m = media
    ? computeMediaRect(rect.w, rect.h, media.width, media.height, cell.fit, cell.scale, cell.offsetX, cell.offsetY)
    : null;
  const mediaStyle: CSSProperties | undefined = m
    ? {
        left: m.x,
        top: m.y,
        width: m.w,
        height: m.h,
        filter: filterToCss(cell.filters, cell.filters.blur * unit),
      }
    : undefined;

  const label = media
    ? `第 ${index + 1} 格，${KIND_LABEL[media.kind]}「${media.name}」。拖曳可移動位置，方向鍵微調，加號與減號縮放，Delete 移除。`
    : `第 ${index + 1} 格，空白。按 Enter 加入照片或影片。`;

  return (
    <div
      className={[
        'cell',
        media ? 'has-media' : 'is-empty',
        isSelected ? 'is-selected' : '',
        isDragging ? 'is-dragging' : '',
        dropOver ? 'is-drop' : '',
        `tone-${tone}`,
      ].join(' ')}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: radius }}
      data-cell-index={index}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={isSelected}
      aria-busy={isLoading || undefined}
      onPointerDown={(e) => handlers.pointerDown(index, e)}
      onPointerMove={(e) => handlers.pointerMove(index, e)}
      onPointerUp={(e) => handlers.pointerUp(index, e)}
      onPointerCancel={(e) => handlers.pointerUp(index, e)}
      onKeyDown={(e) => handlers.keyDown(index, e)}
      onFocus={() => handlers.focus(index)}
      onClick={() => handlers.click(index)}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        setDropOver(true);
      }}
      onDragLeave={() => setDropOver(false)}
      onDrop={(e) => {
        setDropOver(false);
        handlers.drop(index, e);
      }}
    >
      {media && mediaStyle ? (
        media.kind === 'video' ? (
          <video
            key={media.url}
            className="cell-media"
            src={media.url}
            style={mediaStyle}
            autoPlay={!reducedMotion}
            loop
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            aria-hidden="true"
          />
        ) : media.kind === 'gif' && reducedMotion && media.gifFrames?.[0] ? (
          <GifStill frame={media.gifFrames[0]} style={mediaStyle} />
        ) : (
          <img className="cell-media" src={media.url} style={mediaStyle} alt="" draggable={false} decoding="async" />
        )
      ) : (
        <span className="cell-empty" aria-hidden="true">
          <ImagePlus size={Math.max(18, Math.min(28, rect.w / 6))} strokeWidth={1.6} />
          {rect.w > 84 && <span>加入照片</span>}
        </span>
      )}
      {isLoading && (
        <span className="cell-loading" aria-hidden="true">
          <LoaderCircle size={22} className="spin" />
          <span>讀取中</span>
        </span>
      )}
      <span className="cell-index" aria-hidden="true">
        {index + 1}
      </span>
    </div>
  );
});

/** 預覽畫布：負責量測、繪製格子、拖曳／縮放手勢與鍵盤操作 */
export default function CanvasEngine({
  comp,
  selected,
  loading,
  reducedMotion,
  onSelect,
  onCellChange,
  onCellFiles,
  onClearCell,
}: CanvasEngineProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickTarget = useRef<number>(0);
  const [avail, setAvail] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      setAvail((prev) => (Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5 ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { width, height } = fitAspect(avail.w, avail.h, comp.aspect);
  const unit = unitToPx(width, height);
  const rects = computeCellRects(comp.layout, width, height, comp.gap * unit);
  const tone = toneFor(comp.background);

  // 讓事件處理函式永遠讀到最新值，同時保持參照穩定（避免格子全部重繪）
  const latest = useRef({ comp, rects, onSelect, onCellChange, onCellFiles, onClearCell });
  useLayoutEffect(() => {
    latest.current = { comp, rects, onSelect, onCellChange, onCellFiles, onClearCell };
  });

  const gesture = useRef<Gesture | null>(null);
  const pending = useRef<{ index: number; patch: Partial<CellState> } | null>(null);
  const raf = useRef(0);

  const flush = useCallback(() => {
    raf.current = 0;
    const p = pending.current;
    pending.current = null;
    if (p) latest.current.onCellChange(p.index, p.patch);
  }, []);

  // 手勢更新以 requestAnimationFrame 合併，每個畫面最多更新一次
  const queue = useCallback(
    (index: number, patch: Partial<CellState>) => {
      if (pending.current && pending.current.index === index) Object.assign(pending.current.patch, patch);
      else {
        if (pending.current) flush();
        pending.current = { index, patch: { ...patch } };
      }
      if (!raf.current) raf.current = requestAnimationFrame(flush);
    },
    [flush],
  );

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const openPicker = useCallback((index: number) => {
    pickTarget.current = index;
    inputRef.current?.click();
  }, []);

  const [handlers] = useState<CellHandlers>(() => {
    const rebase = (g: Gesture) => {
      const cell = latest.current.comp.cells[g.index];
      const pendingPatch = pending.current?.index === g.index ? pending.current.patch : {};
      const c = centroid(g.pointers);
      g.startX = c.x;
      g.startY = c.y;
      g.startOffsetX = pendingPatch.offsetX ?? cell.offsetX;
      g.startOffsetY = pendingPatch.offsetY ?? cell.offsetY;
      g.startScale = pendingPatch.scale ?? cell.scale;
      g.startDist = pinchDistance(g.pointers);
    };

    return {
      pointerDown(i, e) {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        const cell = latest.current.comp.cells[i];
        if (!cell?.media) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        let g = gesture.current;
        if (!g || g.index !== i) {
          g = {
            index: i,
            pointers: new Map(),
            startX: 0,
            startY: 0,
            startOffsetX: 0,
            startOffsetY: 0,
            startScale: 100,
            startDist: null,
            moved: false,
          };
          gesture.current = g;
        }
        g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        rebase(g);
      },
      pointerMove(i, e) {
        const g = gesture.current;
        if (!g || g.index !== i || !g.pointers.has(e.pointerId)) return;
        g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const c = centroid(g.pointers);
        const dx = c.x - g.startX;
        const dy = c.y - g.startY;
        if (!g.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3 || g.pointers.size > 1)) {
          g.moved = true;
          setDragging(i);
        }
        if (!g.moved) return;
        const rect = latest.current.rects[i];
        if (!rect || rect.w <= 0 || rect.h <= 0) return;
        const patch: Partial<CellState> = {
          offsetX: clampOffset(g.startOffsetX + dx / rect.w),
          offsetY: clampOffset(g.startOffsetY + dy / rect.h),
        };
        const dist = pinchDistance(g.pointers);
        if (dist && g.startDist) patch.scale = clampScale((g.startScale * dist) / g.startDist);
        queue(i, patch);
      },
      pointerUp(i, e) {
        const g = gesture.current;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        if (!g || g.index !== i) return;
        g.pointers.delete(e.pointerId);
        if (g.pointers.size === 0) {
          gesture.current = null;
          setDragging(null);
        } else {
          // 剩下的手指重新當作起點，避免畫面跳動
          rebase(g);
        }
      },
      keyDown(i, e) {
        const { comp: cur, onCellChange: change, onClearCell: clear, onSelect: select } = latest.current;
        const cell = cur.cells[i];
        if (!cell) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!cell.media) openPicker(i);
          else select(i);
          return;
        }
        if (e.key === 'Escape') {
          select(null);
          e.currentTarget.blur();
          return;
        }
        if (!cell.media) return;
        const step = e.shiftKey ? 0.05 : 0.01;
        switch (e.key) {
          case 'ArrowLeft':
            change(i, { offsetX: clampOffset(cell.offsetX - step) });
            break;
          case 'ArrowRight':
            change(i, { offsetX: clampOffset(cell.offsetX + step) });
            break;
          case 'ArrowUp':
            change(i, { offsetY: clampOffset(cell.offsetY - step) });
            break;
          case 'ArrowDown':
            change(i, { offsetY: clampOffset(cell.offsetY + step) });
            break;
          case '+':
          case '=':
            change(i, { scale: clampScale(cell.scale + (e.shiftKey ? 20 : 5)) });
            break;
          case '-':
          case '_':
            change(i, { scale: clampScale(cell.scale - (e.shiftKey ? 20 : 5)) });
            break;
          case 'Delete':
          case 'Backspace':
            clear(i);
            break;
          default:
            return;
        }
        e.preventDefault();
      },
      focus(i) {
        latest.current.onSelect(i);
      },
      click(i) {
        const cell = latest.current.comp.cells[i];
        latest.current.onSelect(i);
        if (cell && !cell.media) openPicker(i);
      },
      drop(i, e) {
        if (!e.dataTransfer.files?.length) return;
        e.preventDefault();
        e.stopPropagation();
        latest.current.onSelect(i);
        latest.current.onCellFiles(i, Array.from(e.dataTransfer.files));
      },
    };
  });

  // 觸控板雙指縮放（瀏覽器以 ctrl + wheel 送出）；需要非被動監聽才能阻止整頁縮放
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-cell-index]');
      if (!target) return;
      const i = Number(target.dataset.cellIndex);
      const cell = latest.current.comp.cells[i];
      if (!cell?.media) return;
      e.preventDefault();
      const pendingScale = pending.current?.index === i ? pending.current.patch.scale : undefined;
      const base = pendingScale ?? cell.scale;
      queue(i, { scale: clampScale(base * Math.exp(-e.deltaY / 200)) });
    };
    board.addEventListener('wheel', onWheel, { passive: false });
    return () => board.removeEventListener('wheel', onWheel);
  }, [queue]);

  const radius = comp.radius * unit;

  return (
    <div className="stage-viewport" ref={stageRef}>
      <div
        ref={boardRef}
        className="board"
        style={{ width, height, backgroundColor: comp.background }}
        role="group"
        aria-label={`預覽畫布，${comp.aspect.id}，${comp.layout.name}，共 ${comp.layout.cells.length} 格`}
      >
        {width > 0 &&
          rects.map((rect, i) => (
            <CellView
              key={i}
              index={i}
              rect={rect}
              radius={clampRadius(radius, rect)}
              unit={unit}
              cell={comp.cells[i]}
              isSelected={selected === i}
              isLoading={loading.has(i)}
              isDragging={dragging === i}
              reducedMotion={reducedMotion}
              tone={tone}
              handlers={handlers}
            />
          ))}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        tabIndex={-1}
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = '';
          if (files.length) latest.current.onCellFiles(pickTarget.current, files);
        }}
      />
    </div>
  );
}
