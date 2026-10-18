import { useEffect, useState } from 'react';
import type { Icon } from '../types/catalog';
import { getSvgData, isMono } from '../services/catalog/catalogStore';
import { buildSvg, svgToDataUri } from '../services/export/svg';
import { useTheme } from '../services/storage/prefs';
import { contrast } from '../utils/color';

const cache = new Map<string, string>();
const MAX_CACHE = 3000;

/** Color con el que se muestra un icono monocromo en la interfaz (no afecta a las descargas). */
export function previewColor(icon: Icon, theme: 'light' | 'dark'): string {
  const fg = theme === 'dark' ? '#e8e8ec' : '#18181b';
  const bg = theme === 'dark' ? '#1d1e22' : '#ffffff';
  if (icon.hex && icon.collection.customization === 'brand-mono') {
    const hex = `#${icon.hex}`;
    return contrast(hex, bg) >= 1.6 ? hex : fg;
  }
  return fg;
}

export function useIconPreview(icon: Icon | null, override?: { color?: string | null; size?: number }) {
  const theme = useTheme();
  const color = icon ? (override?.color ?? (isMono(icon) ? previewColor(icon, theme) : null)) : null;
  const key = icon ? `${icon.id}|${color ?? ''}` : '';
  const [state, setState] = useState<{ key: string; uri: string | null; error: string | null }>(() => ({ key, uri: cache.get(key) ?? null, error: null }));

  useEffect(() => {
    if (!icon || icon.shard < 0) return;
    const hit = cache.get(key);
    if (hit) { setState({ key, uri: hit, error: null }); return; }
    let alive = true;
    getSvgData(icon)
      .then((data) => {
        // En la vista previa se permite colorear para legibilidad; la política de licencia se aplica en buildSvg.
        const svg = buildSvg(icon, data, { color });
        const uri = svgToDataUri(svg);
        if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value as string);
        cache.set(key, uri);
        if (alive) setState({ key, uri, error: null });
      })
      .catch((e: Error) => {
        console.warn(`[IconAtlas] No se pudo mostrar ${icon.id}: ${e.message}`);
        if (alive) setState({ key, uri: null, error: e.message });
      });
    return () => { alive = false; };
  }, [icon, key, color]);

  return state.key === key ? state : { key, uri: cache.get(key) ?? null, error: null };
}
