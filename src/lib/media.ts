import { FriendlyError } from './errors';
import { decodeGif } from './gif';
import type { CellMedia, MediaKind } from './types';

/** 檔案選擇器接受的類型 */
export const ACCEPT = 'image/*,video/*,.heic,.heif';
export const THUMB_SIZE = 160;
/** 影片長度上限（秒）。超過的部分匯出時不會使用，但仍可預覽 */
export const MAX_ANIMATION_SECONDS = 15;

export function detectKind(file: Pick<File, 'type' | 'name'>): MediaKind | null {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  if (type === 'image/gif' || name.endsWith('.gif')) return 'gif';
  if (type.startsWith('video/') || /\.(mp4|m4v|mov|webm|ogv)$/.test(name)) return 'video';
  if (type.startsWith('image/') || /\.(jpe?g|png|webp|avif|bmp|heic|heif)$/.test(name)) return 'image';
  return null;
}

function isHeic(file: Pick<File, 'type' | 'name'>): boolean {
  return /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

/** 釋放媒體佔用的記憶體：object URL、GIF 影格畫布 */
export function releaseMedia(media: CellMedia | null | undefined): void {
  if (!media) return;
  URL.revokeObjectURL(media.url);
  if (media.thumbUrl) URL.revokeObjectURL(media.thumbUrl);
  media.gifFrames?.forEach((f) => {
    f.canvas.width = 0;
    f.canvas.height = 0;
  });
}

async function makeThumb(source: CanvasImageSource, w: number, h: number): Promise<string | null> {
  try {
    const s = THUMB_SIZE / Math.max(w, h);
    const tw = Math.max(1, Math.round(w * Math.min(1, s)));
    const th = Math.max(1, Math.round(h * Math.min(1, s)));
    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, tw, th);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    canvas.width = canvas.height = 0;
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = url;
  });
}

function loadVideoMeta(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    const timer = window.setTimeout(() => reject(new Error('video metadata timeout')), 20000);
    video.onloadeddata = () => {
      window.clearTimeout(timer);
      resolve(video);
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('video decode failed'));
    };
    video.src = url;
  });
}

function disposeVideo(video: HTMLVideoElement): void {
  video.removeAttribute('src');
  video.load();
}

/**
 * 讀取使用者選的檔案，全部在瀏覽器內完成，不會上傳。
 * 失敗時會釋放已建立的 URL，並丟出 FriendlyError。
 */
export async function loadMediaFile(file: File): Promise<CellMedia> {
  const kind = detectKind(file);
  if (!kind) {
    throw new FriendlyError(
      `「${file.name}」不是照片或影片`,
      '請選擇 JPG、PNG、WebP、GIF 等圖片，或 MP4、MOV、WebM 影片。',
    );
  }

  const url = URL.createObjectURL(file);
  try {
    if (kind === 'image') {
      let img: HTMLImageElement;
      try {
        img = await loadImage(url);
      } catch {
        if (isHeic(file)) {
          throw new FriendlyError(
            '這個瀏覽器讀不了 HEIC 照片',
            '請在 iPhone「設定 › 相機 › 格式」改選「最相容」，或先把照片轉成 JPG 再加入。',
          );
        }
        throw new FriendlyError(`「${file.name}」無法開啟`, '檔案可能已損壞或格式不支援，請換一張照片試試。');
      }
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const thumbUrl = await makeThumb(img, width, height);
      return { kind, url, thumbUrl, name: file.name, width, height, duration: 0 };
    }

    if (kind === 'gif') {
      let decoded;
      try {
        decoded = await decodeGif(await file.arrayBuffer());
      } catch {
        // 解析失敗時退回當成靜態圖片使用
        const img = await loadImage(url).catch(() => {
          throw new FriendlyError(`「${file.name}」無法開啟`, '這個 GIF 可能已損壞，請換一個檔案試試。');
        });
        const thumbUrl = await makeThumb(img, img.naturalWidth, img.naturalHeight);
        return { kind: 'image', url, thumbUrl, name: file.name, width: img.naturalWidth, height: img.naturalHeight, duration: 0 };
      }
      const first = decoded.frames[0]?.canvas;
      const thumbUrl = first ? await makeThumb(first, decoded.width, decoded.height) : null;
      return {
        kind,
        url,
        thumbUrl,
        name: file.name,
        width: decoded.width,
        height: decoded.height,
        duration: decoded.duration,
        gifFrames: decoded.frames,
      };
    }

    // video
    let video: HTMLVideoElement;
    try {
      video = await loadVideoMeta(url);
    } catch {
      throw new FriendlyError(
        `「${file.name}」這個影片無法播放`,
        '瀏覽器可能不支援它的編碼（例如部分 HEVC／H.265 影片）。請轉成 H.264 的 MP4 後再加入。',
      );
    }
    const width = video.videoWidth;
    const height = video.videoHeight;
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : MAX_ANIMATION_SECONDS;
    const thumbUrl = await makeThumb(video, width, height);
    disposeVideo(video);
    if (!width || !height) {
      throw new FriendlyError(`「${file.name}」沒有畫面`, '這個檔案可能只有聲音，請選擇有畫面的影片。');
    }
    return { kind, url, thumbUrl, name: file.name, width, height, duration };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}
