import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSources, treeSummary, githubGet } from './github-repos.mjs';
import { checkRepositories } from '../github-health.mjs';
import { discoverRepositories } from '../github-discover.mjs';
import { enrollCandidates } from '../github-enroll.mjs';

test('registro sin repositorios duplicados', () => {
  const sources = loadSources();
  assert.ok(sources.length >= 55);
  assert.equal(new Set(sources.map((s) => s.repo.toLowerCase())).size, sources.length);
  assert.deepEqual(sources.filter((s) => s.redistributionApproved === true).map((s) => s.id).sort(), ['circle-flags','iconoir','mapa-chile-svg']);
  assert.equal(sources.find((s) => s.id === 'unicons')?.redistributionApproved, false);
  const requested = [
    'FabricTools/fabric-icons',
    'vytautas9/fabric-icons',
    'microsoft/PowerBI-Icons',
    'marclelijveld/Power-BI-Icons',
    'astrzala/FabricToolset',
    'kevincobain2000/google-cloud-icons',
  ];
  assert.ok(sources.length >= 77);
  for (const repo of requested) {
    const source = sources.find(s => s.repo.toLowerCase() === repo.toLowerCase());
    assert.ok(source, `Falta la fuente solicitada ${repo}`);
    assert.equal(source.redistributionApproved, false, `${repo}: no atribuir permisos sin verificar`);
  }

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


test('registra descubrimientos sin duplicar ni aprobar redistribución', () => {
  const original = { schemaVersion: 1, sources: [{ id: 'existing', repo: 'org/already', status: 'watch' }] };
  const report = { candidates: [
    { repo: 'org/already', formats: { svg: 10 } },
    { repo: 'new-org/svg-pack', formats: { svg: 40 }, licenseDetected: 'MIT' },
    { repo: 'new-org/drawings', formats: { excalidrawlib: 6 } },
    { repo: 'invalid url', formats: { svg: 5 } },
  ] };
  const first = enrollCandidates(original, report);
  assert.equal(first.added.length, 2);
  assert.equal(first.registry.sources.length, 3);
  assert.ok(first.added.every(s => s.status === 'watch' && s.redistributionApproved === false && s.license === null));
  assert.deepEqual(enrollCandidates(first.registry, report).registry, first.registry);
  assert.equal(original.sources.length, 1);
});
