import { useState, useRef, useCallback } from 'react';
import { Download, Grid, RotateCcw, Sun, Contrast, Droplets, Image as ImageIcon, RectangleHorizontal, RectangleVertical, Square, Smartphone, Palette, Trash2, Film } from 'lucide-react';
import './App.css';

// --- Aspect Ratio Options ---
interface AspectRatioOption {
  name: string;
  label: string;
  ratio: string; // CSS aspect-ratio value
  w: number;
  h: number;
}

const ASPECT_RATIOS: AspectRatioOption[] = [
  { name: '9:16', label: 'IG 限動（直）', ratio: '9 / 16', w: 9, h: 16 },
  { name: '16:9', label: '橫向寬屏', ratio: '16 / 9', w: 16, h: 9 },
  { name: '4:5', label: 'IG 貼文', ratio: '4 / 5', w: 4, h: 5 },
  { name: '1:1', label: '正方形', ratio: '1 / 1', w: 1, h: 1 },
  { name: '3:4', label: '直式經典', ratio: '3 / 4', w: 3, h: 4 },
  { name: '4:3', label: '橫式經典', ratio: '4 / 3', w: 4, h: 3 },
];

// --- Types ---
interface CellData {
  id: number;
  imageUrl: string | null;
  objectUrl: string | null;
  mediaType: 'image' | 'video' | 'gif';
  duration: number; // seconds, 0 for static images
  filters: {
    brightness: number;
    contrast: number;
    saturate: number;
    blur: number;
    grayscale: number;
    sepia: number;
  };
  objectFit: 'cover' | 'contain';
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface LayoutTemplate {
  name: string;
  icon: string;
  rows: number;
  cols: number;
  cells: { row: number; col: number; rowSpan: number; colSpan: number }[];
}

const LAYOUTS: LayoutTemplate[] = [
  // === 2 格 ===
  {
    name: '2 直排', icon: '▮▮', rows: 1, cols: 2,
    cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
    ],
  },
  {
    name: '2 橫排', icon: '▬▬', rows: 2, cols: 1,
    cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
    ],
  },
  // === 3 格 ===
  {
    name: '3 直排', icon: '▮▮▮', rows: 1, cols: 3,
    cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
    ],
  },
  {
    name: '3 橫排', icon: '▬▬▬', rows: 3, cols: 1,
    cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
    ],
  },
  // === 4 格 ===
  {
    name: '4 格', icon: '⊞', rows: 2, cols: 2,
    cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
    ],
  },
  // === 混合型 ===
  {
    name: '上1下2', icon: '▬+▮▮', rows: 2, cols: 2,
    cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
    ],
  },
  {
    name: '上2下1', icon: '▮▮+▬', rows: 2, cols: 2,
    cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 2 },
    ],
  },
  {
    name: '左1右2', icon: '▮+▮▮', rows: 2, cols: 2,
    cells: [
      { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
    ],
  },
  {
    name: '左2右1', icon: '▮▮+▮', rows: 2, cols: 2,
    cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 2, colSpan: 1 },
    ],
  },
  // === 大型混合 ===
  {
    name: '上1下3', icon: '▬+▮▮▮', rows: 2, cols: 3,
    cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 3 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
    ],
  },
  {
    name: '上3下1', icon: '▮▮▮+▬', rows: 2, cols: 3,
    cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 3 },
    ],
  },
  {
    name: '6 格', icon: '⊞⊞', rows: 2, cols: 3,
    cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
    ],
  },
  {
    name: '9 格', icon: '⊞⊞⊞', rows: 3, cols: 3,
    cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 2, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 2, col: 2, rowSpan: 1, colSpan: 1 },
    ],
  },
];


const DEFAULT_FILTERS = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  blur: 0,
  grayscale: 0,
  sepia: 0,
};

function createCells(layout: LayoutTemplate): CellData[] {
  return layout.cells.map((_, i) => ({
    id: i,
    imageUrl: null,
    objectUrl: null,
    mediaType: 'image' as const,
    duration: 0,
    filters: { ...DEFAULT_FILTERS },
    objectFit: 'cover' as const,
    scale: 100,
    offsetX: 0,
    offsetY: 0,
  }));
}

