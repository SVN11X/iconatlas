import { classifyAsset, type RepoAsset } from './githubSourceGallery';

/** Índice de rutas remoto: cada archivo continúa en el GitHub original (no se replica). */
export interface RemoteSource {
  id: string;
  name: string;
  repo: string;
  category: string;
  status: 'watch' | 'approved' | 'paused';
  redistributionApproved: boolean;
  sha: string;
  count: number;
  partial: boolean;
  error: string;
}
export type RemoteRow = [sourceIndex: number, path: string, kind: number, bytes: number];
export interface RemoteIndex {
  version: number;
  generatedAt: string;
  sources: RemoteSource[];
  assets: RemoteRow[];
  stats: { registeredSources: number; indexedSources: number; partialSources: number; failedSources: number; indexedAssets: number };
}
export interface RemoteHit {
  key: string;
  source: RemoteSource;
  asset: RepoAsset;
  score: number;
}

let cached: Promise<RemoteIndex | null> | null = null;
export function loadRemoteIndex(): Promise<RemoteIndex | null> {
  if (!cached) {
    cached = fetch(`${import.meta.env.BASE_URL}github-index/index.json`, { cache: 'force-cache' })
      .then(async (res) => {
        if (!res.ok) return null;
        const data: unknown = await res.json();
        return validateRemoteIndex(data) ? data : null;
      }).catch(() => null);
  }
  return cached;
}

export function validateRemoteIndex(x: unknown): x is RemoteIndex {
  if (!x || typeof x !== 'object') return false;
  const value = x as Partial<RemoteIndex>;
  return value.version === 1 && Array.isArray(value.sources) && Array.isArray(value.assets) &&
    value.sources.every(s => !!s && typeof s.repo === 'string' && /^[\w.-]+\/[\w.-]+$/.test(s.repo) &&
      ( /^[a-f\d]{40}$/i.test(s.sha || '') || (s.sha === '' && !!s.error) )) &&
    value.assets.every(a => Array.isArray(a) && a.length === 4 && Number.isInteger(a[0]) && a[0] >= 0 && a[0] < value.sources!.length &&
      typeof a[1] === 'string' && !!classifyAsset(a[1], a[3] || undefined) && Number.isInteger(a[2]) && a[2] >= 0 && a[2] <= 3 && Number.isFinite(a[3]) && a[3] >= 0);
}

/** Busca en todas las fuentes, priorizando el nombre del archivo frente al nombre de la fuente. */
export function searchRemoteIndex(index: RemoteIndex, query: string, limit = 120, sourceId?: string): { matches: RemoteHit[]; total: number } {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  if (!terms.length && !sourceId) return { matches: [], total: 0 };
  const hits: RemoteHit[] = [];
  let total = 0;
  for (const row of index.assets) {
    const source = index.sources[row[0]];
    if (!source || !source.sha || (sourceId && source.id !== sourceId)) continue;
    const path = row[1];
    const assetKind = classifyAsset(path, row[3] || undefined);
    if (!assetKind) continue;
    const sourceLabel = `${source.name} ${source.repo} ${source.category}`.toLocaleLowerCase();
    const lower = path.toLocaleLowerCase();
    const name = lower.split('/').at(-1) ?? lower;
    if (!terms.every(t => lower.includes(t) || sourceLabel.includes(t))) continue;
    total++;
    const base = name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    const allInName = terms.every(t => base.includes(t));
    const score = (allInName ? 100 : 0) + (base === terms.join(' ') ? 100 : 0) +
      terms.filter(t => name.includes(t)).length * 20 + (row[2] === 0 ? 6 : 0);
    const hit: RemoteHit = { key: `${source.id}:${path}`, source,
      asset: { path, size: row[3] || undefined, kind: assetKind }, score };
    if (hits.length < limit) hits.push(hit);
    else {
      let worst = 0;
      for (let i = 1; i < hits.length; i++) if (hits[i].score < hits[worst].score) worst = i;
      if (score > hits[worst].score) hits[worst] = hit;
    }
  }
  hits.sort((a,b) => b.score - a.score || a.source.name.localeCompare(b.source.name) || a.asset.path.localeCompare(b.asset.path));
  return { matches: hits, total };
}
