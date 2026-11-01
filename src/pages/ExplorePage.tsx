import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckSquare, Loader2, SearchX, SlidersHorizontal, X } from 'lucide-react';
import { useCatalog } from '../app/CatalogContext';
import { useI18n } from '../app/i18n';
import type { Icon } from '../types/catalog';
import { IconGrid } from '../components/icons/IconGrid';
import { FilterPanel } from '../components/filters/FilterPanel';
import { activeFilterCount, applyFilters, EMPTY_FILTERS, facetCounts, parseFilters, writeFilters, type FilterState } from '../utils/filters';
import { selectionStore } from '../services/storage/selection';
import { useToast } from '../components/ui/Toaster';
import { CatalogStatus } from '../components/ui/CatalogStatus';
import { IconCard } from '../components/icons/IconCard';
import { useIconActions } from '../hooks/useIconActions';
import { useOpenIcon } from '../hooks/useOpenIcon';
import { useFavorites } from '../services/storage/favorites';
import { useSelection } from '../services/storage/selection';
import { RemoteGithubResults } from '../components/icons/RemoteGithubResults';

export const MAX_SELECT = 1000;
const KIND_ORDER: Record<string, number> = { architecture: 0, brand: 1, reference: 2, ui: 3 };

export function ExplorePage() {
  const { catalog, search, searchReady } = useCatalog();
  const { t, fmt, lang } = useI18n();
  const { notify } = useToast();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);
  const [hits, setHits] = useState<{ q: string; ids: number[] } | null>(null);
  const [drawer, setDrawer] = useState(false);

  // Orden por defecto: iconos oficiales de arquitectura y marcas primero
  const defaultOrder = useMemo(() => {
    if (!catalog) return [];
    const collOrder = new Map(catalog.index.collections.map((c, i) => [c.id, i]));
    return [...catalog.icons].sort((a, b) =>
      (KIND_ORDER[a.collection.kind] - KIND_ORDER[b.collection.kind]) || (collOrder.get(a.collection.id)! - collOrder.get(b.collection.id)!) || a.title.localeCompare(b.title));
  }, [catalog]);

  useEffect(() => {
    let alive = true;
    const q = filters.q.trim();
    if (!q || !search) { setHits(null); return; }
    search.search(q, 10000).then((ids) => alive && setHits({ q, ids })).catch(() => alive && setHits({ q, ids: [] }));
    return () => { alive = false; };
  }, [filters.q, search]);

  const q = filters.q.trim();
  const waitingSearch = !!q && (!searchReady || !hits || hits.q !== q);

  const base: Icon[] = useMemo(() => {
    if (!catalog) return [];
    if (!q) return defaultOrder;
    if (!hits || hits.q !== q) return [];
    return hits.ids.map((i) => catalog.icons[i]);
  }, [catalog, q, hits, defaultOrder]);

  const results = useMemo(() => applyFilters(base, filters), [base, filters]);
  const counts = useMemo(() => facetCounts(base, filters), [base, filters]);
  const featured = useMemo(() => (q && filters.sort === 'relevance' && results.length > 24 ? results.filter((i) => i.collection.kind !== 'ui').slice(0, 8) : []), [q, results, filters.sort]);

  const update = (f: FilterState) => setParams(writeFilters(params, f), { replace: true });

  const selectAll = () => {
    const ids = results.slice(0, MAX_SELECT).map((i) => i.id);
    selectionStore.addMany(ids);
    if (results.length > MAX_SELECT) notify(t('selection.limit', { n: MAX_SELECT }), 'info');
  };

  const title = useMemo(() => {
    if (!catalog) return t('explore.title');
    if (filters.provider.length === 1 && !q) return catalog.providers.get(filters.provider[0])?.name ?? t('explore.title');
    if (filters.category.length === 1 && !q) return catalog.categories.get(filters.category[0])?.labels[lang] ?? t('explore.title');
    return q ? `«${q}»` : t('explore.title');
  }, [catalog, filters, q, t, lang]);

  useEffect(() => { document.title = `${title} · IconAtlas`; }, [title]);

  if (!catalog) return <CatalogStatus />;
  const nFilters = activeFilterCount(filters);

  return (
    <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-6 sm:px-6">
      <aside className="sticky top-20 hidden max-h-[calc(100vh-6rem)] w-64 shrink-0 overflow-y-auto pr-1 lg:block" aria-label={t('filters.title')}>
        <FilterPanel catalog={catalog} filters={filters} counts={counts} onChange={update} />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t('filters.title')}>
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[85vw] max-w-sm overflow-y-auto bg-bg p-4 shadow-pop animate-slide-left">
            <div className="mb-2 flex justify-end"><button className="icon-btn" onClick={() => setDrawer(false)} aria-label={t('filters.close')} autoFocus><X className="h-5 w-5" /></button></div>
            <FilterPanel catalog={catalog} filters={filters} counts={counts} onChange={update} />
          </div>
        </div>
      )}

      <section className="min-w-0 flex-1" aria-labelledby="explore-title">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="mr-auto min-w-0">
            <h1 id="explore-title" className="truncate text-xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted" aria-live="polite" data-testid="result-count">
              {waitingSearch ? t('search.indexing') : t('explore.count', { n: fmt(results.length) })}
            </p>
          </div>
          <Link to={`/sources${q ? `?q=${encodeURIComponent(q)}` : ''}`} className="btn-secondary" aria-label="Explorar todas las fuentes GitHub">Fuentes GitHub</Link>
          <button className="btn-secondary lg:hidden" onClick={() => setDrawer(true)} aria-label={t('filters.show')}>
            <SlidersHorizontal className="h-4 w-4" />{t('filters.title')}{nFilters > 0 && <span className="rounded bg-accent px-1.5 text-xs text-accent-fg">{nFilters}</span>}
          </button>
          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="hidden sm:inline">{t('explore.sort')}</span>
            <select className="input h-9 w-auto pr-8" value={filters.sort} onChange={(e) => update({ ...filters, sort: e.target.value as FilterState['sort'] })} aria-label={t('explore.sort')}>
              <option value="relevance">{t('sort.relevance')}</option>
              <option value="name">{t('sort.name')}</option>
              <option value="collection">{t('sort.collection')}</option>
            </select>
          </label>
          <button className="btn-secondary" onClick={selectAll} disabled={!results.length} data-testid="select-all">
            <CheckSquare className="h-4 w-4" /><span className="hidden sm:inline">{t('selection.selectAll', { n: fmt(Math.min(results.length, MAX_SELECT)) })}</span>
          </button>
        </div>

        {nFilters > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {(['provider', 'category', 'style', 'collection', 'feature'] as const).flatMap((k) => filters[k].map((v) => (
              <button key={`${k}:${v}`} className="chip hover:border-accent hover:text-fg focus-ring" onClick={() => update({ ...filters, [k]: filters[k].filter((x) => x !== v) })} aria-label={`Quitar filtro ${v}`}>
                {k === 'provider' ? catalog.providers.get(v)?.name ?? v : k === 'category' ? catalog.categories.get(v)?.labels[lang] ?? v : k === 'collection' ? catalog.collections.get(v)?.name ?? v : v}
                <X className="h-3 w-3" aria-hidden />
              </button>
            )))}
          </div>
        )}

        {waitingSearch ? (
          <div className="flex items-center gap-2 py-16 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{t('search.indexing')}</div>
        ) : results.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center" data-testid="empty-state">
            <SearchX className="h-10 w-10 text-muted" aria-hidden />
            <p className="font-medium">{q ? t('search.noResults', { q }) : t('search.noResults', { q: '—' })}</p>
            <p className="max-w-md text-sm text-muted">{t('search.tips')}</p>
            <button className="btn-secondary" onClick={() => setParams(writeFilters(new URLSearchParams(), EMPTY_FILTERS))}>{t('empty.reset')}</button>
          </div>
        ) : (
          <>
            {featured.length > 0 && <FeaturedStrip icons={featured} />}
            {featured.length > 0 && <h2 className="section-title mb-2">{t('search.all')}</h2>}
            <IconGrid icons={results} label={title} />
          </>
        )}
        {q && <RemoteGithubResults query={q} />}
      </section>
    </div>
  );
}

