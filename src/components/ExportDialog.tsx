import { useEffect, useId, useRef, useState } from 'react';
import { Check, Download, Film, Image as ImageIcon, Images, X } from 'lucide-react';
import { FriendlyError, isAbortError, toFriendly } from '../lib/errors';
import { outputSize } from '../lib/geometry';
import type { Composition } from '../lib/types';
import {
  GIF_LONG_EDGE,
  PNG_SIZES,
  animationDuration,
  canExportMp4,
  deliverBlob,
  exportComposition,
  hasAnimatedMedia,
  type ExportFormat,
  type ExportResult,
} from '../services/ExportService';

interface ExportDialogProps {
  open: boolean;
  comp: Composition;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'working'; progress: number }
  | { kind: 'done'; result: ExportResult; delivery: 'shared' | 'downloaded' | 'cancelled' }
  | { kind: 'error'; error: FriendlyError };

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function ExportDialog({ open, comp, onClose, onBusyChange }: ExportDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const animated = hasAnimatedMedia(comp.cells);
  const hasVideo = comp.cells.some((c) => c.media?.kind === 'video');
  // null＝檢查中；瀏覽器有 WebCodecs 不代表支援 H.264，需實際詢問編碼器
  const [mp4Supported, setMp4Supported] = useState<boolean | null>(null);
  const [chosenFormat, setFormat] = useState<ExportFormat>('png');
  const [sizeId, setSizeId] = useState(PNG_SIZES[0].id);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  // 開啟時依內容選擇預設格式（與舊版行為相同：有影片→MP4、只有 GIF→GIF、否則 PNG）
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setPhase({ kind: 'idle' });
      setFormat(hasVideo ? 'mp4' : animated ? 'gif' : 'png');
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
    // 只在開關時重新決定預設格式
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    canExportMp4(comp.aspect).then((ok) => {
      if (alive) setMp4Supported(ok);
    });
    return () => {
      alive = false;
    };
  }, [open, comp.aspect]);

  // 不支援 MP4 時自動改選 GIF（或 PNG）
  const format: ExportFormat = chosenFormat === 'mp4' && mp4Supported === false ? (animated ? 'gif' : 'png') : chosenFormat;
  const working = phase.kind === 'working';

  const requestClose = () => {
    if (working) abortRef.current?.abort();
    // 關閉時清掉結果，讓檔案佔用的記憶體可以被回收
    setPhase({ kind: 'idle' });
    onClose();
  };

  const start = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ kind: 'working', progress: 0 });
    onBusyChange(true);
    try {
      const longEdge = PNG_SIZES.find((s) => s.id === sizeId)?.longEdge;
      const result = await exportComposition(comp, {
        format,
        longEdge,
        signal: controller.signal,
        onProgress: (p) => setPhase((prev) => (prev.kind === 'working' ? { kind: 'working', progress: p } : prev)),
      });
      const delivery = await deliverBlob(result.blob, result.filename);
      setPhase({ kind: 'done', result, delivery });
    } catch (err) {
      if (isAbortError(err)) setPhase({ kind: 'idle' });
      else setPhase({ kind: 'error', error: toFriendly(err, '匯出失敗') });
    } finally {
      abortRef.current = null;
      onBusyChange(false);
    }
  };

  const duration = animationDuration(comp.cells);
  const gifDims = outputSize(comp.aspect, GIF_LONG_EDGE);

  const options: {
    id: ExportFormat;
    title: string;
    desc: string;
    icon: typeof ImageIcon;
    disabled: boolean;
    reason?: string;
  }[] = [
    { id: 'png', title: 'PNG 圖片', desc: '畫質最好，適合貼文與列印。影片取第一個畫面。', icon: ImageIcon, disabled: false },
    {
      id: 'gif',
      title: 'GIF 動圖',
      desc: `${gifDims.width}×${gifDims.height}，約 ${duration.toFixed(0)} 秒，無聲、會自動重播。`,
      icon: Images,
      disabled: !animated,
      reason: '加入影片或 GIF 後才能使用',
    },
    {
      id: 'mp4',
      title: 'MP4 影片',
      desc: `最長 ${duration.toFixed(0)} 秒、無聲，適合限時動態。`,
      icon: Film,
      disabled: !animated || mp4Supported !== true,
      reason: !animated
        ? '加入影片或 GIF 後才能使用'
        : mp4Supported === null
          ? '正在確認瀏覽器是否支援…'
          : '這個瀏覽器無法製作 MP4，請改用 GIF，或換最新版 Chrome、Edge、Safari',
    },
  ];

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
    >
      <div className="dialog-head">
        <h2 id={titleId}>匯出作品</h2>
        <button type="button" className="btn btn-icon" onClick={requestClose} aria-label="關閉匯出視窗">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <fieldset className="formats" disabled={working}>
        <legend className="sr-only">選擇檔案格式</legend>
        {options.map((o) => {
          const Icon = o.icon;
          return (
            <label key={o.id} className={`format${format === o.id ? ' is-active' : ''}${o.disabled ? ' is-disabled' : ''}`}>
              <input
                type="radio"
                name="export-format"
                value={o.id}
                checked={format === o.id}
                disabled={o.disabled}
                onChange={() => setFormat(o.id)}
              />
              <Icon size={22} aria-hidden="true" className="format-icon" />
              <span className="format-text">
                <span className="format-title">{o.title}</span>
                <span className="format-desc">{o.disabled ? o.reason : o.desc}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {format === 'png' && (
        <fieldset className="sizes" disabled={working}>
          <legend className="field-label">尺寸</legend>
          <div className="segmented">
            {PNG_SIZES.map((s) => {
              const d = outputSize(comp.aspect, s.longEdge);
              return (
                <label key={s.id} className={sizeId === s.id ? 'is-active' : ''}>
                  <input type="radio" name="png-size" value={s.id} checked={sizeId === s.id} onChange={() => setSizeId(s.id)} className="sr-only" />
                  <span>{s.label}</span>
                  <small>
                    {d.width}×{d.height}
                  </small>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="dialog-status" aria-live="polite">
        {phase.kind === 'working' && (
          <div className="progress">
            <progress max={1} value={phase.progress} aria-label="匯出進度" />
            <span>
              <strong>{Math.round(phase.progress * 100)}%</strong> 正在你的裝置上製作，請不要關閉頁面。
            </span>
          </div>
        )}
        {phase.kind === 'done' && (
          <div className="result">
            <Check size={20} aria-hidden="true" />
            <div>
              <p className="result-title">
                {phase.delivery === 'shared' ? '已開啟分享面板' : phase.delivery === 'cancelled' ? '檔案已製作完成' : '已開始下載'}
              </p>
              <p className="result-desc">
                {phase.result.filename} · {phase.result.width}×{phase.result.height} · {formatBytes(phase.result.blob.size)}
              </p>
              {phase.result.notes.map((n) => (
                <p key={n} className="result-note">
                  {n}
                </p>
              ))}
              <button
                type="button"
                className="btn btn-link"
                onClick={() => {
                  const { result } = phase;
                  void deliverBlob(result.blob, result.filename).then((delivery) =>
                    setPhase((prev) => (prev.kind === 'done' ? { ...prev, delivery } : prev)),
                  );
                }}
              >
                {phase.delivery === 'downloaded' ? '沒有下載到？點這裡再存一次' : '儲存或分享檔案'}
              </button>
            </div>
          </div>
        )}
        {phase.kind === 'error' && (
          <div className="alert" role="alert">
            <p className="alert-title">{phase.error.title}</p>
            <p className="alert-hint">{phase.error.hint}</p>
          </div>
        )}
      </div>

      <div className="dialog-foot">
        <p className="privacy-inline">照片只在你的瀏覽器處理，不會上傳。</p>
        {working ? (
          <button type="button" className="btn btn-outline" onClick={() => abortRef.current?.abort()}>
            取消
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={start} disabled={!comp.cells.some((c) => c.media)}>
            <Download size={18} aria-hidden="true" />
            <span>{phase.kind === 'done' ? '再匯出一次' : '開始匯出'}</span>
          </button>
        )}
      </div>
    </dialog>
  );
}
