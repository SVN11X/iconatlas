import type { Icon } from '../types/catalog';
import { FLAG_MONO, FLAG_OFFICIAL } from '../types/catalog';

export const FEATURES = ['svg', 'png', 'customizable', 'official', 'attribution', 'commercial', 'external'] as const;
export type Feature = (typeof FEATURES)[number];
export type Facet = 'provider' | 'category' | 'style' | 'collection' | 'feature';
export const FACETS: Facet[] = ['provider', 'category', 'style', 'collection', 'feature'];
export type SortMode = 'relevance' | 'name' | 'collection';

export interface FilterState {
  q: string;
  provider: string[];
  category: string[];
  style: string[];
  collection: string[];
  feature: string[];
  sort: SortMode;
}

export const EMPTY_FILTERS: FilterState = { q: '', provider: [], category: [], style: [], collection: [], feature: [], sort: 'relevance' };

const list = (v: string | null) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

export function parseFilters(p: URLSearchParams): FilterState {
  const sort = p.get('sort');
  return {
    q: p.get('q') ?? '',
    provider: list(p.get('provider')),
    category: list(p.get('category')),
    style: list(p.get('style')),
    collection: list(p.get('collection')),
    feature: list(p.get('feature')),
    sort: sort === 'name' || sort === 'collection' ? sort : 'relevance',
  };
}

/** Escribe los filtros en la URL (los demás parámetros, como ?icon=, se conservan). */
export function writeFilters(base: URLSearchParams, f: FilterState): URLSearchParams {
  const p = new URLSearchParams(base);
  const set = (k: string, v: string) => (v ? p.set(k, v) : p.delete(k));
  set('q', f.q.trim());
  for (const k of FACETS) set(k, f[k].join(','));
  set('sort', f.sort === 'relevance' ? '' : f.sort);
  return p;
}

export function hasFeature(icon: Icon, f: string): boolean {
  const c = icon.collection;
  switch (f) {
    case 'svg':
    case 'png':
      return icon.shard >= 0 && c.permissions.download;
    case 'customizable':
      return c.customization === 'free' && (icon.flags & FLAG_MONO) === FLAG_MONO;
    case 'official':
      return (icon.flags & FLAG_OFFICIAL) === FLAG_OFFICIAL;
    case 'attribution':
      return c.permissions.attribution;
    case 'commercial':
      return c.permissions.commercial === 'yes';
    case 'external':
      return icon.shard < 0;
    default:
      return true;
  }
}

export function facetValue(icon: Icon, facet: Exclude<Facet, 'feature'>): string {
  switch (facet) {
    case 'provider': return icon.provider;
    case 'category': return icon.category;
    case 'style': return icon.style;
    case 'collection': return icon.collection.id;
  }
}

/** Devuelve un predicado para el estado de filtros, opcionalmente ignorando una faceta (para contar). */
export function makePredicate(f: FilterState, skip?: Facet) {
  const sets = {
    provider: skip === 'provider' || !f.provider.length ? null : new Set(f.provider),
    category: skip === 'category' || !f.category.length ? null : new Set(f.category),
    style: skip === 'style' || !f.style.length ? null : new Set(f.style),
    collection: skip === 'collection' || !f.collection.length ? null : new Set(f.collection),
  };
  const feats = skip === 'feature' ? [] : f.feature;
  return (icon: Icon) =>
    (!sets.provider || sets.provider.has(icon.provider)) &&
    (!sets.category || sets.category.has(icon.category)) &&
    (!sets.style || sets.style.has(icon.style)) &&
    (!sets.collection || sets.collection.has(icon.collection.id)) &&
    feats.every((x) => hasFeature(icon, x));
}

export function applyFilters(icons: Icon[], f: FilterState): Icon[] {
  const pred = makePredicate(f);
  const out = icons.filter(pred);
  if (f.sort === 'name') out.sort((a, b) => a.title.localeCompare(b.title));
  else if (f.sort === 'collection') out.sort((a, b) => a.collection.name.localeCompare(b.collection.name) || a.title.localeCompare(b.title));
  return out;
}

/** Recuento por faceta (cada faceta se cuenta con el resto de filtros aplicados). */
export function facetCounts(icons: Icon[], f: FilterState): Record<Facet, Map<string, number>> {
  const res = {} as Record<Facet, Map<string, number>>;
  for (const facet of FACETS) {
    const pred = makePredicate(f, facet);
    const m = new Map<string, number>();
    for (const icon of icons) {
      if (!pred(icon)) continue;
      if (facet === 'feature') {
        for (const x of ['svg', 'customizable', 'official', 'attribution', 'commercial', 'external']) if (hasFeature(icon, x)) m.set(x, (m.get(x) ?? 0) + 1);
      } else {
        const v = facetValue(icon, facet);
        m.set(v, (m.get(v) ?? 0) + 1);
      }
    }
    if (facet === 'feature') m.set('png', m.get('svg') ?? 0);
    res[facet] = m;
  }
  return res;
}

export function activeFilterCount(f: FilterState): number {
  return FACETS.reduce((n, k) => n + f[k].length, 0);
}
