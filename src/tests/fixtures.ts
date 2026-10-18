import type { CollectionInfo, Icon } from '../types/catalog';

export function makeCollection(over: Partial<CollectionInfo> = {}): CollectionInfo {
  return {
    id: 'test', name: 'Test', kind: 'ui', provider: 'community', owner: 'Tester', homepage: 'https://example.org',
    license: { spdx: 'MIT', title: 'MIT', url: 'https://example.org/license' }, official: false,
    permissions: { download: true, redistribute: true, modify: true, commercial: 'yes', attribution: false },
    customization: 'free', restrictions: [], reviewed: '2026-10-18', version: '1.0.0', upstreamVersion: null, count: 1, shards: 1,
    source: { type: 'iconify', package: null }, ...over,
  };
}

export function makeIcon(over: Partial<Icon> = {}): Icon {
  const collection = over.collection ?? makeCollection();
  return {
    idx: 0, id: `${collection.id}:${over.name ?? 'home'}`, name: 'home', title: 'Home', collection, category: 'interface', style: 'outline',
    provider: 'community', shard: 0, flags: 1, tags: [], group: 'home', hex: '', priority: 3, ...over,
  };
}
