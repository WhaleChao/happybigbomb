/**
 * 決定多個檔案要放進哪些格子。
 * - 指定起始格：第一個檔案放（或替換）該格，其餘依序放進後面的空白格子（會繞回開頭）
 * - 未指定：依序放進空白格子；若全部格子都已有內容，從第 1 格開始依序替換
 * 回傳每個檔案對應的格子索引，以及放不下的檔案數。
 */
export function planPlacement(
  filled: boolean[],
  fileCount: number,
  startIndex?: number,
): { targets: number[]; overflow: number } {
  const n = filled.length;
  if (n === 0 || fileCount <= 0) return { targets: [], overflow: Math.max(0, fileCount) };

  const targets: number[] = [];
  if (startIndex !== undefined && startIndex >= 0 && startIndex < n) {
    targets.push(startIndex);
    for (let k = 1; k < n && targets.length < fileCount; k++) {
      const i = (startIndex + k) % n;
      if (!filled[i]) targets.push(i);
    }
  } else {
    const empties = filled.map((f, i) => (f ? -1 : i)).filter((i) => i >= 0);
    const pool = empties.length ? empties : filled.map((_, i) => i);
    targets.push(...pool.slice(0, fileCount));
  }
  return { targets, overflow: fileCount - targets.length };
}
