import { useEffect, useState } from 'react';

function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatch(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return match;
}

export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

export type ThemePref = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'happybigbomb:theme';

function readStoredTheme(): ThemePref | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : null;
  } catch {
    return null;
  }
}

/** 配色偏好：網址 ?theme= 優先，其次是上次選擇，最後跟隨系統 */
export function useThemePreference(initial?: ThemePref | null): [ThemePref, (t: ThemePref) => void] {
  const [theme, setTheme] = useState<ThemePref>(() => initial ?? readStoredTheme() ?? 'system');
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);
  const update = (t: ThemePref) => {
    setTheme(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* 無痕模式或被封鎖時略過 */
    }
  };
  return [theme, update];
}
