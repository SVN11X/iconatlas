import { createStore, KEYS, useStore } from './local';

export interface ExportPrefs {
  pngSize: number;
  background: string | null;
  format: 'svg' | 'png' | 'both';
}

export const exportPrefsStore = createStore<ExportPrefs>(KEYS.exportPrefs, { pngSize: 1024, background: null, format: 'svg' });
export const useExportPrefs = () => useStore(exportPrefsStore);

export type Theme = 'light' | 'dark';
function initialTheme(): Theme {
  try {
    const t = localStorage.getItem(KEYS.theme);
    if (t) return JSON.parse(t) === 'dark' ? 'dark' : 'light';
  } catch { /* ignore */ }
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
export const themeStore = createStore<Theme>(KEYS.theme, initialTheme());
export const useTheme = () => useStore(themeStore);

export function applyTheme(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#141518' : '#ffffff');
}
