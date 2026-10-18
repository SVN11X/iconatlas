import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BadgeCheck, Clipboard, Code2, Copy, Download, ExternalLink, FileImage, Lock, Minus, Plus, Star, X } from 'lucide-react';
import type { Icon, IconDetail as Detail, SvgData } from '../../types/catalog';
import { FLAG_LEGACY, FLAG_OFFICIAL } from '../../types/catalog';
import { useCatalog } from '../../app/CatalogContext';
import { STYLE_LABELS, useI18n } from '../../app/i18n';
import { getDetails, getSvgData, isDownloadable, isMono } from '../../services/catalog/catalogStore';
import { buildSvg, customizationFor, defaultColor, isValidColor, svgToDataUri } from '../../services/export/svg';
import { PNG_SIZES, MAX_PNG_SIDE } from '../../services/export/png';
import { canCopyImage } from '../../services/clipboard/clipboard';
import { useIconActions } from '../../hooks/useIconActions';
import { useFavorites } from '../../services/storage/favorites';
import { exportPrefsStore, useExportPrefs, useTheme } from '../../services/storage/prefs';
import { previewColor } from '../../hooks/useIconPreview';
import { IconImage } from '../icons/IconImage';

type BgMode = 'checker' | 'white' | 'black' | 'custom';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(7rem,38%)_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-border bg-bg p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-ring ${value === o.value ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function IconDetail({ id, onClose, onOpen }: { id: string; onClose: () => void; onOpen: (id: string) => void }) {
  const { catalog } = useCatalog();
  const { t, lang, fmt } = useI18n();
  const icon = catalog?.byId.get(id) ?? null;
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Gestión del foco: guardar/restaurar, Escape y trampa de tabulación
  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab' && dialogRef.current) {
        const f = dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [onClose]);

  useEffect(() => { dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus(); }, [id]);

  return (
    <div className="fixed inset-0 z-[60]" role="presentation">
      <div className="absolute inset-0 bg-black/45 animate-fade-in" onClick={onClose} aria-hidden />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="detail-title" data-testid="icon-detail"
        className="absolute inset-y-0 right-0 flex w-full max-w-[980px] flex-col bg-bg shadow-pop animate-slide-left sm:border-l sm:border-border">
        {!icon ? (
          <div className="flex items-center justify-between p-4">
            <p>{t('detail.notFound')}</p>
            <button className="icon-btn" onClick={onClose} aria-label={t('detail.close')} data-autofocus><X className="h-5 w-5" /></button>
          </div>
        ) : (
          <DetailBody icon={icon} onClose={onClose} onOpen={onOpen} t={t} lang={lang} fmt={fmt} />
        )}
      </div>
    </div>
  );
}

