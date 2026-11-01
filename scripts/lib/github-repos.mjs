// GitHub REST helpers for source monitoring and discovery. Read-only, no arbitrary URLs.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './catalog-utils.mjs';

export const REGISTRY = join(ROOT, 'src/catalog/github-sources.json');
export const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function loadSources(path = REGISTRY) {
  const data = JSON.parse(readFileSync(path, 'utf8'));
  if (data.schemaVersion !== 1 || !Array.isArray(data.sources)) throw new Error('Registro de repositorios inválido');
  const ids = new Set();
  const repos = new Set();
  for (const s of data.sources) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(s.id) || ids.has(s.id)) throw new Error(`ID de fuente inválido o repetido: ${s.id}`);
    if (!REPO_RE.test(s.repo) || repos.has(s.repo.toLowerCase())) throw new Error(`Repositorio inválido o repetido: ${s.repo}`);
    if (!['watch','approved','paused'].includes(s.status)) throw new Error(`Estado inválido: ${s.id}`);
    if (s.includePaths && (!Array.isArray(s.includePaths) || !s.includePaths.length ||
      s.includePaths.some((path) => typeof path !== 'string' || !path || path.startsWith('/') || path.includes('..') || path.includes('\\'))))
      throw new Error(`Rutas permitidas inválidas: ${s.id}`);
    ids.add(s.id);
    repos.add(s.repo.toLowerCase());
  }
  return data.sources;
}

export async function githubGet(path, { token = process.env.GITHUB_TOKEN, fetcher = fetch } = {}) {
  if (!path.startsWith('/') || path.includes('://')) throw new Error('Ruta de API no válida');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetcher(`https://api.github.com${path}`, {
      signal: ctrl.signal,
      headers: {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'IconAtlas-source-audit',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      const retry = res.headers.get('retry-after');
      throw new Error(`GitHub HTTP ${res.status}${retry ? ` (retry-after: ${retry}s)` : ''}`);
    }
    return await res.json();
  } finally { clearTimeout(timer); }
}

export function contentFormat(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith('.svg')) return 'svg';
  if (lower.endsWith('.excalidrawlib')) return 'excalidrawlib';
  if (/\.(png|webp)$/.test(lower)) return 'raster';
  return null;
}

export function treeSummary(tree) {
  const formats = { svg: 0, raster: 0, excalidrawlib: 0 };
  for (const entry of tree.tree || []) {
    if (entry.type !== 'blob') continue;
    const f = contentFormat(entry.path);
    if (f) formats[f]++;
  }
  return { formats, truncated: !!tree.truncated };
}

export function markdownTable(rows, fields) {
  const safe = (s) => String(s ?? '').replace(/[|\n\r]/g, ' ').slice(0, 250);
  return `| ${fields.join(' | ')} |\n|${fields.map(() => '---').join('|')}|\n` + rows.map((r) => `| ${fields.map((f) => safe(r[f])).join(' | ')} |`).join('\n');
}
