import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ExternalLink, Link2, MinusCircle } from 'lucide-react';
import { useCatalog } from '../app/CatalogContext';
import { useI18n } from '../app/i18n';
import { CatalogStatus } from '../components/ui/CatalogStatus';
import { IconImage } from '../components/icons/IconImage';

export function CollectionsPage() {
  const { catalog } = useCatalog();
  const { t, fmt, lang } = useI18n();
  useEffect(() => { document.title = `${t('collections.title')} · IconAtlas`; }, [t]);
  if (!catalog) return <CatalogStatus />;
  const providers = [...catalog.index.providers].filter((p) => p.id !== 'community').sort((a, b) => (a.featured ?? 99) - (b.featured ?? 99) || b.count - a.count);
  const libs = catalog.index.collections;
  const kindLabel: Record<string, string> = lang === 'es'
    ? { ui: 'Interfaz', brand: 'Marcas', architecture: 'Arquitectura oficial', reference: 'Fichas sin SVG local' }
    : { ui: 'Interface', brand: 'Brands', architecture: 'Official architecture', reference: 'Entries without local SVG' };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('collections.title')}</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">{t('collections.intro')}</p>

      <div className="mt-5 rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold">Todas las fuentes GitHub</h2>
        <p className="mt-1 text-sm text-muted">Explora los repositorios registrados desde IconAtlas, incluidos los que todavía no tienen archivos incorporados al catálogo principal.</p>
        <Link to="/sources" className="btn-secondary mt-3 inline-flex">Abrir explorador de fuentes</Link>
      </div>
      <section className="mt-8" aria-labelledby="libs-h">
        <h2 id="libs-h" className="mb-3 text-lg font-semibold">{t('collections.libraries')}</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-surface text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">{t('detail.collection')}</th>
                <th scope="col" className="px-3 py-2 font-medium">Tipo</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{t('stats.icons')}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t('detail.license')}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t('detail.version')}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t('collections.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {libs.map((c) => (
                <tr key={c.id} className="bg-bg">
                  <td className="px-3 py-2">
                    <Link to={`/explore?collection=${c.id}`} className="font-medium hover:text-accent hover:underline">{c.name}</Link>
                    <div className="text-xs text-muted">{c.owner ?? catalog.providers.get(c.provider)?.name}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{kindLabel[c.kind]}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(c.count)}</td>
                  <td className="px-3 py-2 text-xs"><a href={c.license.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{c.license.title}</a></td>
                  <td className="px-3 py-2 font-mono text-xs text-muted">{c.version ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">
                    {c.kind === 'reference'
                      ? <span className="inline-flex items-center gap-1 text-warn"><Link2 className="h-3.5 w-3.5" aria-hidden />{t('collections.linkOnly')}</span>
                      : <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />{t('collections.integrated')}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="prov-h">
        <h2 id="prov-h" className="mb-3 text-lg font-semibold">{t('stats.providers')}</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {providers.map((p) => {
            const logo = p.logoIcon ? catalog.byId.get(p.logoIcon) : null;
            return (
              <article key={p.id} className="card p-4" aria-labelledby={`p-${p.id}`}>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-white text-zinc-900">
                    {logo ? <IconImage icon={logo} className="h-6 w-6" /> : <span className="text-xs font-semibold">{p.name.slice(0, 2)}</span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 id={`p-${p.id}`} className="font-medium">{p.name}</h3>
                    <p className="text-xs text-muted">
                      {fmt(p.downloadable)} {t('stats.downloadable')}{p.references ? ` · ${t('home.officialOnly', { n: fmt(p.references) })}` : ''}
                    </p>
                  </div>
                  {p.count > 0 && <Link to={`/explore?provider=${p.id}`} className="btn-secondary h-8 text-xs">{t('collections.view')}</Link>}
                </div>
                {p.officialIcons?.length ? (
                  <div className="mt-3">
                    <h4 className="section-title mb-1.5">{t('collections.officialSources')}</h4>
                    <ul className="space-y-2">
                      {p.officialIcons.map((o) => (
                        <li key={o.url} className="rounded-lg border border-border bg-bg p-2.5 text-xs">
                          <div className="flex items-center gap-2">
                            {o.redistributable ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" aria-label={t('collections.integrated')} /> : <Link2 className="h-3.5 w-3.5 shrink-0 text-warn" aria-label={t('collections.linkOnly')} />}
                            <a href={o.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">{o.name}</a>
                            <ExternalLink className="h-3 w-3 text-muted" aria-hidden />
                            <span className="ml-auto shrink-0 text-muted">{o.redistributable ? t('collections.integrated') : t('collections.linkOnly')} · {o.reviewed}</span>
                          </div>
                          <p className="mt-1 text-muted">{o.terms}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><MinusCircle className="h-3.5 w-3.5" aria-hidden />{t('collections.pending')}{p.count ? (lang === 'es' ? ' — logotipos disponibles en bibliotecas abiertas de marcas.' : ' — logos available in open brand libraries.') : ''}</p>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
