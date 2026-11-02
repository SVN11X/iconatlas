import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, ExternalLink, Loader2, X } from 'lucide-react';
import { RemoteSvgDetail } from '../preview/RemoteSvgDetail';
import { Link } from 'react-router-dom';
import { downloadBlob } from '../../services/export/svg';
import { prepareRemoteAssetDownload } from '../../utils/githubAssetDownload';
import { upstreamImageUrl } from '../../utils/githubSourceGallery';
import { type RemoteHit, type RemoteIndex } from '../../utils/universalGithubIndex';
import registry from '../../catalog/github-sources.json';

/** Forma parte de la página /explore: no es un catálogo paralelo ni requiere salir de IconAtlas. */
export function RemoteGithubResults({ query, sourceId }: { query: string; sourceId?: string }) {
  type SearchResponse = { status: 'loading' | 'ready' | 'missing'; matches: RemoteHit[]; total: number; stats: RemoteIndex['stats'] | null };
  const [remote, setRemote] = useState<SearchResponse>({ status: 'loading', matches: [], total: 0, stats: null });
  const [selected, setSelected] = useState<RemoteHit | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const workerRef = useRef<Worker | null>(null);
  const sequence = useRef(0);

  useEffect(() => {
    const worker = new Worker(new URL('../../workers/universalGithub.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent<SearchResponse & { id: number }>) => {
      if (e.data.id === sequence.current) setRemote(e.data);
    };
    worker.onerror = () => setRemote({ status: 'missing', matches: [], total: 0, stats: null });
    return () => { worker.terminate(); workerRef.current = null; };
  }, []);
  useEffect(() => {
    if (!query.trim() && !sourceId) return;
    sequence.current += 1;
    setRemote({ status: 'loading', matches: [], total: 0, stats: null });
    workerRef.current?.postMessage({ id: sequence.current, query, sourceId });
  }, [query, sourceId]);
  const hits = { matches: remote.matches, total: remote.total };
  const sources = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return registry.sources.filter(s => (sourceId ? s.id === sourceId : terms.length > 0) && (!terms.length || terms.every(t => `${s.name} ${s.repo} ${s.category}`.toLowerCase().includes(t))));
  }, [query, sourceId]);

  const download = async (hit: RemoteHit) => {
    setPending(true); setError('');
    try {
      const output = await prepareRemoteAssetDownload(hit.source.repo, hit.source.sha, hit.asset);
      downloadBlob(output.blob, output.filename);
    } catch (e) { setError(e instanceof Error ? e.message : 'No fue posible descargar este recurso.'); }
    finally { setPending(false); }
  };
  const preview = selected && (selected.asset.kind === 'svg' || selected.asset.kind === 'raster')
    ? upstreamImageUrl(selected.source.repo, selected.source.sha, selected.asset.path) : null;

  if (!query.trim() && !sourceId) return null;
  return (
    <section className="mt-8 border-t border-border pt-6" aria-label="Recursos de todas las bibliotecas GitHub" data-testid="remote-github-results">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-lg font-semibold">{sourceId ? `Recursos de ${registry.sources.find(s => s.id === sourceId)?.name ?? sourceId} en GitHub` : "Recursos de todas las bibliotecas GitHub"}</h2>
          <p className="text-xs text-muted">Iconos alojados en GitHub. Los SVG se abren con el mismo editor y las mismas funciones de exportación de IconAtlas.</p></div>
        <Link className="btn-secondary text-sm" to="/sources">Ver las fuentes registradas</Link>
      </div>
      {remote.status === 'loading' && <p className="mt-4 flex items-center gap-2 text-sm text-muted" role="status"><Loader2 className="h-4 w-4 animate-spin" />Cargando índice universal de fuentes…</p>}
      {remote.status === 'missing' && <p className="mt-4 text-sm text-muted">El índice remoto todavía no está publicado. El próximo despliegue de GitHub Actions lo genera automáticamente; puedes explorar las fuentes registradas mientras tanto.</p>}
      {remote.status === 'ready' && <>
        <p className="mt-3 text-sm text-muted" aria-live="polite">
          {hits.total.toLocaleString('es-CL')} archivos remotos encontrados · {remote.stats?.indexedSources}/{remote.stats?.registeredSources} fuentes indexadas
          {(remote.stats?.failedSources || 0) > 0 || (remote.stats?.partialSources || 0) > 0 ? ' · algunas fuentes incompletas (ver informe)' : ''}
        </p>
        {hits.matches.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {hits.matches.map(hit => {
            const src = (hit.asset.kind === 'svg' || hit.asset.kind === 'raster') ? upstreamImageUrl(hit.source.repo, hit.source.sha, hit.asset.path) : null;
            return <button type="button" key={hit.key} onClick={() => { setSelected(hit); setError(''); }} className="card group min-w-0 p-3 text-left transition-colors hover:border-accent focus-ring" data-testid="remote-github-card">
              <span className="flex h-20 items-center justify-center rounded-lg bg-white p-3">
                {src ? <img src={src} alt="" className="max-h-full max-w-full object-contain" loading="lazy" referrerPolicy="no-referrer" /> : <span className="text-xs font-semibold text-slate-700">{hit.asset.kind === 'library' ? 'Excalidraw' : 'Cursor'}</span>}
              </span>
              <span className="mt-2 block truncate text-xs font-medium" title={hit.asset.path}>{hit.asset.path.split('/').at(-1)}</span>
              <span className="mt-1 block truncate text-[11px] text-muted" title={hit.source.repo}>{hit.source.name}</span>
            </button>;
          })}
        </div>}
        {hits.total > hits.matches.length && <p className="mt-3 text-xs text-muted">Se muestran las {hits.matches.length} coincidencias más relevantes. Precisa tu búsqueda para ver otras.</p>}
        {hits.total === 0 && <p className="mt-3 text-sm text-muted">No hay archivos coincidentes en el índice generado. Algunos repositorios publican iconos mediante fuentes, CSS o componentes que requieren conversión.</p>}
      </>}
      {sources.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{sources.map(s => <Link key={s.id} className="chip hover:border-accent" to={`/sources?source=${encodeURIComponent(s.id)}`}><ExternalLink className="mr-1 inline h-3 w-3" />{s.name}</Link>)}</div>}
      {selected?.asset.kind === 'svg' && <RemoteSvgDetail hit={selected} onClose={() => setSelected(null)} />}
      {selected && selected.asset.kind !== 'svg' && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label={`Archivo ${selected.asset.path}`} onClick={() => setSelected(null)} onKeyDown={e => { if (e.key === 'Escape') setSelected(null); }}>
        <div className="w-full max-w-lg rounded-xl bg-bg p-5" onClick={e => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-all text-sm font-semibold">{selected.asset.path}</h3><p className="text-xs text-muted">{selected.source.repo}</p></div><button type="button" className="icon-btn" onClick={() => setSelected(null)} aria-label="Cerrar"><X className="h-5 w-5" /></button></div>
          <div className="mt-4 flex h-56 items-center justify-center rounded-lg bg-white p-4">{preview ? <img className="max-h-full max-w-full object-contain" src={preview} alt={`Vista previa de ${selected.asset.path}`} /> : <p className="text-sm text-slate-700">Formato: {selected.asset.kind}</p>}</div>
          <p className="mt-3 text-xs text-muted">Archivo solicitado al repositorio original, sin replicarlo en IconAtlas. Verifica sus derechos de uso. Los SVG se sanitizan antes de descargar.</p>
          <button type="button" disabled={pending} className="btn-primary mt-4 inline-flex items-center gap-2" onClick={() => void download(selected)}><Download className="h-4 w-4" />{pending ? 'Descargando…' : 'Descargar recurso'}</button>
          {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
        </div>
      </div>}
    </section>
  );
}
