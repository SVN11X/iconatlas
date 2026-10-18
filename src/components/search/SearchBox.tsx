import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clock, CornerDownLeft, Loader2, Search, X } from 'lucide-react';
import { useCatalog } from '../../app/CatalogContext';
import { useI18n } from '../../app/i18n';
import { useDebounced } from '../../hooks/useMediaQuery';
import { addRecentSearch, clearRecentSearches, useRecentSearches } from '../../services/storage/recent';
import type { Icon } from '../../types/catalog';
import { IconImage } from '../icons/IconImage';

type Item =
  | { kind: 'recent'; label: string }
  | { kind: 'suggest'; label: string }
  | { kind: 'icon'; icon: Icon }
  | { kind: 'all'; label: string };

export function SearchBox({ hotkey = true, large = false }: { hotkey?: boolean; large?: boolean }) {
  const { t } = useI18n();
  const { catalog, search, searchReady } = useCatalog();
  const nav = useNavigate();
  const loc = useLocation();
  const urlQ = loc.pathname === '/explore' ? new URLSearchParams(loc.search).get('q') ?? '' : '';
  const [q, setQ] = useState(urlQ);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [icons, setIcons] = useState<Icon[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const recent = useRecentSearches();
  const dq = useDebounced(q, 120);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  // Mantener sincronizado con la URL al navegar
  useEffect(() => { setQ(urlQ); }, [urlQ]);

  // Atajos Ctrl+K / Cmd+K y "/"
  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable;
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hotkey]);

  // Autocompletado
  useEffect(() => {
    let alive = true;
    if (!search || !catalog || !dq.trim()) { setIcons([]); setSuggestions([]); return; }
    Promise.all([search.search(dq, 8), search.suggest(dq)])
      .then(([ids, sugg]) => {
        if (!alive) return;
        setIcons(ids.map((i) => catalog.icons[i]).filter(Boolean));
        setSuggestions(sugg.filter((s) => s.toLowerCase() !== dq.trim().toLowerCase()).slice(0, 4));
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [dq, search, catalog]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const items: Item[] = useMemo(() => {
    if (!q.trim()) return recent.map((r) => ({ kind: 'recent' as const, label: r }));
    return [
      ...suggestions.map((s) => ({ kind: 'suggest' as const, label: s })),
      ...icons.map((icon) => ({ kind: 'icon' as const, icon })),
      { kind: 'all' as const, label: q.trim() },
    ];
  }, [q, recent, suggestions, icons]);

  useEffect(() => { setActive(-1); }, [items.length, q]);

  function submit(query: string) {
    const v = query.trim();
    const p = new URLSearchParams(loc.pathname === '/explore' ? loc.search : '');
    p.delete('icon');
    if (v) { p.set('q', v); addRecentSearch(v); } else p.delete('q');
    setOpen(false);
    nav({ pathname: '/explore', search: p.toString() ? `?${p.toString()}` : '' });
  }

  function choose(item: Item) {
    if (item.kind === 'icon') {
      addRecentSearch(q);
      setOpen(false);
      const p = new URLSearchParams(loc.pathname === '/explore' ? loc.search : '');
      if (q.trim()) p.set('q', q.trim());
      p.set('icon', item.icon.id);
      nav({ pathname: '/explore', search: `?${p.toString()}` });
    } else if (item.kind === 'all') submit(item.label);
    else { setQ(item.label); submit(item.label); }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && active >= 0 && items[active]) choose(items[active]);
      else submit(q);
    } else if (e.key === 'Escape') {
      if (open) { setOpen(false); } else { setQ(''); }
    }
  }

  const showList = open && items.length > 0;
  const optId = (i: number) => `${listId}-opt-${i}`;

  return (
    <div ref={wrapRef} className={`relative mx-auto w-full ${large ? 'max-w-2xl' : 'max-w-xl'}`}>
      <label htmlFor={`${listId}-input`} className="sr-only">{t('search.label')}</label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        ref={inputRef}
        id={`${listId}-input`}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${listId}-list`}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? optId(active) : undefined}
        autoComplete="off"
        spellCheck={false}
        value={q}
        placeholder={t('search.placeholder')}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={`input pl-9 pr-20 [&::-webkit-search-cancel-button]:hidden ${large ? 'h-12 rounded-xl text-base shadow-card' : 'h-10'}`}
        data-testid={large ? 'hero-search-input' : 'search-input'}
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {q && (
          <button type="button" className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-fg focus-ring" onClick={() => { setQ(''); inputRef.current?.focus(); }} aria-label="Limpiar búsqueda">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {hotkey && <kbd className="kbd hidden sm:inline">{isMac ? '⌘K' : 'Ctrl K'}</kbd>}
      </div>
      {open && q.trim() && !searchReady && (
        <div className="absolute left-0 right-0 top-full mt-1 flex items-center gap-2 rounded-lg border border-border bg-elevated px-3 py-2 text-xs text-muted shadow-pop">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> {t('search.indexing')}
        </div>
      )}
      {showList && (searchReady || !q.trim()) && (
        <ul id={`${listId}-list`} role="listbox" aria-label={t('search.label')} className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-auto rounded-xl border border-border bg-elevated p-1 shadow-pop animate-fade-in">
          {!q.trim() && (
            <li role="presentation" className="flex items-center justify-between px-2 pb-1 pt-1.5">
              <span className="section-title">{t('search.recent')}</span>
              <button className="text-xs text-muted hover:text-fg focus-ring rounded" onMouseDown={(e) => e.preventDefault()} onClick={() => clearRecentSearches()}>{t('search.clearRecent')}</button>
            </li>
          )}
          {items.map((it, i) => {
            const isActive = i === active;
            const base = `flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm ${isActive ? 'bg-accent/10 text-fg' : 'text-fg/90'}`;
            return (
              <li key={i} id={optId(i)} role="option" aria-selected={isActive} className={base} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(it)} onMouseEnter={() => setActive(i)}>
                {it.kind === 'recent' && (<><Clock className="h-4 w-4 text-muted" aria-hidden />{it.label}</>)}
                {it.kind === 'suggest' && (<><Search className="h-4 w-4 text-muted" aria-hidden />{it.label}</>)}
                {it.kind === 'icon' && (
                  <>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface"><IconImage icon={it.icon} className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1 truncate">{it.icon.title}</span>
                    <span className="hidden shrink-0 truncate text-xs text-muted sm:block">{it.icon.collection.name}</span>
                  </>
                )}
                {it.kind === 'all' && (<><CornerDownLeft className="h-4 w-4 text-muted" aria-hidden /><span className="text-muted">{t('search.seeAll', { q: it.label })}</span></>)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
