import { useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { Contrast, Crosshair, Droplets, ImageUp, RotateCcw, Sun, Trash2 } from 'lucide-react';
import { DEFAULT_FILTERS, PRESETS, filterToCss, filtersEqual } from '../lib/filters';
import { SCALE_MAX, SCALE_MIN } from '../lib/geometry';
import { ACCEPT } from '../lib/media';
import type { CellState, Filters } from '../lib/types';

interface EffectEditorProps {
  index: number | null;
  cell: CellState | null;
  cellCount: number;
  onChange: (patch: Partial<CellState>) => void;
  onReset: () => void;
  onClear: () => void;
  onReplace: (files: File[]) => void;
}

interface SliderProps {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  defaultValue: number;
  onChange: (v: number) => void;
}

function Slider({ label, value, min, max, step = 1, unit, defaultValue, onChange }: SliderProps) {
  const id = useId();
  const changed = value !== defaultValue;
  return (
    <div className={`field${changed ? ' is-changed' : ''}`}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <output htmlFor={id} className="field-value">
        {Number.isInteger(value) ? value : value.toFixed(1)}
        {unit}
      </output>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(defaultValue)}
      />
    </div>
  );
}

const KIND_LABEL = { image: '照片', video: '影片', gif: 'GIF 動圖' } as const;

function formatDuration(sec: number): string {
  if (!sec) return '';
  return sec < 60 ? `${sec.toFixed(1)} 秒` : `${Math.floor(sec / 60)} 分 ${Math.round(sec % 60)} 秒`;
}

