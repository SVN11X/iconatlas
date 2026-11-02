import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Search, Star, Trash2 } from 'lucide-react';
import { useCatalog } from '../app/CatalogContext';
import { useI18n } from '../app/i18n';
import { CatalogStatus } from '../components/ui/CatalogStatus';
import { IconGrid } from '../components/icons/IconGrid';
import { removeFavorites, useFavorites } from '../services/storage/favorites';
import { selectionStore, useSelection } from '../services/storage/selection';
import { normalizeText } from '../services/search/engine';
import type { Icon } from '../types/catalog';
import { loadRemoteIndex, type RemoteHit } from '../utils/universalGithubIndex';
import { classifyAsset } from '../utils/githubSourceGallery';
import { RemoteIconCard } from '../components/icons/RemoteIconCard';
import { RemoteSvgDetail } from '../components/preview/RemoteSvgDetail';
import { useNavigate } from 'react-router-dom';

export function FavoritesPage() {
  const { catalog } = useCatalog();
  const { t, fmt } = useI18n();
  const ids = useFavorites();
  const selection = useSelection();
  const [q, setQ] = useState('');
  const [remoteFavorites, setRemoteFavorites] = useState<RemoteHit[]>([]);
  const [selectedRemote, setSelectedRemote] = useState<RemoteHit | null>(null);
  const navigate = useNavigate();
  useEffect(() => { document.title = `${t('fav.title')} · IconAtlas`; }, [t]);

  useEffect(() => {
    const wanted = new Set(ids.filter(id => id.startsWith('github-')));
    if (!wanted.size) { setRemoteFavorites([]); return; }
    let alive = true;
    loadRemoteIndex().then(index => {
      if (!alive || !index) return;
      const hits: RemoteHit[] = [];
      for (const row of index.assets) {
        const source = index.sources[row[0]];
        if (!source || !wanted.has(`github-${source.id}:${row[1]}`)) continue;
        const kind = classifyAsset(row[1], row[3] || undefined);
        if (!kind) continue;
        hits.push({ key: `${source.id}:${row[1]}`, source,
          asset: { path: row[1], kind, size: row[3] }, score: 0 });
      }
      setRemoteFavorites(hits);
    }).catch(() => { if (alive) setRemoteFavorites([]); });
    return () => { alive = false; };
  }, [ids]);
  const filteredRemote = useMemo(() => {
    const nq = normalizeText(q.trim());
    return remoteFavorites.filter(hit => !nq || normalizeText(`${hit.asset.path} ${hit.source.name} ${hit.source.repo}`).includes(nq));
  }, [remoteFavorites, q]);

  const { icons, missing } = useMemo(() => {
    if (!catalog) return { icons: [] as Icon[], missing: 0 };
    const found = ids.map((id) => catalog.byId.get(id)).filter((x): x is Icon => !!x);
    return { icons: found, missing: ids.filter(id => !id.startsWith('github-')).length - found.length };
  }, [catalog, ids]);

  const filtered = useMemo(() => {
    const nq = normalizeText(q.trim());
    if (!nq) return icons;
    return icons.filter((i) => normalizeText(`${i.title} ${i.name} ${i.collection.name} ${i.tags.join(' ')}`).includes(nq));
  }, [icons, q]);

  if (!catalog) return <CatalogStatus />;
  const selectedFavs = filtered.filter((i) => selection.has(i.id)).map((i) => i.id);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold tracking-tight">{t('fav.title')}</h1>
          <p className="text-sm text-muted">{t('explore.count', { n: fmt(filtered.length + filteredRemote.length) })}</p>
        </div>
        {(icons.length > 0 || remoteFavorites.length > 0) && (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input type="search" className="input w-60 pl-9" placeholder={t('fav.search')} aria-label={t('fav.search')} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button className="btn-secondary" onClick={() => selectionStore.addMany(filtered.map((i) => i.id))}><CheckSquare className="h-4 w-4" />{t('selection.selectAll', { n: fmt(filtered.length) })}</button>
            {selectedFavs.length > 0 && (
              <button className="btn-secondary" onClick={() => { removeFavorites(selectedFavs); selectionStore.clear(); }}><Trash2 className="h-4 w-4" />{t('card.unfavorite')} ({selectedFavs.length})</button>
            )}
          </>
        )}
      </div>
      {missing > 0 && <p className="mb-4 text-xs text-muted">{t('fav.missing', { n: missing })}</p>}
      {icons.length === 0 && remoteFavorites.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <Star className="h-10 w-10 text-muted" aria-hidden />
          <p className="font-medium">{t('fav.empty')}</p>
          <p className="max-w-md text-sm text-muted">{t('fav.emptyHint')}</p>
          <Link to="/explore" className="btn-primary">{t('home.browse')}</Link>
        </div>
      ) : (
        <>
          {filtered.length > 0 && <IconGrid icons={filtered} label={t('fav.title')} />}
          {filteredRemote.length > 0 && <div className="mt-3 grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))' }}>
            {filteredRemote.map(hit => <RemoteIconCard key={hit.key} hit={hit} onOpen={() => {
              if (hit.asset.kind === 'svg') setSelectedRemote(hit);
              else navigate(`/sources?source=${encodeURIComponent(hit.source.id)}`);
            }} />)}
          </div>}
        </>
      )}
      {selectedRemote && <RemoteSvgDetail key={selectedRemote.key} hit={selectedRemote} onClose={() => setSelectedRemote(null)}/>}
    </div>
  );
}
