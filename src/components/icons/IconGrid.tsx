import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import type { Icon } from '../../types/catalog';
import { IconCard } from './IconCard';
import { useCatalog } from '../../app/CatalogContext';
import { useFavorites } from '../../services/storage/favorites';
import { selectionStore, useSelection } from '../../services/storage/selection';
import { useIconActions } from '../../hooks/useIconActions';
import { useOpenIcon } from '../../hooks/useOpenIcon';
import { useExportPrefs } from '../../services/storage/prefs';

const MIN_CARD = 128;
const GAP = 10;
const ROW_H = 154;

/** Cuadrícula virtualizada: solo se renderizan las filas visibles (miles de iconos sin bloquear). */
export function IconGrid({ icons, label }: { icons: Icon[]; label: string }) {
  const { catalog } = useCatalog();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1024);
  const [offset, setOffset] = useState(0);
  const favs = useFavorites();
  const favSet = useMemo(() => new Set(favs), [favs]);
  const selection = useSelection();
  const actions = useIconActions();
  const prefs = useExportPrefs();
  const { open } = useOpenIcon();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      setWidth(el.clientWidth);
      setOffset(el.getBoundingClientRect().top + window.scrollY);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [icons]);

  const cols = Math.max(2, Math.floor((width + GAP) / (MIN_CARD + GAP)));
  const rows = Math.ceil(icons.length / cols);
  const virtualizer = useWindowVirtualizer({ count: rows, estimateSize: () => ROW_H + GAP, overscan: 4, scrollMargin: offset });

  const handlers = useMemo(() => ({
    onOpen: (i: Icon) => open(i.id),
    onToggleSelect: (i: Icon) => selectionStore.toggle(i.id),
    onCopySvg: (i: Icon) => void actions.copySvg(i),
    onCopyImage: (i: Icon) => void actions.copyImage(i, { size: Math.min(prefs.pngSize, 1024), background: prefs.background }),
    onDownloadPng: (i: Icon) => void actions.downloadPng(i, { size: prefs.pngSize, background: prefs.background }),
    onDownloadSvg: (i: Icon) => void actions.downloadSvg(i),
    onFavorite: (i: Icon) => actions.favorite(i),
  }), [actions, open, prefs.pngSize, prefs.background]);

  // Navegación con flechas entre tarjetas
  const focusIdx = useCallback((idx: number) => {
    const target = Math.max(0, Math.min(icons.length - 1, idx));
    virtualizer.scrollToIndex(Math.floor(target / cols), { align: 'auto' });
    requestAnimationFrame(() => {
      const el = ref.current?.querySelector<HTMLButtonElement>(`button[data-idx="${target}"]`);
      el?.focus();
    });
  }, [icons.length, cols, virtualizer]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    const idx = t.dataset.idx ? Number(t.dataset.idx) : NaN;
    if (Number.isNaN(idx)) return;
    const map: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols };
    if (e.key in map) { e.preventDefault(); focusIdx(idx + map[e.key]); }
    else if (e.key === 'Home') { e.preventDefault(); focusIdx(0); }
    else if (e.key === 'End') { e.preventDefault(); focusIdx(icons.length - 1); }
  };

  useEffect(() => { virtualizer.measure(); }, [cols, virtualizer]);

  const selectionMode = selection.size > 0;
  const items = virtualizer.getVirtualItems();
  return (
    <div ref={ref} className="relative w-full" onKeyDown={onKeyDown}>
      <div role="list" aria-label={label} style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {items.map((row) => {
          const start = row.index * cols;
          const slice = icons.slice(start, start + cols);
          return (
            <div
              key={row.key}
              className="absolute left-0 top-0 grid w-full"
              style={{ transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: GAP, height: ROW_H }}
            >
              {slice.map((icon, j) => (
                <div role="listitem" key={icon.id} aria-posinset={start + j + 1} aria-setsize={icons.length}>
                  <IconCard
                    icon={icon}
                    idx={start + j}
                    selected={selection.has(icon.id)}
                    favorite={favSet.has(icon.id)}
                    selectionMode={selectionMode}
                    providerName={icon.provider !== 'community' ? catalog?.providers.get(icon.provider)?.shortName ?? catalog?.providers.get(icon.provider)?.name : undefined}
                    {...handlers}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
