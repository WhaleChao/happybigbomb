/** 給使用者看的錯誤：title 說明發生什麼事，hint 說明怎麼解決 */
export class FriendlyError extends Error {
  readonly title: string;
  readonly hint: string;

  constructor(title: string, hint: string, options?: { cause?: unknown }) {
    super(`${title}：${hint}`, options);
    this.name = 'FriendlyError';
    this.title = title;
    this.hint = hint;
  }
}

export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

export function abortError(): DOMException {
  return new DOMException('使用者取消', 'AbortError');
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

/** 把任何錯誤轉成白話訊息 */
export function toFriendly(err: unknown, fallbackTitle = '發生了預期外的問題'): FriendlyError {
  if (err instanceof FriendlyError) return err;
  const message = err instanceof Error ? err.message : String(err);
  if (/quota|memory|allocation|out of memory/i.test(message)) {
    return new FriendlyError(
      '裝置記憶體不足',
      '請關閉其他分頁或應用程式，或減少格子數量、改用較小的匯出尺寸後再試一次。',
      { cause: err },
    );
  }
  return new FriendlyError(
    fallbackTitle,
    '請重新整理頁面後再試一次；如果一直發生，請換用最新版的 Chrome、Edge、Safari 或 Firefox。',
    { cause: err },
  );
}
