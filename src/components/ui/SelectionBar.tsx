import { useRef, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import { useCatalog } from '../../app/CatalogContext';
import { useI18n } from '../../app/i18n';
import { selectionStore, useSelection } from '../../services/storage/selection';
import { exportPrefsStore, useExportPrefs } from '../../services/storage/prefs';
import { getSvgData, isDownloadable } from '../../services/catalog/catalogStore';
import { buildSvg, downloadBlob } from '../../services/export/svg';
import { PNG_SIZES, svgToPng } from '../../services/export/png';
import { buildZip, type ZipEntry } from '../../services/export/zip';
import { useToast } from './Toaster';
import type { Icon } from '../../types/catalog';

export function SelectionBar() {
  const selection = useSelection();
  const { catalog } = useCatalog();
  const { t, fmt } = useI18n();
  const [dialog, setDialog] = useState(false);
  if (!catalog || selection.size === 0) return null;
  const icons = [...selection].map((id) => catalog.byId.get(id)).filter((x): x is Icon => !!x);
  const skipped = icons.filter((i) => !isDownloadable(i)).length;
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3" role="region" aria-label={t('selection.mode')}>
        <div className="flex w-full max-w-2xl animate-slide-up items-center gap-2 rounded-xl border border-border bg-elevated px-3 py-2 shadow-pop">
          <span className="text-sm font-medium" aria-live="polite" data-testid="selection-count">{t('selection.count', { n: fmt(selection.size) })}</span>
          {skipped > 0 && <span className="hidden text-xs text-muted sm:inline">· {t('selection.skipped', { n: skipped })}</span>}
          <div className="ml-auto flex items-center gap-1.5">
            <button className="btn-ghost" onClick={() => selectionStore.clear()}><X className="h-4 w-4" /><span className="hidden sm:inline">{t('selection.clear')}</span></button>
            <button className="btn-primary" onClick={() => setDialog(true)} disabled={icons.length === skipped} data-testid="open-zip"><Download className="h-4 w-4" />{t('selection.download')}</button>
          </div>
        </div>
      </div>
      {dialog && <ZipDialog icons={icons.filter(isDownloadable)} skipped={skipped} onClose={() => setDialog(false)} />}
    </>
  );
}

function ZipDialog({ icons, skipped, onClose }: { icons: Icon[]; skipped: number; onClose: () => void }) {
  const { t, fmt } = useI18n();
  const { notify } = useToast();
  const prefs = useExportPrefs();
  const [format, setFormat] = useState(prefs.format);
  const [size, setSize] = useState(prefs.pngSize);
  const [bg, setBg] = useState<string | null>(prefs.background);
  const [progress, setProgress] = useState<{ i: number; n: number } | null>(null);
  const cancel = useRef(false);

  async function generate() {
    exportPrefsStore.set({ format, pngSize: size, background: bg });
    cancel.current = false;
    setProgress({ i: 0, n: icons.length });
    const entries: ZipEntry[] = [];
    try {
      for (let k = 0; k < icons.length; k++) {
        if (cancel.current) { setProgress(null); return; }
        const icon = icons[k];
        const svg = buildSvg(icon, await getSvgData(icon));
        const entry: ZipEntry = { icon };
        if (format !== 'png') entry.svg = svg;
        if (format !== 'svg') entry.png = new Uint8Array(await (await svgToPng(svg, { size, background: bg })).arrayBuffer());
        entries.push(entry);
        if (k % 4 === 0) { setProgress({ i: k + 1, n: icons.length }); await new Promise((r) => setTimeout(r, 0)); }
      }
      const zip = buildZip(entries);
      downloadBlob(new Blob([zip as BlobPart], { type: 'application/zip' }), 'iconatlas-export.zip');
      notify(t('toast.zipReady', { n: entries.length }));
      onClose();
    } catch (e) {
      notify(t('toast.error', { m: (e as Error).message }), 'error');
      setProgress(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-black/45" onClick={() => !progress && onClose()} aria-hidden />
      <div role="dialog" aria-modal="true" aria-labelledby="zip-title" className="relative w-full max-w-md animate-slide-up rounded-t-2xl border border-border bg-bg p-5 shadow-pop sm:rounded-2xl" data-testid="zip-dialog">
        <h2 id="zip-title" className="text-lg font-semibold">{t('zip.title')}</h2>
        <p className="mt-1 text-sm text-muted">{t('selection.count', { n: fmt(icons.length) })}{skipped ? ` · ${t('selection.skipped', { n: skipped })}` : ''}</p>
        <div className="mt-4 space-y-4">
          <fieldset>
            <legend className="mb-1.5 text-xs text-muted">{t('zip.format')}</legend>
            <div className="flex gap-2">
              {(['svg', 'png', 'both'] as const).map((f) => (
                <label key={f} className={`btn-secondary flex-1 cursor-pointer ${format === f ? 'border-accent text-accent' : ''}`}>
                  <input type="radio" name="zip-format" value={f} checked={format === f} onChange={() => setFormat(f)} className="sr-only" />
                  {f === 'both' ? t('zip.both') : f.toUpperCase()}
                </label>
              ))}
            </div>
          </fieldset>
          {format !== 'svg' && (
            <>
              <label className="block">
                <span className="mb-1.5 block text-xs text-muted">{t('detail.size')}</span>
                <select className="input" value={size} onChange={(e) => setSize(Number(e.target.value))} data-testid="zip-size">
                  {PNG_SIZES.map((s) => <option key={s} value={s}>{s} × {s}</option>)}
                </select>
              </label>
              <fieldset>
                <legend className="mb-1.5 text-xs text-muted">{t('zip.background')}</legend>
                <div className="flex flex-wrap items-center gap-2">
                  {[{ v: null, l: t('detail.bgTransparent') }, { v: '#ffffff', l: t('detail.bgWhite') }, { v: '#000000', l: t('detail.bgBlack') }].map((o) => (
                    <button key={o.l} type="button" aria-pressed={bg === o.v} onClick={() => setBg(o.v)} className={`btn-secondary h-8 ${bg === o.v ? 'border-accent text-accent' : ''}`}>{o.l}</button>
                  ))}
                  <input type="color" value={bg && !['#ffffff', '#000000'].includes(bg) ? bg : '#6366f1'} onChange={(e) => setBg(e.target.value)} aria-label={t('detail.bgCustom')} className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent" />
                </div>
              </fieldset>
            </>
          )}
        </div>
        {progress && (
          <div className="mt-4" role="status">
            <div className="h-1.5 overflow-hidden rounded-full bg-fg/10"><div className="h-full bg-accent transition-[width]" style={{ width: `${(progress.i / progress.n) * 100}%` }} /></div>
            <p className="mt-1 text-xs text-muted">{t('zip.progress', { i: progress.i, n: progress.n })}</p>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => (progress ? (cancel.current = true) : onClose())}>{t('zip.cancel')}</button>
          <button className="btn-primary" onClick={generate} disabled={!!progress || icons.length === 0} data-testid="zip-generate">
            {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{t('zip.generate')}
          </button>
        </div>
      </div>
    </div>
  );
}
