import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, CloudDownload, Download, Loader2, Search, ShieldAlert } from 'lucide-react';
import registry from '../catalog/github-sources.json';
import { getAssets, matchSources, REPO_PATTERN, upstreamImageUrl, type RepoAsset, type SourceRecord } from '../utils/githubSourceGallery';
import { useCatalog } from '../app/CatalogContext';
import { downloadBlob } from '../services/export/svg';
import { prepareRemoteAssetDownload } from '../utils/githubAssetDownload';

const sources = registry.sources as SourceRecord[];
type SourceView = { repo: string; branch: string; assets: RepoAsset[]; truncated: boolean };
const CACHE = new Map<string, SourceView>();

async function githubJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: 'application/vnd.github+json' }, signal,
  });
  if (res.status === 403 || res.status === 429) throw new Error('GitHub limitó temporalmente las consultas de este navegador. Intenta más tarde.');
  if (!res.ok) throw new Error(`GitHub respondió HTTP ${res.status}.`);
  return res.json() as Promise<T>;
}

function RepositoryGallery({ source }: { source: SourceRecord }) {
  const [view, setView] = useState<SourceView | null>(CACHE.get(source.repo) ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [visible, setVisible] = useState(48);
  const [selected, setSelected] = useState<RepoAsset | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    setView(CACHE.get(source.repo) ?? null);
    setFilter(''); setSelected(null); setVisible(48); setError(''); setDownloadError('');
  }, [source.repo]);

  useEffect(() => {
    if (view || CACHE.has(source.repo)) return;
    const ctrl = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const meta = await githubJson<{ full_name: string; default_branch: string; archived: boolean }>(`/repos/${source.repo}`, ctrl.signal);
        if (!REPO_PATTERN.test(meta.full_name)) throw new Error('El repositorio respondió con un identificador inválido.');
        const tree = await githubJson<{ tree?: Array<{ path: string; type: string; size?: number }>; truncated?: boolean }>(
          `/repos/${meta.full_name}/git/trees/${encodeURIComponent(meta.default_branch)}?recursive=1`, ctrl.signal);
        const result = { repo: meta.full_name, branch: meta.default_branch, assets: getAssets(tree), truncated: !!tree.truncated };
        CACHE.set(source.repo, result);
        if (!ctrl.signal.aborted) setView(result);
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'No fue posible consultar esta fuente.');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [source.repo, view]);

  const filtered = useMemo(() => (view?.assets ?? []).filter(a => a.path.toLowerCase().includes(filter.trim().toLowerCase())), [view, filter]);
  const activeSrc = view && selected && ['svg', 'raster'].includes(selected.kind) ? upstreamImageUrl(view.repo, view.branch, selected.path) : null;
  const downloadSelected = async () => {
    if (!view || !selected) return;
    setDownloading(true); setDownloadError('');
    try {
      const { blob, filename } = await prepareRemoteAssetDownload(view.repo, view.branch, selected);
      downloadBlob(blob, filename);
    } catch (e) { setDownloadError(e instanceof Error ? e.message : 'No se pudo descargar el archivo.'); }
    finally { setDownloading(false); }
  };

  return (
    <section aria-label={`Archivos de ${source.name}`} className="mt-5 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{source.name}</h2>
          <p className="break-all text-xs text-muted">{source.repo}</p>
        </div>
        <span className="rounded-md border border-border px-2 py-1 text-xs text-muted">{source.redistributionApproved ? 'Importación autorizada' : 'Vista de fuente externa'}</span>
      </div>
      <p className="mt-2 text-xs text-muted">Explora y descarga archivos desde su origen GitHub, sin cambiar de página. La descarga se realiza en tu navegador; revisa los permisos de uso de cada fuente.</p>
      {loading && <p className="mt-4 flex items-center gap-2 text-sm" role="status"><Loader2 className="h-4 w-4 animate-spin"/>Consultando los archivos públicos de GitHub…</p>}
      {error && <p className="mt-4 text-sm text-warn" role="alert">{error}</p>}
      {view && <>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm">{filtered.length.toLocaleString('es-CL')} archivos detectados {view.truncated && <span className="text-warn">(árbol parcial)</span>}</p>
          <label className="ml-auto flex min-w-0 items-center gap-2 rounded-lg border border-border px-2 py-1"><Search className="h-4 w-4 text-muted"/><span className="sr-only">Filtrar archivos</span><input className="min-w-0 bg-transparent text-sm outline-none" value={filter} placeholder="Buscar SVG, imágenes, bibliotecas o cursores" onChange={e => { setFilter(e.target.value); setVisible(48); }}/></label>
        </div>
        {filtered.length > 0 ? <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-8">
          {filtered.slice(0, visible).map(asset => {
            const src = upstreamImageUrl(view.repo, view.branch, asset.path);
            return src && <button type="button" onClick={() => { setSelected(asset); setDownloadError(''); }} key={asset.path} title={asset.path} className="flex min-w-0 flex-col items-center rounded-lg border border-border bg-bg p-2 transition-colors hover:border-accent focus-ring" aria-label={`Previsualizar ${asset.path}`}>
              <span className="flex h-16 w-full items-center justify-center rounded bg-white p-2">{['svg', 'raster'].includes(asset.kind) ? <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="max-h-full max-w-full object-contain" /> : <span className="text-xs font-semibold text-slate-600">{asset.kind === 'library' ? 'Excalidraw' : 'Cursor'}</span>}</span>
              <span className="mt-1 w-full truncate text-[10px] text-muted">{asset.path.split('/').pop()}</span>
            </button>;
          })}
        </div> : <p className="mt-4 text-sm text-muted">No se detectaron archivos de iconos compatibles. Esta fuente podría usar sprites, componentes React, fuentes o un formato que requiere un adaptador.</p>}
        {visible < filtered.length && <button type="button" className="btn-secondary mt-4" onClick={() => setVisible(n => Math.min(n + 48, filtered.length))}>Ver 48 archivos más</button>}
        {selected && view && <div role="dialog" aria-modal="true" aria-label={`Vista previa: ${selected.path}`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-xl rounded-xl bg-bg p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3"><h3 className="break-all text-sm font-semibold">{selected.path}</h3><button className="btn-secondary" onClick={() => setSelected(null)}>Cerrar</button></div>
            <div className="mt-4 flex h-64 items-center justify-center rounded-xl bg-white p-6">{activeSrc ? <img src={activeSrc} alt={`Vista previa de ${selected.path}`} className="max-h-full max-w-full object-contain" /> : <span className="text-sm text-slate-700">Archivo {selected.kind === 'library' ? 'de biblioteca Excalidraw' : 'de cursor'}</span>}</div>
            <p className="mt-3 text-xs text-muted">Archivo descargado directamente desde GitHub. IconAtlas no garantiza derechos de reutilización. Los SVG se someten a sanitización antes de guardar.</p>
            <button type="button" disabled={downloading} className="btn-primary mt-4 inline-flex items-center gap-2" onClick={downloadSelected}><Download className="h-4 w-4"/>{downloading ? 'Descargando…' : `Descargar ${selected.path.split('.').at(-1)?.toUpperCase() || 'archivo'}`}</button>
            {downloadError && <p role="alert" className="mt-2 text-sm text-danger">{downloadError}</p>}
          </div>
        </div>}
      </>}
      <div className="mt-4 flex items-center gap-2 text-xs text-muted"><ShieldAlert className="h-4 w-4 shrink-0"/>Las descargas remotas se solicitan directamente a GitHub. No se incorporan automáticamente al catálogo local ni se concede una licencia sobre marcas o terceros.</div>
    </section>
  );
}