// --- Preset Filters ---
const PRESETS = [
  { name: '原始', filters: { brightness: 100, contrast: 100, saturate: 100, blur: 0, grayscale: 0, sepia: 0 } },
  { name: '暖色', filters: { brightness: 105, contrast: 105, saturate: 130, blur: 0, grayscale: 0, sepia: 20 } },
  { name: '冷色', filters: { brightness: 100, contrast: 110, saturate: 80, blur: 0, grayscale: 0, sepia: 0 } },
  { name: '復古', filters: { brightness: 95, contrast: 90, saturate: 70, blur: 0, grayscale: 0, sepia: 50 } },
  { name: '黑白', filters: { brightness: 110, contrast: 120, saturate: 0, blur: 0, grayscale: 100, sepia: 0 } },
  { name: '高對比', filters: { brightness: 110, contrast: 150, saturate: 120, blur: 0, grayscale: 0, sepia: 0 } },
  { name: '柔焦', filters: { brightness: 105, contrast: 95, saturate: 90, blur: 1, grayscale: 0, sepia: 0 } },
  { name: '戲劇', filters: { brightness: 90, contrast: 140, saturate: 110, blur: 0, grayscale: 0, sepia: 10 } },
];

function getFilterString(f: CellData['filters']): string {
  return `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) blur(${f.blur}px) grayscale(${f.grayscale}%) sepia(${f.sepia}%)`;
}

