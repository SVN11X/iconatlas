import { useEffect, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import { IconDetail } from './IconDetail';
import { prepareRemoteAssetDownload } from '../../utils/githubAssetDownload';
import { downloadBlob } from '../../services/export/svg';
import { makeRemoteSvgIcon, remoteSvgToData } from '../../utils/remoteSvgEditor';
import type { RemoteHit } from '../../utils/universalGithubIndex';
import type { Icon, IconDetail as Detail, SvgData } from '../../types/catalog';

/** La fuente permanece alojada en GitHub; la ficha reutiliza el editor local de IconAtlas. */
export function RemoteSvgDetail({ hit, onClose }: { hit: RemoteHit; onClose: () => void }) {
  const [ready, setReady] = useState<{ icon: Icon; svg: SvgData; details: Detail } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setReady(null); setError('');
    prepareRemoteAssetDownload(hit.source.repo, hit.source.sha, hit.asset)
      .then(({ blob }) => blob.text())
      .then(remoteSvgToData)
      .then(svg => {
        const { icon, details } = makeRemoteSvgIcon(hit, svg);
        if (active) setReady({ icon, svg, details });
      })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'No se pudo cargar el SVG.'); });
    return () => { active = false; };
  }, [hit.key, hit.source.repo, hit.source.sha, hit.asset.path]);
  const downloadOriginal = async () => {
    try {
      const output = await prepareRemoteAssetDownload(hit.source.repo, hit.source.sha, hit.asset);
      downloadBlob(output.blob, output.filename);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo descargar el SVG.'); }
  };
  if (ready) return <IconDetail id={ready.icon.id} remote={ready} onClose={onClose} onOpen={() => {}} />;
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={`Preparar editor: ${hit.asset.path}`}>
    <div className="card w-full max-w-md p-5">
      <div className="flex items-center justify-between gap-3"><h2 className="break-all font-semibold">{hit.asset.path}</h2><button type="button" className="icon-btn" aria-label="Cerrar" onClick={onClose}><X className="h-5 w-5"/></button></div>
      {error ? <><p role="alert" className="mt-4 text-sm text-danger">{error}</p>
        <button className="btn-secondary mt-3" type="button" onClick={() => void downloadOriginal()}><Download className="h-4 w-4"/> Descargar SVG original sanitizado</button></> :
        <p role="status" className="mt-4 flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Cargando SVG seguro para editarlo en IconAtlas…</p>}
      <p className="mt-3 text-xs text-muted">El original continúa alojado en {hit.source.repo}.</p>
    </div>
  </div>;
}
