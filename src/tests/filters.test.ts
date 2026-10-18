import { applyFilters, facetCounts, parseFilters, writeFilters, EMPTY_FILTERS, hasFeature } from '../utils/filters';
import { makeCollection, makeIcon } from './fixtures';

const ui = makeCollection({ id: 'lucide', name: 'Lucide' });
const ref = makeCollection({ id: 'azure', name: 'Azure', kind: 'reference', provider: 'microsoft', customization: 'none', permissions: { download: false, redistribute: false, modify: false, commercial: 'unverified', attribution: false } });
const icons = [
  makeIcon({ name: 'server', title: 'Server', collection: ui, category: 'compute' }),
  makeIcon({ name: 'home', title: 'Home', collection: ui, category: 'interface', style: 'filled' }),
  makeIcon({ name: 'vm', title: 'Azure Virtual Machines', collection: ref, category: 'compute', provider: 'microsoft', shard: -1, flags: 2, style: 'external' }),
];

describe('filtros', () => {
  it('ida y vuelta por la URL (compartible)', () => {
    const f = { ...EMPTY_FILTERS, q: 'vm', provider: ['microsoft', 'aws'], feature: ['svg'], sort: 'name' as const };
    const p = writeFilters(new URLSearchParams('icon=x:y'), f);
    expect(p.get('icon')).toBe('x:y');
    expect(parseFilters(p)).toEqual(f);
  });
  it('combina filtros', () => {
    expect(applyFilters(icons, { ...EMPTY_FILTERS, category: ['compute'] }).map((i) => i.name)).toEqual(['server', 'vm']);
    expect(applyFilters(icons, { ...EMPTY_FILTERS, category: ['compute'], feature: ['svg'] }).map((i) => i.name)).toEqual(['server']);
    expect(applyFilters(icons, { ...EMPTY_FILTERS, provider: ['microsoft'] }).map((i) => i.name)).toEqual(['vm']);
  });
  it('restricciones de descarga como característica', () => {
    expect(hasFeature(icons[2], 'svg')).toBe(false);
    expect(hasFeature(icons[2], 'external')).toBe(true);
    expect(hasFeature(icons[0], 'customizable')).toBe(true);
  });
  it('recuentos por faceta', () => {
    const c = facetCounts(icons, { ...EMPTY_FILTERS, category: ['compute'] });
    expect(c.category.get('interface')).toBe(1); // la propia faceta no se filtra
    expect(c.collection.get('lucide')).toBe(1);
    expect(c.feature.get('external')).toBe(1);
  });
});
