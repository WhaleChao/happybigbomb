import { useId, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { ACCEPT } from '../lib/media';

interface AssetManagerProps {
  /** 選好的檔案；由呼叫端依序放進空白格子 */
  onFiles: (files: File[]) => void;
  emptyCount: number;
  disabled?: boolean;
}

/** 一次加入多個檔案（點選或拖曳），依序填入空白格子 */
export default function AssetManager({ onFiles, emptyCount, disabled }: AssetManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const hintId = useId();

  const take = (list: FileList | null | undefined) => {
    const files = list ? Array.from(list) : [];
    if (files.length) onFiles(files);
  };

  return (
    <div
      className={`dropzone${over ? ' is-over' : ''}`}
      onDragOver={(e) => {
        if (disabled || !e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        if (!disabled) take(e.dataTransfer.files);
      }}
    >
      <button
        type="button"
        className="btn btn-outline btn-block"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-describedby={hintId}
        aria-label="一次加入多張照片或影片"
      >
        <ImagePlus size={18} aria-hidden="true" />
        <span>加入照片或影片</span>
      </button>
      <p id={hintId} className="dropzone-hint">
        {emptyCount > 0
          ? `可一次選多個檔案，會依序填入 ${emptyCount} 個空白格子；也可以直接拖曳到這裡。`
          : '格子都滿了；新加入的檔案會從第 1 格開始替換。'}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        tabIndex={-1}
        onChange={(e) => {
          take(e.target.files);
          // 清空，才能再次選擇同一個檔案
          e.target.value = '';
        }}
      />
    </div>
  );
}