function DetailBody({ icon, onClose, onOpen, t, lang, fmt }: { icon: Icon; onClose: () => void; onOpen: (id: string) => void; t: ReturnType<typeof useI18n>['t']; lang: 'es' | 'en'; fmt: (n: number) => string }) {
  const { catalog } = useCatalog();
  const theme = useTheme();
  const prefs = useExportPrefs();
  const actions = useIconActions();
  const favs = useFavorites();
  const fav = favs.includes(icon.id);
  const downloadable = isDownloadable(icon);
  const policy = customizationFor(icon);
  const mono = isMono(icon);
  const coll = icon.collection;
  const provider = catalog?.providers.get(icon.provider);
  const category = catalog?.categories.get(icon.category);

  const [data, setData] = useState<SvgData | null>(null);
  const [detail, setDetail] = useState<Detail>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bg, setBg] = useState<BgMode>('checker');
  const [customBg, setCustomBg] = useState('#6366f1');
  const [zoom, setZoom] = useState(100);
  const [color, setColor] = useState<string>(defaultColor(icon));
  const [padding, setPadding] = useState(0);
  const [exportBg, setExportBg] = useState<'transparent' | 'white' | 'black' | 'custom'>(prefs.background ? (prefs.background === '#ffffff' ? 'white' : prefs.background === '#000000' ? 'black' : 'custom') : 'transparent');
  const [exportCustom, setExportCustom] = useState(prefs.background && !['#ffffff', '#000000'].includes(prefs.background) ? prefs.background : '#ffffff');
  const [size, setSize] = useState<number | 'custom'>(PNG_SIZES.includes(prefs.pngSize as (typeof PNG_SIZES)[number]) ? prefs.pngSize : 'custom');
  const [cw, setCw] = useState(prefs.pngSize || 1200);
  const [ch, setCh] = useState(prefs.pngSize || 630);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    setData(null); setLoadError(null); setColor(defaultColor(icon)); setPadding(0); setZoom(100);
    let alive = true;
    getDetails(icon).then((d) => alive && setDetail(d)).catch(() => alive && setDetail({}));
    if (icon.shard >= 0) getSvgData(icon).then((d) => alive && setData(d)).catch((e: Error) => alive && setLoadError(e.message));
    return () => { alive = false; };
  }, [icon]);

  const exportBackground = exportBg === 'transparent' ? null : exportBg === 'white' ? '#ffffff' : exportBg === 'black' ? '#000000' : isValidColor(exportCustom) ? exportCustom : null;
  const svgOpts = { color: policy.freeColor || policy.presetColors.length ? color : null, padding, background: null as string | null };
  const pngOpts = size === 'custom' ? { width: Math.min(MAX_PNG_SIDE, Math.max(1, cw)), height: Math.min(MAX_PNG_SIDE, Math.max(1, ch)), background: exportBackground } : { size, background: exportBackground };

  // Vista previa con el color de exportación si se ha personalizado; si no, legible según el tema
  const previewUri = useMemo(() => {
    if (!data) return null;
    try {
      let c: string | null = null;
      if (mono) {
        const unchanged = color === defaultColor(icon);
        if (!unchanged && (policy.freeColor || policy.presetColors.length)) c = color;
        else if (bg === 'white') c = defaultColor(icon);
        else if (bg === 'black') c = policy.freeColor ? '#ffffff' : previewColor(icon, 'dark');
        else c = previewColor(icon, theme);
      }
      return svgToDataUri(buildSvg(icon, data, { color: c, padding }));
    } catch (e) { console.warn(`[IconAtlas] ${icon.id}: ${(e as Error).message}`); return null; }
  }, [data, icon, color, padding, mono, policy.freeColor, policy.presetColors.length, theme, bg]);

  const svgCode = useMemo(() => {
    if (!data) return '';
    try { return buildSvg(icon, data, svgOpts); } catch (e) { return `<!-- ${(e as Error).message} -->`; }
  }, [data, icon, svgOpts.color, svgOpts.padding]); // eslint-disable-line react-hooks/exhaustive-deps

  const variants = useMemo(() => catalog ? catalog.icons.filter((i) => i.collection === coll && i.group === icon.group && i.id !== icon.id).slice(0, 24) : [], [catalog, coll, icon]);
  const related = useMemo(() => {
    if (!catalog) return [];
    const key = icon.title.toLowerCase();
    const out: Icon[] = [];
    for (const i of catalog.icons) {
      if (i.collection !== coll && i.title.toLowerCase() === key) { out.push(i); if (out.length >= 12) break; }
    }
    return out;
  }, [catalog, icon, coll]);
  const alternatives = (detail.alternatives ?? []).map((a) => catalog?.byId.get(a)).filter((x): x is Icon => !!x);

  const bgStyle: React.CSSProperties = bg === 'white' ? { background: '#ffffff' } : bg === 'black' ? { background: '#000000' } : bg === 'custom' ? { background: customBg } : {};
  const perm = (v: boolean | string) => v === true || v === 'yes' ? t('detail.yes') : v === 'unverified' ? t('detail.unverified') : t('detail.no');
  const official = (icon.flags & FLAG_OFFICIAL) === FLAG_OFFICIAL;
  const sourceUrl = detail.sourceUrl ?? coll.sourceUrl ?? coll.homepage;
  const imageClipboard = canCopyImage();

  return (
    <>
      <div className="flex items-start gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="detail-title" className="truncate text-lg font-semibold tracking-tight">{icon.title}</h2>
            {official && <span className="chip border-accent/30 text-accent"><BadgeCheck className="h-3 w-3" aria-hidden />{t('card.official')}</span>}
            {(icon.flags & FLAG_LEGACY) === FLAG_LEGACY && <span className="chip">{t('detail.legacy')}</span>}
          </div>
          <p className="truncate text-sm text-muted">{provider && icon.provider !== 'community' ? `${provider.name} · ` : ''}{coll.name} · {category?.labels[lang]}</p>
        </div>
        <button className="icon-btn" onClick={() => actions.favorite(icon)} aria-pressed={fav} aria-label={fav ? t('card.unfavorite') : t('card.favorite')} data-testid="detail-favorite">
          <Star className={`h-5 w-5 ${fav ? 'fill-warn text-warn' : ''}`} />
        </button>
        <button className="icon-btn" onClick={onClose} aria-label={t('detail.close')} data-autofocus><X className="h-5 w-5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid gap-6 p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Columna izquierda: vista previa */}
          <div className="space-y-4">
            <div className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-border ${bg === 'checker' ? 'checker' : ''}`} style={bgStyle} aria-label={t('detail.preview')} role="img">
              {icon.shard < 0 ? (
                <div className="flex flex-col items-center gap-3 p-6 text-center">
                  <IconImage icon={icon} className="h-24 w-24 text-3xl" />
                  <p className="max-w-xs text-sm text-muted">{t('detail.externalText')}</p>
                </div>
              ) : previewUri ? (
                <img src={previewUri} alt={icon.title} className="max-h-none object-contain transition-[width,height] duration-150" style={{ width: `${Math.round(zoom * 0.6)}%`, height: `${Math.round(zoom * 0.6)}%` }} data-testid="detail-preview" />
              ) : loadError ? (
                <p className="flex items-center gap-2 text-sm text-danger"><AlertTriangle className="h-4 w-4" />{loadError}</p>
              ) : (
                <span className="h-24 w-24 animate-pulse rounded-xl bg-fg/10" />
              )}
            </div>
            {icon.shard >= 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Segmented label={t('detail.bg')} value={bg} onChange={setBg} options={[
                  { value: 'checker', label: t('detail.bgTransparent') }, { value: 'white', label: t('detail.bgWhite') },
                  { value: 'black', label: t('detail.bgBlack') }, { value: 'custom', label: t('detail.bgCustom') },
                ]} />
                {bg === 'custom' && <input type="color" value={customBg} onChange={(e) => setCustomBg(e.target.value)} aria-label={t('detail.bgCustom')} className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent" />}
                <div className="flex items-center gap-1.5" role="group" aria-label={t('detail.zoom')}>
                  <button className="icon-btn h-8 w-8" onClick={() => setZoom((z) => Math.max(25, z - 25))} aria-label="Reducir zoom"><Minus className="h-4 w-4" /></button>
                  <input type="range" min={25} max={160} step={5} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label={t('detail.zoom')} className="w-24 accent-[rgb(var(--accent))]" />
                  <button className="icon-btn h-8 w-8" onClick={() => setZoom((z) => Math.min(160, z + 25))} aria-label="Aumentar zoom"><Plus className="h-4 w-4" /></button>
                  <span className="w-10 text-right text-xs tabular-nums text-muted">{zoom}%</span>
                </div>
              </div>
            )}

            {variants.length > 0 && (
              <div>
                <h3 className="section-title mb-2">{t('detail.variants')}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {variants.map((v) => (
                    <button key={v.id} onClick={() => onOpen(v.id)} className="flex flex-col items-center gap-1 rounded-lg border border-border bg-surface p-2 hover:border-accent focus-ring" title={`${v.title} (${STYLE_LABELS[v.style]?.[lang] ?? v.style})`}>
                      <IconImage icon={v} className="h-7 w-7" />
                      <span className="text-[10px] text-muted">{STYLE_LABELS[v.style]?.[lang] ?? v.style}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {related.length > 0 && (
              <div>
                <h3 className="section-title mb-2">{t('detail.related')}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {related.map((v) => (
                    <button key={v.id} onClick={() => onOpen(v.id)} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs hover:border-accent focus-ring">
                      <IconImage icon={v} className="h-5 w-5" /><span>{v.collection.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Columna derecha: acciones, personalización, metadatos */}
          <div className="space-y-5">
            {downloadable ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-primary" onClick={() => void actions.downloadPng(icon, pngOpts, svgOpts)} data-testid="detail-download-png"><FileImage className="h-4 w-4" />{t('card.downloadPng')}</button>
                  <button className="btn-secondary" onClick={() => void actions.downloadSvg(icon, svgOpts)} data-testid="detail-download-svg"><Download className="h-4 w-4" />{t('card.downloadSvg')}</button>
                  <button className="btn-secondary" onClick={() => void actions.copyImage(icon, size === 'custom' ? pngOpts : { size: Math.min(size, 2048), background: exportBackground }, svgOpts)} disabled={!imageClipboard} title={imageClipboard ? undefined : t('detail.imageClipboardUnsupported')} data-testid="detail-copy-image"><Clipboard className="h-4 w-4" />{t('card.copyImage')}</button>
                  <button className="btn-secondary" onClick={() => void actions.copySvg(icon, svgOpts)} data-testid="detail-copy-svg"><Code2 className="h-4 w-4" />{t('card.copySvg')}</button>
                  <button className="btn-ghost col-span-2 justify-start" onClick={() => void actions.copyName(icon)}><Copy className="h-4 w-4" />{t('detail.copyName')}: <span className="truncate text-fg">{icon.title}</span></button>
                </div>
                {!imageClipboard && <p className="text-xs text-muted">{t('detail.imageClipboardUnsupported')}</p>}

                <section aria-labelledby="export-h" className="card space-y-3 p-4">
                  <h3 id="export-h" className="text-sm font-semibold">{t('detail.export')}</h3>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted" htmlFor="png-size">{t('detail.size')}</label>
                    <div className="flex flex-wrap gap-2">
                      <select id="png-size" className="input w-auto" value={size} onChange={(e) => { const v = e.target.value === 'custom' ? 'custom' : Number(e.target.value); setSize(v); if (v !== 'custom') exportPrefsStore.set((p) => ({ ...p, pngSize: v })); }} data-testid="png-size">
                        {PNG_SIZES.map((s) => <option key={s} value={s}>{s} × {s}</option>)}
                        <option value="custom">{t('detail.custom')}</option>
                      </select>
                      {size === 'custom' && (
                        <div className="flex items-center gap-1.5">
                          <input type="number" min={1} max={MAX_PNG_SIDE} value={cw} onChange={(e) => setCw(Number(e.target.value))} className="input w-24" aria-label={t('detail.width')} />
                          <span className="text-muted">×</span>
                          <input type="number" min={1} max={MAX_PNG_SIDE} value={ch} onChange={(e) => setCh(Number(e.target.value))} className="input w-24" aria-label={t('detail.height')} />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted">{t('detail.pngNote')}</p>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs text-muted" id="export-bg-l">{t('zip.background')}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Segmented label={t('zip.background')} value={exportBg} onChange={(v) => { setExportBg(v); exportPrefsStore.set((p) => ({ ...p, background: v === 'transparent' ? null : v === 'white' ? '#ffffff' : v === 'black' ? '#000000' : exportCustom })); }} options={[
                        { value: 'transparent', label: t('detail.bgTransparent') }, { value: 'white', label: t('detail.bgWhite') }, { value: 'black', label: t('detail.bgBlack') }, { value: 'custom', label: t('detail.bgCustom') },
                      ]} />
                      {exportBg === 'custom' && <input type="color" value={exportCustom} onChange={(e) => { setExportCustom(e.target.value); exportPrefsStore.set((p) => ({ ...p, background: e.target.value })); }} aria-label={t('detail.bgCustom')} className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent" />}
                    </div>
                  </div>
                </section>

                <section aria-labelledby="custom-h" className="card space-y-3 p-4">
                  <h3 id="custom-h" className="flex items-center gap-2 text-sm font-semibold">{t('detail.customize')}{policy.locked && !policy.presetColors.length && <Lock className="h-3.5 w-3.5 text-muted" aria-hidden />}</h3>
                  <p className="text-xs text-muted">{policy.freeColor ? t('detail.free') : policy.presetColors.length ? t('detail.brandMono') : t('detail.locked')}</p>
                  {policy.freeColor && (
                    <div className="flex items-center gap-2">
                      <label htmlFor="icon-color" className="w-20 text-xs text-muted">{t('detail.color')}</label>
                      <input id="icon-color" type="color" value={color.length === 7 ? color : '#000000'} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent" />
                      <input type="text" value={color} onChange={(e) => setColor(e.target.value)} className="input w-28 font-mono" aria-label={`${t('detail.color')} (hex)`} aria-invalid={!isValidColor(color)} />
                      {['#000000', '#ffffff', '#4f46e5', '#0ea5e9', '#16a34a', '#dc2626'].map((c) => (
                        <button key={c} className="h-6 w-6 rounded-full border border-border focus-ring" style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
                      ))}
                    </div>
                  )}
                  {policy.presetColors.length > 0 && (
                    <div className="flex items-center gap-2" role="radiogroup" aria-label={t('detail.color')}>
                      <span className="w-20 text-xs text-muted">{t('detail.color')}</span>
                      {policy.presetColors.map((c) => (
                        <button key={c} role="radio" aria-checked={color === c} className={`h-7 w-7 rounded-full border-2 focus-ring ${color === c ? 'border-accent' : 'border-border'}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <label htmlFor="icon-padding" className="w-20 text-xs text-muted">{t('detail.padding')}</label>
                    <input id="icon-padding" type="range" min={0} max={40} value={padding} onChange={(e) => setPadding(Number(e.target.value))} className="flex-1 accent-[rgb(var(--accent))]" />
                    <span className="w-10 text-right text-xs tabular-nums text-muted">{padding}%</span>
                  </div>
                </section>
              </>
            ) : (
              <section className="card space-y-3 border-warn/40 p-4" data-testid="external-panel">
                <h3 className="flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4 text-warn" aria-hidden />{t('detail.externalTitle')}</h3>
                <p className="text-sm text-muted">{coll.terms ?? t('detail.externalText')}</p>
                {sourceUrl && <a className="btn-primary w-full" href={sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />{t('detail.openOfficial')}</a>}
                <button className="btn-ghost w-full justify-start" onClick={() => void actions.copyName(icon)}><Copy className="h-4 w-4" />{t('detail.copyName')}</button>
                {detail.note && <p className="text-xs text-muted"><strong>{t('detail.note')}:</strong> {detail.note}</p>}
                <div>
                  <h4 className="section-title mb-2">{t('detail.alternatives')}</h4>
                  {alternatives.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {alternatives.map((a) => (
                        <button key={a.id} onClick={() => onOpen(a.id)} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs hover:border-accent focus-ring">
                          <IconImage icon={a} className="h-5 w-5" /><span>{a.title} · {a.collection.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : <p className="text-xs text-muted">{t('detail.noAlternatives')}</p>}
                </div>
              </section>
            )}

            <section aria-labelledby="meta-h">
              <h3 id="meta-h" className="section-title mb-1">{t('detail.metadata')}</h3>
              <dl className="divide-y divide-border">
                <Row label={t('detail.name')}>{icon.title}</Row>
                <Row label={t('detail.id')}><code className="font-mono text-xs">{icon.id}</code></Row>
                <Row label={t('detail.provider')}>{provider && icon.provider !== 'community' ? provider.name : '—'}</Row>
                <Row label={t('detail.collection')}>{coll.name}{coll.version ? <span className="text-muted"> · v{coll.version}</span> : null}</Row>
                <Row label={t('detail.category')}>{category?.labels[lang]}{detail.family ? <span className="text-muted"> · {detail.family}</span> : null}</Row>
                <Row label={t('detail.style')}>{STYLE_LABELS[icon.style]?.[lang] ?? icon.style}</Row>
                <Row label={t('detail.format')}>{icon.shard >= 0 ? 'SVG (vector) · PNG (generado)' : '—'}</Row>
                {data && <Row label={t('detail.viewBox')}><code className="font-mono text-xs">{data.viewBox}</code></Row>}
                {icon.hex && <Row label={t('detail.colors')}><span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border border-border" style={{ background: `#${icon.hex}` }} />#{icon.hex}</span></Row>}
                {!icon.hex && detail.colors && detail.colors.length > 0 && <Row label={t('detail.colors')}><span className="flex flex-wrap gap-1">{detail.colors.slice(0, 8).map((c) => <span key={c} className="h-3.5 w-3.5 rounded border border-border" style={{ background: c }} title={c} />)}</span></Row>}
                {mono && !icon.hex && <Row label={t('detail.colors')}>currentColor ({lang === 'es' ? 'monocromo' : 'monochrome'})</Row>}
              </dl>
            </section>

            <section aria-labelledby="lic-h">
              <h3 id="lic-h" className="section-title mb-1">{t('detail.license')}</h3>
              <dl className="divide-y divide-border">
                <Row label={t('detail.license')}>
                  {detail.license ? <a className="text-accent underline-offset-2 hover:underline" href={detail.license.url ?? '#'} target="_blank" rel="noopener noreferrer">{detail.license.type}</a>
                    : <a className="text-accent underline-offset-2 hover:underline" href={coll.license.url} target="_blank" rel="noopener noreferrer">{coll.license.title}</a>}
                </Row>
                <Row label={t('detail.owner')}>{coll.owner ?? provider?.name ?? '—'}</Row>
                <Row label={t('detail.source')}>{sourceUrl ? <a className="text-accent underline-offset-2 hover:underline break-all" href={sourceUrl} target="_blank" rel="noopener noreferrer">{sourceUrl.replace(/^https?:\/\//, '')}</a> : '—'}</Row>
                {detail.guidelines && <Row label="Brand guidelines"><a className="text-accent underline-offset-2 hover:underline break-all" href={detail.guidelines} target="_blank" rel="noopener noreferrer">{detail.guidelines.replace(/^https?:\/\//, '')}</a></Row>}
                <Row label={t('detail.permissions')}>
                  <ul className="space-y-0.5 text-xs">
                    <li>{t('detail.perm.download')}: <strong>{perm(coll.permissions.download)}</strong></li>
                    <li>{t('detail.perm.redistribute')}: <strong>{perm(coll.permissions.redistribute)}</strong></li>
                    <li>{t('detail.perm.modify')}: <strong>{perm(coll.permissions.modify)}</strong></li>
                    <li>{t('detail.perm.commercial')}: <strong>{perm(coll.permissions.commercial)}</strong></li>
                  </ul>
                </Row>
                {coll.attribution && <Row label={t('detail.attribution')}>{coll.attribution}</Row>}
                {coll.restrictions.length > 0 && <Row label={t('detail.restrictions')}><ul className="list-disc space-y-1 pl-4 text-xs">{coll.restrictions.map((r) => <li key={r}>{r}</li>)}</ul></Row>}
                <Row label={t('detail.reviewed')}>{new Date(coll.reviewed).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US')}</Row>
              </dl>
            </section>

            {downloadable && svgCode && (
              <section>
                <button className="section-title flex items-center gap-1 rounded focus-ring" aria-expanded={showCode} onClick={() => setShowCode(!showCode)}>{t('detail.svgCode')} {showCode ? '−' : '+'} <span className="normal-case tracking-normal">({fmt(svgCode.length)} B)</span></button>
                {showCode && <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-border bg-surface p-3 font-mono text-[11px] leading-relaxed text-muted"><code>{svgCode}</code></pre>}
              </section>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
