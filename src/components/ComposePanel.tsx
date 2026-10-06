import { useId } from 'react';
import { ASPECT_RATIOS, LAYOUTS } from '../lib/layouts';
import AssetManager from './AssetManager';
import { LayoutGlyph, RatioGlyph } from './Glyphs';

const SWATCHES = [
  { value: '#000000', name: '黑' },
  { value: '#ffffff', name: '白' },
  { value: '#f2ede3', name: '米白' },
  { value: '#1f2a24', name: '墨綠' },
  { value: '#c23a1e', name: '朱紅' },
];

interface ComposePanelProps {
  layoutIndex: number;
  aspectIndex: number;
  gap: number;
  radius: number;
  background: string;
  emptyCount: number;
  showCacheReset: boolean;
  onLayout: (i: number) => void;
  onAspect: (i: number) => void;
  onGap: (v: number) => void;
  onRadius: (v: number) => void;
  onBackground: (v: string) => void;
  onFiles: (files: File[]) => void;
  onResetCache: () => void;
}

/** 左側面板：素材、版面、比例與畫布設定 */
export default function ComposePanel(p: ComposePanelProps) {
  const gapId = useId();
  const radiusId = useId();
  const colorId = useId();

  return (
    <div className="compose">
      <section className="group">
        <h2 className="section-title">
          <span className="section-no">01</span>素材
        </h2>
        <AssetManager onFiles={p.onFiles} emptyCount={p.emptyCount} />
      </section>

      <section className="group">
        <h2 className="section-title" id="layout-title">
          <span className="section-no">02</span>版面
        </h2>
        <div className="choice-grid layouts" role="radiogroup" aria-labelledby="layout-title">
          {LAYOUTS.map((l, i) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={i === p.layoutIndex}
              className={`choice${i === p.layoutIndex ? ' is-active' : ''}`}
              onClick={() => p.onLayout(i)}
              aria-label={`${l.name}，${l.cells.length} 格`}
            >
              <LayoutGlyph layout={l} size={34} />
              <span className="choice-label">{l.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="group">
        <h2 className="section-title" id="ratio-title">
          <span className="section-no">03</span>比例
        </h2>
        <div className="choice-grid ratios" role="radiogroup" aria-labelledby="ratio-title">
          {ASPECT_RATIOS.map((a, i) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={i === p.aspectIndex}
              className={`choice choice-ratio${i === p.aspectIndex ? ' is-active' : ''}`}
              onClick={() => p.onAspect(i)}
              aria-label={`${a.id} ${a.label}`}
            >
              <RatioGlyph aspect={a} size={24} />
              <span className="choice-text">
                <span className="choice-value">{a.id}</span>
                <span className="choice-label">{a.label}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="group">
        <h2 className="section-title">
          <span className="section-no">04</span>畫布
        </h2>
        <div className="field">
          <label className="field-label" htmlFor={gapId}>
            間距
          </label>
          <output className="field-value" htmlFor={gapId}>
            {p.gap}
          </output>
          <input id={gapId} type="range" min={0} max={24} value={p.gap} onChange={(e) => p.onGap(Number(e.target.value))} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor={radiusId}>
            圓角
          </label>
          <output className="field-value" htmlFor={radiusId}>
            {p.radius}
          </output>
          <input id={radiusId} type="range" min={0} max={40} value={p.radius} onChange={(e) => p.onRadius(Number(e.target.value))} />
        </div>
        <div className="field field-color">
          <span className="field-label" id={`${colorId}-label`}>
            背景色
          </span>
          <div className="swatches" role="radiogroup" aria-labelledby={`${colorId}-label`}>
            {SWATCHES.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={p.background.toLowerCase() === s.value}
                aria-label={`背景${s.name}`}
                title={s.name}
                className="swatch"
                style={{ backgroundColor: s.value }}
                onClick={() => p.onBackground(s.value)}
              />
            ))}
            <label className="swatch swatch-custom" title="自訂顏色">
              <span className="sr-only">自訂背景顏色</span>
              <input id={colorId} type="color" value={p.background} onChange={(e) => p.onBackground(e.target.value)} />
            </label>
          </div>
        </div>
      </section>

      {p.showCacheReset && (
        <footer className="compose-foot">
          <button type="button" className="btn btn-link" onClick={p.onResetCache}>
            畫面怪怪的？清除離線快取並重新載入
          </button>
        </footer>
      )}
    </div>
  );
}
