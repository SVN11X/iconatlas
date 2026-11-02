import { useEffect, useMemo, useState } from 'react';
import { IconDetail } from './IconDetail';
import { makeRemoteSvgIcon, loadRemoteSvg } from '../../utils/remoteSvgEditor';
import type { RemoteHit } from '../../utils/universalGithubIndex';
import type { Icon, IconDetail as Detail, SvgData } from '../../types/catalog';

type Ready = { icon: Icon; svg: SvgData; details: Detail };
const PREVIEW_SVG: SvgData = { viewBox: '0 0 64 64', body: '' };
/** El panel aparece instantáneamente; la carga de red solo actualiza su contenido. */
export function RemoteSvgDetail({ hit, onClose }: { hit: RemoteHit; onClose: () => void }) {
  const placeholder = useMemo(() => makeRemoteSvgIcon(hit, PREVIEW_SVG), [hit.key, hit.source.repo, hit.source.sha]);
  const [ready, setReady] = useState<Ready | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setReady(null);
    setError('');
    loadRemoteSvg(hit)
      .then(svg => { if (alive) { const item = makeRemoteSvgIcon(hit, svg); setReady({ ...item, svg }); } })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : 'No se pudo cargar este icono.'); });
    return () => { alive = false; };
  }, [hit.key, hit.source.repo, hit.source.sha, hit.asset.path, attempt]);
  const content = ready ?? { ...placeholder, svg: null };
  return <IconDetail key={hit.key} id={content.icon.id} remote={{ ...content, error, onRetry: () => setAttempt(n => n + 1) }} onClose={onClose} onOpen={() => {}} />;
}
