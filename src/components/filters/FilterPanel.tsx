import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Catalog } from '../../types/catalog';
import { STYLE_LABELS, useI18n } from '../../app/i18n';
import { activeFilterCount, type Facet, type FilterState } from '../../utils/filters';

interface Props {
  catalog: Catalog;
  filters: FilterState;
  counts: Record<Facet, Map<string, number>>;
  onChange: (f: FilterState) => void;
}

interface Option { value: string; label: string; count: number }

function Section({ title, facet, options, selected, onToggle, initial = 8 }: { title: string; facet: Facet; options: Option[]; selected: string[]; onToggle: (facet: Facet, v: string) => void; initial?: number }) {
  const { t, fmt } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(true);
  const sel = new Set(selected);
  // Las opciones seleccionadas siempre visibles; el resto ordenado por recuento
  const sorted = [...options].sort((a, b) => Number(sel.has(b.value)) - Number(sel.has(a.value)));
  const visible = expanded ? sorted : sorted.slice(0, Math.max(initial, selected.length));
  const id = `facet-${facet}`;
  return (
    <fieldset className="min-w-0 border-b border-border py-3 last:border-0">
      <legend className="w-full">
        <button type="button" className="flex w-full items-center justify-between rounded py-0.5 text-left focus-ring" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
          <span className="section-title">{title}{selected.length > 0 && <span className="ml-1.5 rounded bg-accent/15 px-1 text-accent">{selected.length}</span>}</span>
          <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden />
        </button>
      </legend>
      {open && (
        <div id={id} className="mt-2 space-y-0.5">
          {visible.map((o) => (
            <label key={o.value} className={`flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-fg/5 ${o.count === 0 && !sel.has(o.value) ? 'opacity-50' : ''}`}>
              <input type="checkbox" className="h-4 w-4 rounded border-border accent-[rgb(var(--accent))]" checked={sel.has(o.value)} onChange={() => onToggle(facet, o.value)} />
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              <span className="text-xs tabular-nums text-muted">{fmt(o.count)}</span>
            </label>
          ))}
          {options.length > visible.length || expanded ? (
            options.length > initial && (
              <button type="button" className="mt-1 rounded px-1.5 text-xs font-medium text-accent hover:underline focus-ring" onClick={() => setExpanded(!expanded)}>
                {expanded ? t('filters.less') : `${t('filters.more')} (${options.length - visible.length})`}
              </button>
            )
          ) : null}
        </div>
      )}
    </fieldset>
  );
}

export function FilterPanel({ catalog, filters, counts, onChange }: Props) {
  const { t, lang } = useI18n();
  const toggle = (facet: Facet, v: string) => {
    const cur = filters[facet];
    onChange({ ...filters, [facet]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };
  const opt = (facet: Facet, values: string[], label: (v: string) => string): Option[] =>
    values.map((v) => ({ value: v, label: label(v), count: counts[facet].get(v) ?? 0 })).filter((o) => o.count > 0 || filters[facet].includes(o.value)).sort((a, b) => b.count - a.count);

  const featured = catalog.index.providers.filter((p) => p.featured).sort((a, b) => (a.featured ?? 99) - (b.featured ?? 99)).map((p) => p.id);
  const providerOpts = opt('provider', catalog.index.providers.map((p) => p.id), (v) => (v === 'community' ? (lang === 'es' ? 'Bibliotecas abiertas (genéricos y marcas)' : 'Open libraries (generic & brands)') : catalog.providers.get(v)?.name ?? v))
    .sort((a, b) => {
      const fa = featured.indexOf(a.value), fb = featured.indexOf(b.value);
      if (fa !== -1 || fb !== -1) return (fa === -1 ? 99 : fa) - (fb === -1 ? 99 : fb);
      return b.count - a.count;
    });
  const featureLabels: Record<string, string> = {
    svg: t('feature.svg'), png: t('feature.png'), customizable: t('feature.customizable'), official: t('feature.official'),
    attribution: t('feature.attribution'), commercial: t('feature.commercial'), external: t('feature.external'),
  };

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between pb-1">
        <h2 className="text-sm font-semibold">{t('filters.title')}</h2>
        {activeFilterCount(filters) > 0 && (
          <button type="button" className="rounded text-xs font-medium text-accent hover:underline focus-ring" onClick={() => onChange({ ...filters, provider: [], category: [], style: [], collection: [], feature: [] })}>
            {t('filters.clear')}
          </button>
        )}
      </div>
      <Section title={t('filters.provider')} facet="provider" options={providerOpts} selected={filters.provider} onToggle={toggle} initial={10} />
      <Section title={t('filters.category')} facet="category" options={opt('category', catalog.index.categories.map((c) => c.id), (v) => catalog.categories.get(v)?.labels[lang] ?? v)} selected={filters.category} onToggle={toggle} />
      <Section title={t('filters.style')} facet="style" options={opt('style', catalog.index.styles, (v) => STYLE_LABELS[v]?.[lang] ?? v)} selected={filters.style} onToggle={toggle} />
      <Section title={t('filters.features')} facet="feature" options={opt('feature', ['svg', 'png', 'customizable', 'official', 'attribution', 'commercial', 'external'], (v) => featureLabels[v])} selected={filters.feature} onToggle={toggle} initial={7} />
      <Section title={t('filters.collection')} facet="collection" options={opt('collection', catalog.index.collections.map((c) => c.id), (v) => catalog.collections.get(v)?.name ?? v)} selected={filters.collection} onToggle={toggle} initial={8} />
    </div>
  );
}
