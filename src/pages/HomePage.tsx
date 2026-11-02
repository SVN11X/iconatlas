import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Boxes, Code2, Database, Download, Layers, MousePointerClick, Network, Search, Server, Shapes, Workflow } from 'lucide-react';
import { useCatalog } from '../app/CatalogContext';
import { useI18n } from '../app/i18n';
import { SearchBox } from '../components/search/SearchBox';
import { IconImage } from '../components/icons/IconImage';
import type { Icon } from '../types/catalog';
import { cloudSourceByProvider, githubSourceCount, uniqueLibraryCount, useGithubCoverage } from '../utils/githubCoverage';

export function HomePage() {
  const { catalog } = useCatalog();
  const { t, fmt, lang } = useI18n();
  const githubCoverage = useGithubCoverage();
  useEffect(() => { document.title = `IconAtlas — ${t('app.tagline')}`; }, [t]);

  const featured = useMemo(() => (catalog ? catalog.index.providers.filter((p) => p.featured).sort((a, b) => (a.featured ?? 0) - (b.featured ?? 0)) : []), [catalog]);
  const others = useMemo(() => (catalog ? catalog.index.providers.filter((p) => !p.featured && p.kind !== 'oss' && p.count > 0).sort((a, b) => b.count - a.count) : []), [catalog]);

  // Muestras reales del catálogo para la cabecera (sin cifras ni iconos inventados)
  const samples: Icon[] = useMemo(() => {
    if (!catalog) return [];
    const ids = ['sap-btp:sap-hana-cloud', 'devicon:kubernetes', 'logos:databricks-icon', 'simple-icons:googlecloud', 'devicon:azure', 'logos:terraform-icon', 'devicon:python', 'logos:docker-icon', 'sap-btp:sap-integration-suite', 'logos:postgresql', 'devicon:react', 'logos:grafana', 'fluent:cloud-24-regular', 'lucide:server', 'tabler:router', 'material-symbols:database'];
    return ids.map((id) => catalog.byId.get(id)).filter((x): x is Icon => !!x);
  }, [catalog]);

  const areas = [
    { to: '/explore', label: t('home.allIcons'), icon: Layers },
    { to: '/explore?category=development', label: lang === 'es' ? 'Desarrollo' : 'Development', icon: Code2 },
    { to: '/explore?category=devops,containers', label: 'DevOps', icon: Workflow },
    { to: '/explore?category=analytics,ai-ml,databases', label: lang === 'es' ? 'Datos e IA' : 'Data & AI', icon: Database },
    { to: '/explore?category=networking', label: lang === 'es' ? 'Redes' : 'Networking', icon: Network },
    { to: '/explore?category=compute,storage', label: lang === 'es' ? 'Infraestructura' : 'Infrastructure', icon: Server },
    { to: `/explore?category=${catalog ? catalog.index.categories.filter((c) => c.group === 'general').map((c) => c.id).join(',') : ''}`, label: lang === 'es' ? 'Iconos generales' : 'General icons', icon: Shapes },
    { to: '/explore?collection=simple-icons,devicon,logos', label: lang === 'es' ? 'Logotipos de marcas' : 'Brand logos', icon: Boxes },
  ];

  return (
    <div>
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(var(--accent)/0.14),transparent_60%)]" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-4 pb-14 pt-14 text-center sm:px-6 sm:pt-20">
          {samples.length > 0 && (
            <div className="mx-auto mb-8 flex max-w-xl flex-wrap justify-center gap-2" aria-hidden>
              {samples.map((s) => (
                <span key={s.id} className={`flex h-10 w-10 items-center justify-center rounded-xl border border-border shadow-card ${s.flags & 1 ? 'bg-surface/80' : 'bg-white'}`}>
                  <IconImage icon={s} className="h-6 w-6" />
                </span>
              ))}
            </div>
          )}
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">{t('app.tagline')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-base text-muted sm:text-lg">{t('app.subtitle')}</p>
          <div className="mt-8"><SearchBox hotkey={false} large /></div>
          {catalog && (
            <dl className="mx-auto mt-10 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-5" data-testid="stats">
              {[
                { k: t('stats.icons'), v: catalog.index.stats.icons, sub: `${fmt(catalog.index.stats.downloadable)} SVG listos para exportar` },
                { k: t('stats.libraries'), v: uniqueLibraryCount(catalog.index.collections.map(c => c.id)), sub: 'Bibliotecas disponibles para explorar'  },
                { k: 'Recursos indexados', v: githubCoverage?.stats.indexedSources ? githubCoverage.stats.indexedAssets : null, sub: githubCoverage ? `${githubCoverage.stats.indexedSources} bibliotecas analizadas` : 'Cargando índice…' },
                { k: t('stats.providers'), v: catalog.index.stats.providers },
                { k: t('stats.categories'), v: catalog.index.stats.categories },
              ].map((s) => (
                <div key={s.k} className="card px-4 py-3 text-left">
                  <dt className="text-xs text-muted">{s.k}</dt>
                  <dd className="text-2xl font-semibold tabular-nums tracking-tight">{s.v === null ? '—' : fmt(s.v)}</dd>
                  {s.sub && <dd className="text-[11px] text-muted">{s.sub}</dd>}
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] space-y-14 px-4 py-12 sm:px-6">
        <section aria-labelledby="areas-h">
          <h2 id="areas-h" className="mb-4 text-lg font-semibold tracking-tight">{t('home.categories')}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {areas.map((a) => (
              <Link key={a.label} to={a.to} className="card group flex items-center gap-3 px-4 py-3 transition-colors hover:border-accent focus-ring">
                <a.icon className="h-5 w-5 text-accent" aria-hidden />
                <span className="flex-1 text-sm font-medium">{a.label}</span>
                <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="prov-h">
          <div className="mb-4 flex items-end justify-between">
            <h2 id="prov-h" className="text-lg font-semibold tracking-tight">{t('home.providers')}</h2>
            <Link to="/collections" className="text-sm text-accent hover:underline">{t('nav.collections')} →</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => {
              const logo = p.logoIcon ? catalog?.byId.get(p.logoIcon) : null;
              const sourceId = cloudSourceByProvider[p.id];
              const remoteCount = sourceId ? githubSourceCount(githubCoverage, sourceId) : null;
              const dest = `/explore?provider=${p.id}${sourceId ? `&remoteSource=${sourceId}` : ''}`;
              return (
                <Link key={p.id} to={dest} className="card group flex items-center gap-4 p-4 transition-colors hover:border-accent focus-ring" data-testid={`provider-card-${p.id}`}>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-white">
                    {logo ? <IconImage icon={logo} className="h-7 w-7" /> : <span className="text-sm font-semibold">{p.name.slice(0, 2)}</span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{p.name}</span>
                    <span className="block text-xs text-muted">
                      {fmt(p.downloadable + (remoteCount ?? 0))} recursos disponibles{p.references ? ` · ${t('home.officialOnly', { n: fmt(p.references) })}` : ''}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              );
            })}
          </div>
          {others.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {others.map((p) => (
                <Link key={p.id} to={`/explore?provider=${p.id}`} className="chip hover:border-accent hover:text-fg focus-ring">{p.name} <span className="tabular-nums">{fmt(p.count)}</span></Link>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="how-h" className="card grid gap-6 p-6 sm:grid-cols-3">
          <h2 id="how-h" className="sr-only">{t('home.howto')}</h2>
          {[{ i: Search, s: t('home.step1') }, { i: MousePointerClick, s: t('home.step2') }, { i: Download, s: t('home.step3') }].map(({ i: I, s }, n) => (
            <div key={n} className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><I className="h-4 w-4" aria-hidden /></span>
              <p className="text-sm"><span className="mr-1 font-semibold">{n + 1}.</span>{s}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
