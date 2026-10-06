import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, LayoutGrid, Lock, Monitor, Moon, SlidersHorizontal, Square, Sun, X } from 'lucide-react';
import CanvasEngine from './components/CanvasEngine';
import ComposePanel from './components/ComposePanel';
import EffectEditor from './components/EffectEditor';
import ExportDialog from './components/ExportDialog';
import { Seal } from './components/Glyphs';
import { FriendlyError, toFriendly } from './lib/errors';
import { ASPECT_RATIOS, DEFAULT_LAYOUT_INDEX, LAYOUTS, createEmptyCell, remapCells } from './lib/layouts';
import { loadMediaFile, releaseMedia } from './lib/media';
import { planPlacement } from './lib/placement';
import { useReducedMotion, useThemePreference, type ThemePref } from './lib/hooks';
import type { CellMedia, CellState, Composition } from './lib/types';
import './App.css';

type Tab = 'canvas' | 'compose' | 'adjust';

const THEME_LABEL: Record<ThemePref, string> = { system: '跟隨系統', light: '淺色', dark: '深色' };
const NEXT_THEME: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };

interface AppProps {
  embedded?: boolean;
  initialTheme?: ThemePref | null;
}

export default function App({ embedded = false, initialTheme = null }: AppProps) {
  const [layoutIndex, setLayoutIndex] = useState(DEFAULT_LAYOUT_INDEX);
  const [aspectIndex, setAspectIndex] = useState(0);
  const [cells, setCells] = useState<CellState[]>(() => LAYOUTS[DEFAULT_LAYOUT_INDEX].cells.map(createEmptyCell));
  const [gap, setGap] = useState(4);
  const [radius, setRadius] = useState(0);
  const [background, setBackground] = useState('#000000');
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState<ReadonlySet<number>>(() => new Set());
  const [tab, setTab] = useState<Tab>('canvas');
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const reducedMotion = useReducedMotion();
  const [theme, setTheme] = useThemePreference(initialTheme);

  // 以 ref 保存最新格子，讓非同步載入與卸載時能正確釋放資源（不在 state updater 中做副作用）
  const cellsRef = useRef(cells);
  const tokens = useRef<number[]>([]);

  const commitCells = useCallback((update: (prev: CellState[]) => CellState[]) => {
    const next = update(cellsRef.current);
    cellsRef.current = next;
    setCells(next);
  }, []);

  useEffect(
    () => () => {
      cellsRef.current.forEach((c) => releaseMedia(c.media));
    },
    [],
  );

  // 檔案拖到頁面其他地方時，避免瀏覽器直接開啟檔案而離開編輯器
  useEffect(() => {
    const prevent = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  const layout = LAYOUTS[layoutIndex];
  const aspect = ASPECT_RATIOS[aspectIndex];
  const comp: Composition = useMemo(
    () => ({ layout, aspect, cells, gap, radius, background }),
    [layout, aspect, cells, gap, radius, background],
  );
  const emptyCount = cells.filter((c) => !c.media).length;

  const setCellLoading = (index: number, on: boolean) =>
    setLoading((prev) => {
      const next = new Set(prev);
      if (on) next.add(index);
      else next.delete(index);
      return next;
    });

  const placeMedia = useCallback(
    (index: number, media: CellMedia) => {
      const current = cellsRef.current[index];
      if (!current) {
        releaseMedia(media);
        return;
      }
      // 換掉舊檔案時立即釋放舊的 object URL 與 GIF 影格
      releaseMedia(current.media);
      commitCells((prev) => prev.map((c, i) => (i === index ? { ...c, media, scale: 100, offsetX: 0, offsetY: 0 } : c)));
    },
    [commitCells],
  );

  const loadInto = useCallback(
    async (index: number, file: File) => {
      const token = (tokens.current[index] = (tokens.current[index] ?? 0) + 1);
      setCellLoading(index, true);
      try {
        const media = await loadMediaFile(file);
        if (tokens.current[index] !== token || index >= cellsRef.current.length) {
          // 期間已換了別的檔案或版面縮小，這份結果作廢
          releaseMedia(media);
          return;
        }
        placeMedia(index, media);
        setAnnouncement(`已將「${file.name}」放入第 ${index + 1} 格`);
      } catch (err) {
        setError(toFriendly(err, `「${file.name}」無法加入`));
      } finally {
        if (tokens.current[index] === token) setCellLoading(index, false);
      }
    },
    [placeMedia],
  );

  const placeFiles = useCallback(
    (files: File[], startIndex?: number) => {
      setError(null);
      const plan = planPlacement(
        cellsRef.current.map((c) => !!c.media),
        files.length,
        startIndex,
      );
      plan.targets.forEach((cellIndex, fileIndex) => void loadInto(cellIndex, files[fileIndex]));
      if (plan.overflow > 0) {
        setError(
          new FriendlyError(
            `有 ${plan.overflow} 個檔案沒有位置`,
            '目前的版面格子不夠。請先換成格數更多的版面（例如六格或九宮格），再把剩下的檔案加進來。',
          ),
        );
      }
      if (plan.targets.length) setSelected(plan.targets[0]);
    },
    [loadInto],
  );

  const onCellChange = useCallback(
    (index: number, patch: Partial<CellState>) => commitCells((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c))),
    [commitCells],
  );

  const clearCell = useCallback(
    (index: number) => {
      const cell = cellsRef.current[index];
      if (!cell?.media) return;
      tokens.current[index] = (tokens.current[index] ?? 0) + 1;
      releaseMedia(cell.media);
      commitCells((prev) => prev.map((c, i) => (i === index ? createEmptyCell() : c)));
      setAnnouncement(`已移除第 ${index + 1} 格的檔案`);
    },
    [commitCells],
  );

  const changeLayout = (index: number) => {
    const { cells: next, dropped } = remapCells(cellsRef.current, LAYOUTS[index]);
    dropped.forEach((c) => releaseMedia(c.media));
    tokens.current = tokens.current.slice(0, next.length);
    cellsRef.current = next;
    setCells(next);
    setLayoutIndex(index);
    if (selected !== null && selected >= next.length) setSelected(null);
    if (dropped.some((c) => c.media)) {
      setAnnouncement(`版面縮小，已移除第 ${next.length + 1} 格之後的檔案`);
    }
  };

  const resetCell = (index: number) =>
    commitCells((prev) => prev.map((c, i) => (i === index ? { ...createEmptyCell(), media: c.media } : c)));

  const resetCache = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } finally {
      window.location.reload();
    }
  };

  const selectedCell = selected !== null ? (cells[selected] ?? null) : null;
  const ThemeIcon = theme === 'system' ? Monitor : theme === 'light' ? Sun : Moon;

  return (
    <div className="app" data-tab={tab} data-embedded={embedded || undefined}>
      <a className="skip-link" href="#stage">
        跳到預覽畫布
      </a>
      <header className="topbar">
        <div className="brand">
          <Seal />
          <div className="brand-text">
            <h1 className="brand-name">小皮大霹靂</h1>
            <p className="brand-sub">照片組合編輯器</p>
          </div>
        </div>
        <p className="privacy">
          <Lock size={14} aria-hidden="true" />
          <span>照片只在你的瀏覽器處理，不會上傳</span>
        </p>
        <div className="topbar-actions">
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => setTheme(NEXT_THEME[theme])}
            aria-label={`切換深淺色，目前：${THEME_LABEL[theme]}`}
            title={`配色：${THEME_LABEL[theme]}`}
          >
            <ThemeIcon size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setExportOpen(true)}
            aria-label="匯出作品"
            aria-haspopup="dialog"
            disabled={exporting}
          >
            <Download size={18} aria-hidden="true" />
            <span>匯出</span>
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="panel panel-compose" aria-label="版面與畫布設定">
          <ComposePanel
            layoutIndex={layoutIndex}
            aspectIndex={aspectIndex}
            gap={gap}
            radius={radius}
            background={background}
            emptyCount={emptyCount}
            showCacheReset={!embedded}
            onLayout={changeLayout}
            onAspect={setAspectIndex}
            onGap={setGap}
            onRadius={setRadius}
            onBackground={setBackground}
            onFiles={(files) => placeFiles(files)}
            onResetCache={resetCache}
          />
        </aside>

        <main
          className="stage"
          id="stage"
          tabIndex={-1}
          aria-label="預覽"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) e.preventDefault();
          }}
          onDrop={(e) => {
            if (!e.dataTransfer.files?.length) return;
            e.preventDefault();
            placeFiles(Array.from(e.dataTransfer.files));
          }}
        >
          {error && (
            <div className="banner" role="alert">
              <div>
                <p className="banner-title">{error.title}</p>
                <p className="banner-hint">{error.hint}</p>
              </div>
              <button type="button" className="btn btn-icon" onClick={() => setError(null)} aria-label="關閉錯誤訊息">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          )}
          <CanvasEngine
            comp={comp}
            selected={selected}
            loading={loading}
            reducedMotion={reducedMotion}
            onSelect={setSelected}
            onCellChange={onCellChange}
            onCellFiles={(i, files) => placeFiles(files, i)}
            onClearCell={clearCell}
          />
          <p className="stage-caption">
            <span className="caption-ratio">{aspect.id}</span>
            <span>{layout.name}</span>
            <span aria-hidden="true">·</span>
            <span>
              {cells.length - emptyCount}／{cells.length} 格已放入
            </span>
          </p>
          <p className="stage-privacy">
            <Lock size={13} aria-hidden="true" />
            <span>照片只在你的瀏覽器處理，不會上傳</span>
          </p>
        </main>

        <div className="panel-switch segmented" role="tablist" aria-label="設定面板">
          <button
            type="button"
            role="tab"
            aria-selected={tab !== 'adjust'}
            className={tab !== 'adjust' ? 'is-active' : ''}
            onClick={() => setTab('compose')}
          >
            版面
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'adjust'}
            className={tab === 'adjust' ? 'is-active' : ''}
            onClick={() => setTab('adjust')}
          >
            調整{selected !== null ? `・第 ${selected + 1} 格` : ''}
          </button>
        </div>

        <aside className="panel panel-adjust" aria-label="格子調整">
          <EffectEditor
            index={selectedCell ? selected : null}
            cell={selectedCell}
            cellCount={cells.length}
            onChange={(patch) => selected !== null && onCellChange(selected, patch)}
            onReset={() => selected !== null && resetCell(selected)}
            onClear={() => selected !== null && clearCell(selected)}
            onReplace={(files) => selected !== null && placeFiles(files, selected)}
          />
        </aside>
      </div>

      <nav className="tabbar" aria-label="切換檢視">
        {(
          [
            { id: 'canvas', label: '畫布', Icon: Square },
            { id: 'compose', label: '版面', Icon: LayoutGrid },
            { id: 'adjust', label: '調整', Icon: SlidersHorizontal },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'is-active' : ''}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <ExportDialog open={exportOpen} comp={comp} onClose={() => setExportOpen(false)} onBusyChange={setExporting} />
    </div>
  );
}