function FeaturedStrip({ icons }: { icons: Icon[] }) {
  const { t } = useI18n();
  const { catalog } = useCatalog();
  const actions = useIconActions();
  const { open } = useOpenIcon();
  const favs = new Set(useFavorites());
  const selection = useSelection();
  return (
    <div className="mb-6">
      <h2 className="section-title mb-2">{t('search.featured')}</h2>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))' }} data-testid="featured">
        {icons.map((icon) => (
          <div key={icon.id} className="h-[154px]">
            <IconCard
              icon={icon}
              idx={-1}
              selected={selection.has(icon.id)}
              favorite={favs.has(icon.id)}
              selectionMode={selection.size > 0}
              providerName={icon.provider !== 'community' ? catalog?.providers.get(icon.provider)?.shortName ?? catalog?.providers.get(icon.provider)?.name : undefined}
              onOpen={(i) => open(i.id)}
              onToggleSelect={(i) => selectionStore.toggle(i.id)}
              onCopySvg={(i) => void actions.copySvg(i)}
              onCopyImage={(i) => void actions.copyImage(i)}
              onDownloadPng={(i) => void actions.downloadPng(i)}
              onDownloadSvg={(i) => void actions.downloadSvg(i)}
              onFavorite={(i) => actions.favorite(i)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
