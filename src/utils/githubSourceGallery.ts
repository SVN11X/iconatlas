/** Utilidades puras para mostrar fuentes GitHub sin introducir HTML/SVG remoto en el DOM. */
export interface SourceRecord {
  id: string;
  name: string;
  repo: string;
  category: string;
  status: 'watch' | 'approved' | 'paused';
  redistributionApproved: boolean;
  notes?: string;
}
export interface RepoAsset {
  path: string;
  size?: number;
  kind: 'svg' | 'raster' | 'library' | 'cursor';
}

export const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const MAX_ASSET_BYTES = 10 * 1024 * 1024;

export function classifyAsset(path: string, size?: number): RepoAsset['kind'] | null {
  if (!path || path.startsWith('/') || path.split('/').some(s => !s || s === '.' || s === '..') || /[\\\u0000-\u001f?#]/.test(path)) return null;
  if (size !== undefined && (size < 1 || size > MAX_ASSET_BYTES)) return null;
  if (/\.svg$/i.test(path)) return 'svg';
  if (/\.(png|webp|avif|jpe?g|gif|ico)$/i.test(path)) return 'raster';
  if (/\.excalidrawlib$/i.test(path)) return 'library';
  if (/\.(cur|ani)$/i.test(path)) return 'cursor';
  return null;
}

export function getAssets(tree: { tree?: Array<{ path: string; type: string; size?: number }> }, max = 50000): RepoAsset[] {
  const items: RepoAsset[] = [];
  const seen = new Set<string>();
  for (const entry of tree.tree ?? []) {
    if (entry.type !== 'blob') continue;
    const kind = classifyAsset(entry.path, entry.size);
    if (!kind || seen.has(entry.path)) continue;
    seen.add(entry.path);
    items.push({ path: entry.path, size: entry.size, kind });
    if (items.length >= max) break;
  }
  return items.sort((a, b) => a.path.localeCompare(b.path));
}

/** URL sin tokens, sin query y basada exclusivamente en un repositorio validado y una ruta del árbol GitHub. */
export function upstreamImageUrl(repo: string, branch: string, path: string): string | null {
  if (!REPO_PATTERN.test(repo) || !branch || /[?#\\\u0000-\u001f]/.test(branch) || !classifyAsset(path)) return null;
  return `https://raw.githubusercontent.com/${repo}/${branch.split('/').map(encodeURIComponent).join('/')}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export function matchSources<T extends Pick<SourceRecord, 'name' | 'repo' | 'category' | 'notes'>>(sources: readonly T[], query: string, category = 'all'): T[] {
  const q = query.trim().toLocaleLowerCase();
  return sources.filter(s => (category === 'all' || s.category === category) &&
    (!q || `${s.name} ${s.repo} ${s.category} ${s.notes ?? ''}`.toLocaleLowerCase().includes(q)));
}
