import { Clipboard, Code2, Download, FileImage, Star } from 'lucide-react';
import { useI18n } from '../../app/i18n';
import { useIconActions } from '../../hooks/useIconActions';
import { useFavorites } from '../../services/storage/favorites';
import { useExportPrefs } from '../../services/storage/prefs';
import { downloadBlob } from '../../services/export/svg';
import { prepareRemoteAssetDownload } from '../../utils/githubAssetDownload';
import { upstreamImageUrl } from '../../utils/githubSourceGallery';
import { loadRemoteSvg, makeRemoteSvgIcon } from '../../utils/remoteSvgEditor';
import type { RemoteHit } from '../../utils/universalGithubIndex';

/** Igual presentación y acciones de IconCard para archivos alojados en GitHub. */
export function RemoteIconCard({ hit, onOpen }: { hit: RemoteHit; onOpen: () => void }) {
  const { t } = useI18n();
  const prefs = useExportPrefs();
  const favorites = useFavorites();
  const svg = hit.asset.kind === 'svg';
  const icon = makeRemoteSvgIcon(hit, { body: '', viewBox: '0 0 24 24' }).icon;
  const starred = favorites.includes(icon.id);
  const actions = useIconActions(() => loadRemoteSvg(hit));
  const filename = hit.asset.path.split('/').at(-1) || hit.asset.path;
  const title = filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
  const img = svg || hit.asset.kind === 'raster' ? upstreamImageUrl(hit.source.repo, hit.source.sha, hit.asset.path) : null;
  const open = () => { if (svg) void loadRemoteSvg(hit).catch(() => {}); onOpen(); };
  const downloadOther = async () => {
    try { const output = await prepareRemoteAssetDownload(hit.source.repo, hit.source.sha, hit.asset); downloadBlob(output.blob, output.filename); }
    catch { onOpen(); }
  };
  const quick = (label: string, iconEl: React.ReactNode, action: () => void, testId?: string) =>
    <button type="button" title={label} aria-label={label} data-testid={testId}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-fg/10 hover:text-fg focus-ring"
      onClick={e => { e.stopPropagation(); action(); }}>{iconEl}</button>;

  return <div className="group relative flex h-[154px] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-surface transition-[border-color,box-shadow] hover:border-muted/40 hover:shadow-card" data-testid="remote-github-card">
    <button type="button" className="flex min-h-0 flex-1 flex-col items-center gap-2 rounded-xl px-2 pb-2 pt-5 text-center focus-ring" onClick={open} onMouseEnter={() => { if (svg) void loadRemoteSvg(hit).catch(() => {}); }} onFocus={() => { if (svg) void loadRemoteSvg(hit).catch(() => {}); }}>
      <span className="flex h-12 w-full items-center justify-center">
        <span className="flex items-center justify-center transition-transform duration-150 group-hover:scale-110 motion-reduce:transform-none">
          {img ? <img src={img} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-10 w-10 object-contain dark:rounded-lg dark:bg-white dark:p-1" />
            : <span className="text-xs font-medium text-muted">{hit.asset.kind === 'library' ? 'Excalidraw' : hit.asset.kind}</span>}
        </span>
      </span>
      <span className="w-full truncate text-[13px] font-medium leading-tight" title={filename}>{title}</span>
      <span className="w-full truncate text-[11px] leading-tight text-muted" title={hit.source.name}>{hit.source.name}</span>
    </button>
    {starred && <Star className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 fill-warn text-warn" aria-label={t('nav.favorites')} />}
    <div className="card-actions flex items-center justify-center gap-0.5 border-t border-border bg-surface px-1 py-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" role="toolbar" aria-label={`${t('card.actions')}: ${title}`}>
      {svg ? <>
        {quick(t('card.copySvg'), <Code2 className="h-3.5 w-3.5" />, () => void actions.copySvg(icon), 'action-copy-svg')}
        {quick(t('card.copyImage'), <Clipboard className="h-3.5 w-3.5" />, () => void actions.copyImage(icon), 'action-copy-image')}
        {quick(t('card.downloadPng'), <FileImage className="h-3.5 w-3.5" />, () => void actions.downloadPng(icon, { size: prefs.pngSize, background: prefs.background }), 'action-download-png')}
        {quick(t('card.downloadSvg'), <Download className="h-3.5 w-3.5" />, () => void actions.downloadSvg(icon), 'action-download-svg')}
      </> : quick(t('card.downloadSvg'), <Download className="h-3.5 w-3.5" />, () => void downloadOther())}
      {quick(starred ? t('card.unfavorite') : t('card.favorite'), <Star className={`h-3.5 w-3.5 ${starred ? 'fill-warn text-warn' : ''}`} />, () => actions.favorite(icon), 'action-favorite')}
    </div>
  </div>;
}