/** 右側檢視器：單一格子的風格、微調、裁切與檔案操作 */
export default function EffectEditor({ index, cell, cellCount, onChange, onReset, onClear, onReplace }: EffectEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  if (index === null || !cell) {
    return (
      <section className="inspector-empty" aria-labelledby={titleId}>
        <h2 id={titleId} className="section-title">
          <span className="section-no">—</span>調整
        </h2>
        <ol className="steps">
          <li>
            <strong>選版面與比例</strong>
            <span>左側選擇格子排法與尺寸，例如限時動態用 9:16。</span>
          </li>
          <li>
            <strong>放入照片</strong>
            <span>點一下任何格子，或把檔案拖進去。影片與 GIF 也可以。</span>
          </li>
          <li>
            <strong>微調後匯出</strong>
            <span>點選格子即可在這裡調色、縮放；完成後按右上角「匯出」。</span>
          </li>
        </ol>
      </section>
    );
  }

  const media = cell.media;
  const setFilter = (key: keyof Filters, value: number) => onChange({ filters: { ...cell.filters, [key]: value } });
  const isTouched =
    !filtersEqual(cell.filters, DEFAULT_FILTERS) || cell.scale !== 100 || cell.offsetX !== 0 || cell.offsetY !== 0 || cell.fit !== 'cover';

  return (
    <section className="inspector" aria-labelledby={titleId}>
      <header className="inspector-head">
        <h2 id={titleId} className="inspector-title">
          第 {index + 1} 格<span className="inspector-sub"> / 共 {cellCount} 格</span>
        </h2>
        <div className="inspector-actions">
          <button
            type="button"
            className="btn btn-icon"
            onClick={onReset}
            disabled={!isTouched}
            aria-label={`重設第 ${index + 1} 格的效果與位置`}
            title="重設效果與位置"
          >
            <RotateCcw size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-icon"
            onClick={onClear}
            disabled={!media}
            aria-label={`移除第 ${index + 1} 格的檔案`}
            title="移除檔案"
          >
            <Trash2 size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      {media ? (
        <p className="media-meta">
          <span className="media-kind">{KIND_LABEL[media.kind]}</span>
          <span className="media-name" title={media.name}>
            {media.name}
          </span>
          <span className="media-dims">
            {media.width}×{media.height}
            {media.duration ? ` · ${formatDuration(media.duration)}` : ''}
          </span>
        </p>
      ) : (
        <p className="media-meta is-empty">這一格還沒有檔案。</p>
      )}

      <button
        type="button"
        className="btn btn-outline btn-block"
        onClick={() => inputRef.current?.click()}
        aria-label={media ? `更換第 ${index + 1} 格的檔案` : `加入檔案到第 ${index + 1} 格`}
      >
        <ImageUp size={18} aria-hidden="true" />
        <span>{media ? '更換檔案' : '加入檔案'}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        tabIndex={-1}
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = '';
          if (files.length) onReplace(files);
        }}
      />

      <fieldset className="group" disabled={!media}>
        <legend className="section-title">
          <span className="section-no">A</span>風格
        </legend>
        <div className="presets" role="radiogroup" aria-label="風格預設">
          {PRESETS.map((p) => {
            const active = filtersEqual(cell.filters, p.filters);
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`preset${active ? ' is-active' : ''}`}
                onClick={() => onChange({ filters: { ...p.filters } })}
              >
                <span
                  className="preset-swatch"
                  style={{
                    backgroundImage: media?.thumbUrl ? `url(${media.thumbUrl})` : undefined,
                    filter: filterToCss(p.filters, p.filters.blur),
                  }}
                  aria-hidden="true"
                />
                <span className="preset-name">{p.name}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="group" disabled={!media}>
        <legend className="section-title">
          <span className="section-no">B</span>微調
        </legend>
        <Slider
          label={<><Sun size={15} aria-hidden="true" />亮度</>}
          value={cell.filters.brightness}
          min={0}
          max={200}
          unit="%"
          defaultValue={100}
          onChange={(v) => setFilter('brightness', v)}
        />
        <Slider
          label={<><Contrast size={15} aria-hidden="true" />對比</>}
          value={cell.filters.contrast}
          min={0}
          max={200}
          unit="%"
          defaultValue={100}
          onChange={(v) => setFilter('contrast', v)}
        />
        <Slider
          label={<><Droplets size={15} aria-hidden="true" />飽和度</>}
          value={cell.filters.saturate}
          min={0}
          max={200}
          unit="%"
          defaultValue={100}
          onChange={(v) => setFilter('saturate', v)}
        />
        <Slider label="模糊" value={cell.filters.blur} min={0} max={10} step={0.5} unit="" defaultValue={0} onChange={(v) => setFilter('blur', v)} />
        <Slider label="灰階" value={cell.filters.grayscale} min={0} max={100} unit="%" defaultValue={0} onChange={(v) => setFilter('grayscale', v)} />
        <Slider label="懷舊色調" value={cell.filters.sepia} min={0} max={100} unit="%" defaultValue={0} onChange={(v) => setFilter('sepia', v)} />
        <p className="field-tip">在滑桿上點兩下可恢復預設值。</p>
      </fieldset>

      <fieldset className="group" disabled={!media}>
        <legend className="section-title">
          <span className="section-no">C</span>裁切與位置
        </legend>
        <div className="segmented" role="radiogroup" aria-label="填滿方式">
          <button type="button" role="radio" aria-checked={cell.fit === 'cover'} className={cell.fit === 'cover' ? 'is-active' : ''} onClick={() => onChange({ fit: 'cover' })}>
            填滿格子
          </button>
          <button type="button" role="radio" aria-checked={cell.fit === 'contain'} className={cell.fit === 'contain' ? 'is-active' : ''} onClick={() => onChange({ fit: 'contain' })}>
            完整顯示
          </button>
        </div>
        <Slider label="縮放" value={cell.scale} min={SCALE_MIN} max={SCALE_MAX} unit="%" defaultValue={100} onChange={(v) => onChange({ scale: v })} />
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => onChange({ offsetX: 0, offsetY: 0 })}
          disabled={cell.offsetX === 0 && cell.offsetY === 0}
          aria-label="把照片移回格子正中央"
        >
          <Crosshair size={16} aria-hidden="true" />
          <span>置中</span>
        </button>
        <p className="field-tip">
          在畫布上拖曳可移動；手機用雙指、電腦用觸控板捏合或 Ctrl＋滾輪縮放。選取格子後也可用方向鍵微調、＋／− 縮放。
        </p>
      </fieldset>
    </section>
  );
}