export function GithubSourcesPage() {
  const [params, setParams] = useSearchParams();
  const id = params.get('source');
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? 'all';
  const { catalog } = useCatalog();
  const selected = sources.find(s => s.id === id) ?? null;
  const list = useMemo(() => matchSources(sources, q, category), [q, category]);
  const categories = [...new Set(sources.map(s => s.category))].sort();
  const integrated = new Set(catalog?.index.collections.map(c => c.id) ?? []);
  useEffect(() => { document.title = 'Fuentes GitHub · IconAtlas'; }, []);
  const update = (key: string, value: string) => setParams(p => { const next = new URLSearchParams(p); if (value && value !== 'all') next.set(key, value); else next.delete(key); return next; }, { replace: true });

  return <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
    <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Fuentes GitHub</h1><p className="mt-1 max-w-3xl text-sm text-muted">Explora las {sources.length} fuentes registradas sin abandonar IconAtlas. Vista previa y descarga bajo demanda desde los repositorios públicos; las colecciones integradas también están en el catálogo principal.</p></div><CloudDownload className="h-7 w-7 shrink-0 text-muted" aria-hidden /></div>
    {selected ? <>
      <button className="btn-secondary mt-5 inline-flex items-center gap-2" onClick={() => update('source','')}><ArrowLeft className="h-4 w-4"/> Volver a las fuentes</button>
      {integrated.has(selected.id) && <p className="mt-3 text-sm"><CheckCircle2 className="mr-1 inline h-4 w-4 text-success"/><Link className="font-semibold text-accent hover:underline" to={`/explore?collection=${selected.id}`}>Explorar los iconos integrados de {selected.name}</Link></p>}
      <RepositoryGallery key={selected.id} source={selected}/>
    </> : <>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border px-3 py-2"><Search className="h-4 w-4 text-muted"/><span className="sr-only">Buscar repositorios</span><input className="min-w-0 w-full bg-transparent text-sm outline-none" value={q} placeholder="Buscar biblioteca, autor o categoría" onChange={e => update('q', e.target.value)}/></label>
        <select aria-label="Filtrar por categoría" className="rounded-lg border border-border bg-bg px-3 py-2 text-sm" value={category} onChange={e => update('category',e.target.value)}><option value="all">Todas las categorías</option>{categories.map(c => <option value={c} key={c}>{c}</option>)}</select>
      </div>
      <p className="mt-4 text-sm text-muted">{list.length} repositorios. Selecciona uno para ver sus SVG y PNG directamente aquí.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map(s => <button type="button" key={s.id} className="card min-w-0 p-4 text-left transition-colors hover:border-accent focus-ring" onClick={() => update('source',s.id)}>
          <div className="flex items-start justify-between gap-2"><h2 className="break-words font-semibold">{s.name}</h2><span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">{s.category}</span></div>
          <p className="mt-1 break-all text-xs text-muted">{s.repo}</p>
          <div className="mt-3 text-xs">{integrated.has(s.id) ? <span className="text-success">Iconos ya integrados</span> : <span className="text-muted">Exploración desde el repositorio</span>}</div>
        </button>)}
      </div>
    </>}
  </div>;
}
