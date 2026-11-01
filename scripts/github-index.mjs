#!/usr/bin/env node
/** Publica un índice de rutas (no copias de recursos) para las fuentes GitHub registradas.
 * Todos los repositorios participan, incluso los que aún no están autorizados para vendor/.
 * Los recursos se descargan bajo demanda desde GitHub, según sus condiciones de uso.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { loadSources, githubGet } from './lib/github-repos.mjs';
import { ROOT, isMainModule } from './lib/catalog-utils.mjs';

const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const MAX_SUBTREE_REQUESTS = 100;
export const FORMAT_RE = /\.(svg|png|webp|avif|jpe?g|gif|ico|excalidrawlib|cur|ani)$/i;
export const KIND_CODE = { svg: 0, raster: 1, library: 2, cursor: 3 };

export function kindFromPath(path, size) {
  if (typeof path !== 'string' || !path || path.startsWith('/') ||
      path.split('/').some(p => !p || p === '.' || p === '..') || /[\\\u0000-\u001f?#]/.test(path) ||
      (size != null && (!Number.isFinite(size) || size < 1 || size > MAX_ASSET_BYTES))) return null;
  const ext = path.match(FORMAT_RE)?.[1]?.toLowerCase();
  if (!ext) return null;
  if (ext === 'svg') return KIND_CODE.svg;
  if (ext === 'excalidrawlib') return KIND_CODE.library;
  if (ext === 'cur' || ext === 'ani') return KIND_CODE.cursor;
  return KIND_CODE.raster;
}

/** Si GitHub trunca el árbol recursivo, divide por directorios SHA para recuperar los iconos restantes. */
export async function enumerateRepoTree(repo, sha, request, maxRequests = MAX_SUBTREE_REQUESTS) {
  const initial = await request(`/repos/${repo}/git/trees/${sha}?recursive=1`);
  if (!initial.truncated) return { entries: initial.tree ?? [], partial: false, requests: 1 };
  const out = [];
  const pending = [{ prefix: '', sha }];
  let requests = 1;
  while (pending.length && requests < maxRequests) {
    const { prefix, sha: subtreeSha } = pending.shift();
    const subtree = await request(`/repos/${repo}/git/trees/${subtreeSha}`);
    requests++;
    if (subtree.truncated) {
      // No confundir un índice parcial con el árbol completo.
      return { entries: out, partial: true, requests };
    }
    for (const entry of subtree.tree ?? []) {
      const path = prefix + entry.path;
      if (entry.type === 'tree') pending.push({ prefix: `${path}/`, sha: entry.sha });
      else if (entry.type === 'blob') out.push({ path, type: 'blob', size: entry.size });
    }
  }
  return { entries: out, partial: pending.length > 0, requests };
}

export async function createRemoteIndex(sources, request = githubGet, options = {}) {
  const workers = Math.max(1, Math.min(8, options.workers || 5));
  const records = new Array(sources.length);
  const assetsBySource = new Array(sources.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= sources.length) return;
      const source = sources[i];
      const record = { id: source.id, name: source.name, repo: source.repo, category: source.category,
        status: source.status, redistributionApproved: source.redistributionApproved === true,
        sha: '', count: 0, partial: false, error: '' };
      records[i] = record;
      assetsBySource[i] = [];
      try {
        const meta = await request(`/repos/${source.repo}`);
        if (meta.disabled || !meta.default_branch) throw new Error('Repositorio deshabilitado o sin rama principal');
        const commit = await request(`/repos/${source.repo}/commits/${encodeURIComponent(meta.default_branch)}`);
        if (!/^[a-f0-9]{40}$/i.test(commit.sha || '')) throw new Error('Commit SHA no válido');
        record.sha = commit.sha;
        const treeSha = commit.commit?.tree?.sha;
        if (!/^[a-f0-9]{40}$/i.test(treeSha || '')) throw new Error('Tree SHA no válido');
        const tree = await enumerateRepoTree(source.repo, treeSha, request, options.maxRequests || MAX_SUBTREE_REQUESTS);
        record.partial = tree.partial;
        const seen = new Set();
        for (const blob of tree.entries) {
          if (blob.type !== 'blob' || seen.has(blob.path)) continue;
          const kind = kindFromPath(blob.path, blob.size);
          if (kind === null) continue;
          seen.add(blob.path);
          // [sourceIndex, ruta, tipo, bytes]. Los binarios permanecen en GitHub.
          assetsBySource[i].push([i, blob.path, kind, blob.size ?? 0]);
        }
        record.count = assetsBySource[i].length;
      } catch (error) {
        record.error = String(error?.message || error).slice(0, 300);
      }
      options.onProgress?.(record);
    }
  }
  await Promise.all(Array.from({ length: workers }, () => worker()));
  const assets = assetsBySource.flat();
  return { version: 1, generatedAt: new Date().toISOString(),
    sources: records, assets, stats: {
      registeredSources: sources.length, indexedSources: records.filter(s => !s.error).length,
      partialSources: records.filter(s => s.partial).length,
      failedSources: records.filter(s => !!s.error).length, indexedAssets: assets.length,
    } };
}

export function saveRemoteIndex(index, destination) {
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, JSON.stringify(index));
  const report = { generatedAt: index.generatedAt, stats: index.stats,
    sources: index.sources.map(({ id, repo, count, partial, error }) => ({ id, repo, count, partial, error })) };
  const reportPath = join(dirname(destination), 'report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  return reportPath;
}

if (isMainModule(import.meta.url)) {
  const bootstrap = process.argv.includes('--bootstrap');
  const position = process.argv.indexOf('--out');
  const output = position >= 0 ? process.argv[position + 1] : join(ROOT, 'public/github-index/index.json');
  if (!output) { console.error('Uso: npm run github:index -- --out RUTA'); process.exitCode = 2; }
  else {
    const sources = loadSources();
    const index = bootstrap ? { version: 1, generatedAt: new Date().toISOString(),
      sources: sources.map(s => ({ id: s.id, name: s.name, repo: s.repo, category: s.category, status: s.status, redistributionApproved: s.redistributionApproved === true, sha: '', count: 0, partial: false, error: 'Pendiente de sincronización GitHub Actions' })),
      assets: [], stats: { registeredSources: sources.length, indexedSources: 0, partialSources: 0, failedSources: sources.length, indexedAssets: 0 }
    } : await createRemoteIndex(sources, githubGet, {
      onProgress: s => console.log(`[github-index] ${s.repo}: ${s.error ? 'ERROR ' + s.error : `${s.count} archivos${s.partial ? ' (PARCIAL)' : ''}`}`),
    });
    saveRemoteIndex(index, output);
    console.log('[github-index] Resumen:', JSON.stringify(index.stats));
    if (process.env.GITHUB_STEP_SUMMARY) {
      const { appendFileSync } = await import('node:fs');
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Índice GitHub\n${JSON.stringify(index.stats)}\n`);
    }
    // Ningún catálogo vacío se publica como exitoso: GitHub puede estar caído o limitar la API.
    if (!bootstrap && index.stats.indexedAssets === 0) process.exitCode = 1;
  }
}
