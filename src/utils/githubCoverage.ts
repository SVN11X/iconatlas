import { useEffect, useState } from 'react';
import registry from '../catalog/github-sources.json';

export interface GithubCoverage {
  generatedAt: string;
  stats: {
    registeredSources: number;
    indexedSources: number;
    partialSources: number;
    failedSources: number;
    indexedAssets: number;
  };
  sources: Array<{ id: string; repo: string; count: number; partial: boolean; error: string }>;
}

/** La cobertura es metadata ligera; NO requiere cargar el índice de casi 400 mil rutas en React. */
let pendingCoverage: Promise<GithubCoverage | null> | null = null;
export function loadGithubCoverage(): Promise<GithubCoverage | null> {
  if (!pendingCoverage) pendingCoverage = fetch(`${import.meta.env.BASE_URL}github-index/report.json`)
    .then(async r => {
      if (!r.ok) return null;
      const value: unknown = await r.json();
      if (!value || typeof value !== 'object') return null;
      const v = value as Partial<GithubCoverage>;
      if (!v.stats || !Array.isArray(v.sources) ||
        !Number.isInteger(v.stats.indexedAssets) ||
        !v.sources.every(s => s && typeof s.id === 'string' && typeof s.repo === 'string' && Number.isInteger(s.count) && s.count >= 0)) return null;
      return v as GithubCoverage;
    }).catch(() => null);
  return pendingCoverage;
}

export function useGithubCoverage(): GithubCoverage | null {
  const [coverage, setCoverage] = useState<GithubCoverage | null>(null);
  useEffect(() => { let active = true; loadGithubCoverage().then(v => { if (active) setCoverage(v); }); return () => { active = false; }; }, []);
  return coverage;
}

export const githubSources = registry.sources;

/** Una biblioteca ya integrada también puede existir como fuente GitHub: contar una sola vez. */
export function uniqueLibraryCount(localIds: readonly string[]): number {
  const all = new Set(localIds);
  for (const source of githubSources) all.add(source.id);
  return all.size;
}

export function githubSourceCount(coverage: GithubCoverage | null, sourceId: string): number | null {
  return coverage?.sources.find(s => s.id === sourceId)?.count ?? null;
}

export const cloudSourceByProvider: Record<string, string> = {
  'google-cloud': 'gcp-awesome',
  aws: 'aws-awesome',
  microsoft: 'azure-jajera',
};
