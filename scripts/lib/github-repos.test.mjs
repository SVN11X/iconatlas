import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSources, treeSummary, githubGet } from './github-repos.mjs';
import { checkRepositories } from '../github-health.mjs';
import { discoverRepositories } from '../github-discover.mjs';

test('registro sin repositorios duplicados', () => {
  const sources = loadSources();
  assert.ok(sources.length >= 15);
  assert.equal(new Set(sources.map((s) => s.repo.toLowerCase())).size, sources.length);
  assert.equal(sources.filter((s) => s.redistributionApproved === true).length, 0);
});

test('resumen de árbol: formatos y truncamiento', () => {
  assert.deepEqual(treeSummary({ truncated: true, tree: [
    { type: 'blob', path: 'a/icon.svg' },
    { type: 'blob', path: 'b/face.png' },
    { type: 'blob', path: 'libraries/design.excalidrawlib' },
    { type: 'tree', path: 'another.svg' },
  ] }), { formats: { svg: 1, raster: 1, excalidrawlib: 1 }, truncated: true });
});

test('auditoría distingue repositorio archivado, inexistente y sano', async () => {
  const sources = [
    { id: 'a', repo: 'org/healthy', status: 'watch' },
    { id: 'b', repo: 'org/archived', status: 'watch' },
    { id: 'c', repo: 'org/missing', status: 'watch' },
  ];
  const client = async (path) => {
    if (path.includes('missing')) throw new Error('HTTP 404');
    if (path.includes('/git/trees/')) return { tree: [{ type: 'blob', path: 'icon.svg' }], truncated: false };
    const repo = path.split('/').slice(2).join('/');
    return { full_name: repo, default_branch: 'main', archived: repo === 'org/archived', disabled: false };
  };
  const r = await checkRepositories(sources, client);
  assert.deepEqual(r.results.map((e) => e.state), ['healthy','archived','error']);
  assert.equal(r.results[0].formats.svg, 1);
});

test('descubridor no propone repositorios ya enlazados y no acepta fuentes sin activos', async () => {
  const client = async (path) => {
    if (path.startsWith('/search')) return { items: [
      { full_name: 'org/already', default_branch: 'main' },
      { full_name: 'org/new', html_url: 'https://github.com/org/new', default_branch: 'main', stargazers_count: 20 },
      { full_name: 'org/empty', html_url: 'https://github.com/org/empty', default_branch: 'main', stargazers_count: 10 },
    ] };
    return path.includes('org/new')
      ? { tree: [{ type: 'blob', path: 'assets/star.svg' }] }
      : { tree: [{ type: 'blob', path: 'README.md' }] };
  };
  const report = await discoverRepositories([{ repo: 'org/already' }], client, ['topic:icons']);
  assert.deepEqual(report.candidates.map((c) => c.repo), ['org/new']);
});

test('cliente GitHub bloquea rutas fuera de API', async () => {
  await assert.rejects(() => githubGet('https://evil.example/'), /Ruta de API/);
});