// --- Main App ---
function App() {
  const [layoutIndex, setLayoutIndex] = useState(2); // Default: 4-grid
  const [cells, setCells] = useState<CellData[]>(createCells(LAYOUTS[2]));
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [gap, setGap] = useState(4);
  const [borderRadius, setBorderRadius] = useState(0);
  const [bgColor, setBgColor] = useState('#000000');
  const [aspectRatioIndex, setAspectRatioIndex] = useState(0); // 9:16 default
  const gridRef = useRef<HTMLDivElement>(null);

  const currentAspectRatio = ASPECT_RATIOS[aspectRatioIndex];
  const isLandscape = currentAspectRatio.w > currentAspectRatio.h;

  const layout = LAYOUTS[layoutIndex];

  const changeLayout = (index: number) => {
    const newLayout = LAYOUTS[index];
    const newCells = createCells(newLayout);

    // Carry over existing images & filters to new cells (by position)
    const minLen = Math.min(cells.length, newCells.length);
    for (let i = 0; i < minLen; i++) {
      newCells[i] = { ...newCells[i], ...cells[i], id: i };
    }

    // Revoke object URLs for cells that won't carry over
    for (let i = minLen; i < cells.length; i++) {
      if (cells[i].objectUrl) URL.revokeObjectURL(cells[i].objectUrl!);
    }

    setLayoutIndex(index);
    setCells(newCells);
    if (selectedCell !== null && selectedCell >= newCells.length) {
      setSelectedCell(null);
    }
  };

  const handleCellMediaUpload = (cellId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video/');
    const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
    const mediaType: 'video' | 'gif' | 'image' = isVideo ? 'video' : isGif ? 'gif' : 'image';

    if (isVideo) {
      // Create a SEPARATE blob URL for duration detection (don't reuse the cell's URL)
      const metaUrl = URL.createObjectURL(file);
      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';
      tempVideo.onloadedmetadata = () => {
        const dur = tempVideo.duration;
        setCells(prev => prev.map(c =>
          c.id === cellId
            ? { ...c, duration: isFinite(dur) ? dur : 10 }
            : c
        ));
        URL.revokeObjectURL(metaUrl); // Revoke the separate URL, not the cell's URL
      };
      tempVideo.src = metaUrl;
      // Set cell immediately (duration will update when metadata loads)
      setCells(prev => prev.map(c =>
        c.id === cellId
          ? { ...c, imageUrl: objectUrl, objectUrl, mediaType, duration: 5 }
          : c
      ));
    } else {
      setCells(prev => prev.map(c =>
        c.id === cellId
          ? { ...c, imageUrl: objectUrl, objectUrl, mediaType, duration: isGif ? 6 : 0 }
          : c
      ));
    }
  };

  const updateCellFilter = (cellId: number, key: keyof CellData['filters'], value: number) => {
    setCells(prev => prev.map(c =>
      c.id === cellId
        ? { ...c, filters: { ...c.filters, [key]: value } }
        : c
    ));
  };

  const applyPreset = (cellId: number, preset: typeof PRESETS[0]) => {
    setCells(prev => prev.map(c =>
      c.id === cellId
        ? { ...c, filters: { ...preset.filters } }
        : c
    ));
  };

  const updateCellProp = (cellId: number, key: keyof CellData, value: any) => {
    setCells(prev => prev.map(c =>
      c.id === cellId ? { ...c, [key]: value } : c
    ));
  };

  const resetCellFilters = (cellId: number) => {
    setCells(prev => prev.map(c =>
      c.id === cellId
        ? { ...c, filters: { ...DEFAULT_FILTERS }, scale: 100, offsetX: 0, offsetY: 0 }
        : c
    ));
  };

  // --- Export ---
  const hasAnimated = cells.some(c => (c.mediaType === 'video' || c.mediaType === 'gif') && c.imageUrl);

  // --- Download helper (works on mobile Safari too) ---
  const downloadBlob = useCallback(async (blob: Blob, filename: string) => {
    // Try navigator.share first (mobile-friendly)
    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      try {
        const file = new File([blob], filename, { type: blob.type });
        await navigator.share({ files: [file], title: filename });
        return;
      } catch (_) { /* user cancelled or not supported, fall through */ }
    }
    // Fallback: create <a> download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, []);

  const exportAsPng = useCallback(async () => {
    if (!gridRef.current) return;

    const { default: html2canvas } = await import('html2canvas');
    const el = gridRef.current;
    const rect = el.getBoundingClientRect();
    const canvas = await html2canvas(el, {
      backgroundColor: bgColor,
      scale: 2,
      useCORS: true,
      logging: false,
      width: rect.width,
      height: rect.height,
    });

    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `story-grid-${Date.now()}.png`);
    }, 'image/png');
  }, [bgColor, downloadBlob]);

  // --- Export as GIF (infinite loop) ---
  const [isRecording, setIsRecording] = useState(false);

  const exportAsGif = useCallback(async () => {
    if (!gridRef.current || isRecording) return;
    setIsRecording(true);

    const { GIFEncoder, quantize, applyPalette } = await import('gifenc');

    const gridEl = gridRef.current;
    const gridRect = gridEl.getBoundingClientRect();
    const cw = Math.round(gridRect.width);
    const ch = Math.round(gridRect.height);

    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d')!;

    // Duration from stored cell data
    let maxDur = 3;
    cells.forEach(c => {
      if ((c.mediaType === 'video' || c.mediaType === 'gif') && c.duration > 0) {
        maxDur = Math.max(maxDur, c.duration);
      }
    });
    maxDur = Math.min(maxDur, 15);

    // Reset all videos to start
    const videoEls = Array.from(gridEl.querySelectorAll('video')) as HTMLVideoElement[];
    videoEls.forEach(v => { v.currentTime = 0; v.play(); });

    const cellEls = gridEl.querySelectorAll('.grid-cell');

    const drawFrame = () => {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, cw, ch);

      cellEls.forEach((cellEl) => {
        const cellRect = cellEl.getBoundingClientRect();
        const dx = (cellRect.left - gridRect.left);
        const dy = (cellRect.top - gridRect.top);
        const dw = cellRect.width;
        const dh = cellRect.height;

        const media = cellEl.querySelector('img, video') as HTMLImageElement | HTMLVideoElement | null;
        if (!media) return;

        const nw = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
        const nh = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
        if (!nw || !nh) return;

        ctx.save();
        const r = borderRadius;
        ctx.beginPath();
        ctx.roundRect(dx, dy, dw, dh, r);
        ctx.clip();

        const cellAR = dw / dh;
        const mediaAR = nw / nh;
        let sx: number, sy: number, sw: number, sh: number;
        if (mediaAR > cellAR) {
          sh = nh; sw = nh * cellAR; sx = (nw - sw) / 2; sy = 0;
        } else {
          sw = nw; sh = nw / cellAR; sx = 0; sy = (nh - sh) / 2;
        }
        ctx.drawImage(media, sx, sy, sw, sh, dx, dy, dw, dh);
        ctx.restore();
      });
    };

    const fps = 10;
    const delayMs = 1000 / fps;
    const totalFrames = Math.round(maxDur * fps);
    const gif = GIFEncoder();

    let frameCount = 0;
    const captureNextFrame = () => {
      if (frameCount >= totalFrames) {
        gif.finish();
        const output = gif.bytes();
        const blob = new Blob([output], { type: 'image/gif' });
        downloadBlob(blob, `story-grid-${Date.now()}.gif`);
        setIsRecording(false);
        return;
      }

      drawFrame();
      const imageData = ctx.getImageData(0, 0, cw, ch);
      const palette = quantize(imageData.data, 256);
      const index = applyPalette(imageData.data, palette);
      // Set repeat: 0 (infinite loop) only on first frame
      const opts: Record<string, unknown> = { palette, delay: Math.round(delayMs) };
      if (frameCount === 0) opts.repeat = 0;
      gif.writeFrame(index, cw, ch, opts);

      frameCount++;
      setTimeout(() => requestAnimationFrame(captureNextFrame), delayMs);
    };

    setTimeout(() => requestAnimationFrame(captureNextFrame), 200);
  }, [bgColor, borderRadius, isRecording, cells, downloadBlob]);



  const selected = selectedCell !== null ? cells[selectedCell] : null;

  // --- Mobile tab state ---
  const [mobileTab, setMobileTab] = useState<'canvas' | 'layout' | 'effects'>('canvas');

  // --- Cache Clear ---
  const clearCache = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) { await reg.unregister(); }
    }
    const keys = await caches.keys();
    for (const key of keys) { await caches.delete(key); }
    alert('快取已清除！即將重新載入…');
    window.location.reload();
  }, []);

  return (
    <div className="app-container gradient-bg">
      {/* Header */}
      <header className="glass-morphism">
        <div className="header-content">
          <h1>⚡ 小皮大霹靂</h1>
          <div className="header-actions">
            <button className="btn-icon cache-btn" onClick={clearCache} title="清除快取">
              <Trash2 size={16} />
            </button>
            {hasAnimated ? (
              <button className={`btn-primary export-btn ${isRecording ? 'recording' : ''}`} onClick={exportAsGif} disabled={isRecording}>
                <Film size={18} />
                <span>{isRecording ? '製作中…' : '匯出 GIF'}</span>
              </button>
            ) : null}
            <button className="btn-primary export-btn" onClick={exportAsPng}>
              <Download size={18} />
              <span>匯出 PNG</span>
            </button>
          </div>
        </div>
      </header>

      <main>
        <div className="editor-layout">
          {/* Left Panel: Layout Selector */}
          <aside className={`left-sidebar glass-morphism ${mobileTab === 'layout' ? 'mobile-visible' : ''}`}>
            <h2><Grid size={14} /> 版面佈局</h2>
            <div className="layout-grid">
              {LAYOUTS.map((l, i) => (
                <button
                  key={i}
                  className={`layout-btn ${i === layoutIndex ? 'active' : ''}`}
                  onClick={() => changeLayout(i)}
                >
                  <span className="layout-icon">{l.icon}</span>
                  <span className="layout-name">{l.name}</span>
                </button>
              ))}
            </div>

            <h2 style={{ marginTop: '20px' }}><Smartphone size={14} /> 比例方向</h2>
            <div className="ratio-grid">
              {ASPECT_RATIOS.map((ar, i) => (
                <button
                  key={i}
                  className={`ratio-btn ${i === aspectRatioIndex ? 'active' : ''}`}
                  onClick={() => setAspectRatioIndex(i)}
                >
                  <span className="ratio-icon">
                    {ar.w > ar.h ? <RectangleHorizontal size={16} /> : ar.w === ar.h ? <Square size={16} /> : <RectangleVertical size={16} />}
                  </span>
                  <span className="ratio-name">{ar.name}</span>
                  <span className="ratio-label">{ar.label}</span>
                </button>
              ))}
            </div>

            <h2 style={{ marginTop: '20px' }}>⚙️ 畫布設定</h2>
            <div className="canvas-settings">
              <div className="setting-row">
                <label>間距</label>
                <input type="range" min="0" max="20" value={gap} onChange={e => setGap(+e.target.value)} />
                <span className="setting-value">{gap}px</span>
              </div>
              <div className="setting-row">
                <label>圓角</label>
                <input type="range" min="0" max="30" value={borderRadius} onChange={e => setBorderRadius(+e.target.value)} />
                <span className="setting-value">{borderRadius}px</span>
              </div>
              <div className="setting-row">
                <label>背景色</label>
                <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} />
              </div>
            </div>
          </aside>

          {/* Center: Canvas Preview */}
          <section className="canvas-area">
            <div className={`canvas-wrapper ${isLandscape ? 'landscape' : 'portrait'}`}
              style={{ aspectRatio: currentAspectRatio.ratio }}>
              <div
                ref={gridRef}
                className="photo-grid"
                style={{
                  display: 'grid',
                  gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
                  gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
                  gap: `${gap}px`,
                  backgroundColor: bgColor,
                  width: '100%',
                  height: '100%',
                  overflow: 'hidden',
                }}
              >
                {layout.cells.map((cellLayout, i) => {
                  const cell = cells[i];
                  return (
                    <div
                      key={i}
                      className={`grid-cell ${selectedCell === i ? 'selected' : ''}`}
                      style={{
                        gridRow: `${cellLayout.row + 1} / span ${cellLayout.rowSpan}`,
                        gridColumn: `${cellLayout.col + 1} / span ${cellLayout.colSpan}`,
                        borderRadius: `${borderRadius}px`,
                        overflow: 'hidden',
                        position: 'relative',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedCell(i)}
                    >
                      {cell.imageUrl ? (
                        cell.mediaType === 'video' ? (
                          <video
                            src={cell.imageUrl}
                            autoPlay
                            loop
                            muted
                            playsInline
                            style={{
                              display: 'block',
                              width: '100%',
                              height: '100%',
                              objectFit: cell.objectFit,
                              transform: `scale(${cell.scale / 100}) translate(${cell.offsetX}px, ${cell.offsetY}px)`,
                            }}
                          />
                        ) : (
                          <img
                            src={cell.imageUrl}
                            alt=""
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: cell.objectFit,
                              filter: getFilterString(cell.filters),
                              transform: `scale(${cell.scale / 100}) translate(${cell.offsetX}px, ${cell.offsetY}px)`,
                              transition: 'filter 0.3s ease',
                            }}
                            draggable={false}
                          />
                        )
                      ) : (
                        <label className="cell-upload">
                          <ImageIcon size={28} />
                          <span>點擊上傳</span>
                          <input
                            type="file"
                            accept="image/*,video/*"
                            hidden
                            onChange={(e) => handleCellMediaUpload(i, e)}
                          />
                        </label>
                      )}
                      <div className="cell-index">{i + 1}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Right Panel: Effects per Cell */}
          <aside className={`right-sidebar glass-morphism ${mobileTab === 'effects' ? 'mobile-visible' : ''}`}>
            {selected ? (
              <>
                <div className="panel-header">
                  <h2>🎨 格子 {selectedCell! + 1} 設定</h2>
                  <button className="btn-icon" onClick={() => resetCellFilters(selectedCell!)} title="重置">
                    <RotateCcw size={16} />
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="presets-section">
                  <h3>風格預設</h3>
                  <div className="presets-grid">
                    {PRESETS.map((p, i) => (
                      <button
                        key={i}
                        className="preset-btn"
                        onClick={() => applyPreset(selectedCell!, p)}
                      >
                        <div
                          className="preset-preview"
                          style={{
                            filter: getFilterString(p.filters),
                            backgroundImage: selected.imageUrl ? `url(${selected.imageUrl})` : undefined,
                            backgroundColor: selected.imageUrl ? undefined : '#333',
                          }}
                        />
                        <span>{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fine-tune Sliders */}
                <div className="filters-section">
                  <h3>微調</h3>

                  <div className="control-group">
                    <label><Sun size={14} /> 亮度</label>
                    <div className="slider-row">
                      <input type="range" min="0" max="200" value={selected.filters.brightness}
                        onChange={e => updateCellFilter(selectedCell!, 'brightness', +e.target.value)} />
                      <span>{selected.filters.brightness}%</span>
                    </div>
                  </div>

                  <div className="control-group">
                    <label><Contrast size={14} /> 對比度</label>
                    <div className="slider-row">
                      <input type="range" min="0" max="200" value={selected.filters.contrast}
                        onChange={e => updateCellFilter(selectedCell!, 'contrast', +e.target.value)} />
                      <span>{selected.filters.contrast}%</span>
                    </div>
                  </div>

                  <div className="control-group">
                    <label><Droplets size={14} /> 飽和度</label>
                    <div className="slider-row">
                      <input type="range" min="0" max="200" value={selected.filters.saturate}
                        onChange={e => updateCellFilter(selectedCell!, 'saturate', +e.target.value)} />
                      <span>{selected.filters.saturate}%</span>
                    </div>
                  </div>

                  <div className="control-group">
                    <label>模糊</label>
                    <div className="slider-row">
                      <input type="range" min="0" max="10" step="0.5" value={selected.filters.blur}
                        onChange={e => updateCellFilter(selectedCell!, 'blur', +e.target.value)} />
                      <span>{selected.filters.blur}px</span>
                    </div>
                  </div>

                  <div className="control-group">
                    <label>灰階</label>
                    <div className="slider-row">
                      <input type="range" min="0" max="100" value={selected.filters.grayscale}
                        onChange={e => updateCellFilter(selectedCell!, 'grayscale', +e.target.value)} />
                      <span>{selected.filters.grayscale}%</span>
                    </div>
                  </div>

                  <div className="control-group">
                    <label>復古色調</label>
                    <div className="slider-row">
                      <input type="range" min="0" max="100" value={selected.filters.sepia}
                        onChange={e => updateCellFilter(selectedCell!, 'sepia', +e.target.value)} />
                      <span>{selected.filters.sepia}%</span>
                    </div>
                  </div>
                </div>

                {/* Object Fit & Scale */}
                <div className="size-section">
                  <h3>大小與裁切</h3>
                  <div className="fit-toggle">
                    <button
                      className={`fit-btn ${selected.objectFit === 'cover' ? 'active' : ''}`}
                      onClick={() => updateCellProp(selectedCell!, 'objectFit', 'cover')}
                    >填滿</button>
                    <button
                      className={`fit-btn ${selected.objectFit === 'contain' ? 'active' : ''}`}
                      onClick={() => updateCellProp(selectedCell!, 'objectFit', 'contain')}
                    >完整顯示</button>
                  </div>

                  <div className="control-group">
                    <label>縮放</label>
                    <div className="slider-row">
                      <input type="range" min="50" max="200" value={selected.scale}
                        onChange={e => updateCellProp(selectedCell!, 'scale', +e.target.value)} />
                      <span>{selected.scale}%</span>
                    </div>
                  </div>
                </div>

                {/* Replace Image */}
                <label className="replace-btn btn-secondary">
                  <ImageIcon size={16} />
                  <span>更換檔案</span>
                  <input type="file" accept="image/*,video/*" hidden
                    onChange={e => handleCellMediaUpload(selectedCell!, e)} />
                </label>
              </>
            ) : (
              <div className="empty-panel">
                <p>👆 點擊格子以調整效果</p>
              </div>
            )}
          </aside>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-nav glass-morphism">
        <button className={`mobile-nav-btn ${mobileTab === 'canvas' ? 'active' : ''}`} onClick={() => setMobileTab('canvas')}>
          <ImageIcon size={20} />
          <span>畫布</span>
        </button>
        <button className={`mobile-nav-btn ${mobileTab === 'layout' ? 'active' : ''}`} onClick={() => setMobileTab('layout')}>
          <Grid size={20} />
          <span>佈局</span>
        </button>
        <button className={`mobile-nav-btn ${mobileTab === 'effects' ? 'active' : ''}`} onClick={() => setMobileTab('effects')}>
          <Palette size={20} />
          <span>效果</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
