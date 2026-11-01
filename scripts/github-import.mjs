#!/usr/bin/env node
/** Importación por demanda de una fuente GitHub previamente aprobada.
 * Descarga un snapshot fijado por commit y reutiliza el importador/sanitizador existente.
 * No ejecuta código de terceros. Nunca importa licencias desconocidas automáticamente.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadSources, githubGet } from './lib/github-repos.mjs';
import { runImport } from './import-icons/index.mjs';
import { ROOT, isMainModule } from './lib/catalog-utils.mjs';

const MAX_ZIP = 75 * 1024 * 1024;
const ALLOWED_SPDX = new Set(['MIT','ISC','Apache-2.0','BSD-2-Clause','BSD-3-Clause','CC0-1.0','CC-BY-4.0','CC-BY-3.0','OFL-1.1','MPL-2.0','Unlicense']);

export function checkApproval(source) {
  if (!source || source.status !== 'approved' || source.redistributionApproved !== true)
    throw new Error('Fuente no aprobada para redistribución. Actualiza github-sources.json solo tras verificar los derechos de todos sus activos.');
  if (!ALLOWED_SPDX.has(source.license) || !/^https:\/\/\S+$/.test(source.licenseUrl || ''))
    throw new Error('Indica licencia SPDX compatible y enlace de licencia verificable antes de importar.');
  return source;
}

async function downloadSnapshot(repo, sha, fetcher = fetch) {
  // repo y sha solo proceden del registro validado y de GitHub API.
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo) || !/^[a-f0-9]{40}$/.test(sha)) throw new Error('Ruta o SHA no válido');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120000);
  try {
    const res = await fetcher(`https://codeload.github.com/${repo}/zip/${sha}`, {
      signal: ctrl.signal, headers: { 'User-Agent': 'IconAtlas-approved-import' }, redirect: 'error',
    });
    if (!res.ok) throw new Error(`GitHub archive HTTP ${res.status}`);
    if (Number(res.headers.get('content-length') ?? 0) > MAX_ZIP) throw new Error('Archivo superior a 75 MiB');
    const parts = []; let size = 0;
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > MAX_ZIP) { ctrl.abort(); throw new Error('Archivo superior a 75 MiB'); }
      parts.push(Buffer.from(chunk));
    }
    return Buffer.concat(parts);
  } finally { clearTimeout(timer); }
}

export async function importGithubSource(source, { client = githubGet, fetcher = fetch, importer = runImport } = {}) {
  checkApproval(source);
  const existingPath = join(ROOT, 'src/catalog/collections', `${source.id}.json`);
  if (existsSync(existingPath)) {
    const existing = JSON.parse(readFileSync(existingPath, 'utf8'));
    if (existing.source?.type !== 'svg-folder' || existing.source?.upstream !== `https://github.com/${source.repo}`)
      throw new Error(`El ID ${source.id} ya pertenece a otra colección; no se sobrescribió.`);
  }
  const meta = await client(`/repos/${source.repo}`);
  if (meta.full_name?.toLowerCase() !== source.repo.toLowerCase() || meta.archived || meta.disabled)
    throw new Error('Repositorio movido, archivado o deshabilitado: requiere revisión');
  const commit = await client(`/repos/${source.repo}/commits/${encodeURIComponent(meta.default_branch)}`);
  const sha = commit.sha;
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('SHA inválido');
  const archive = await downloadSnapshot(source.repo, sha, fetcher);
  const tmp = mkdtempSync(join(tmpdir(), 'iconatlas-github-'));
  try {
    const zip = join(tmp, 'snapshot.zip');
    writeFileSync(zip, archive);
    const result = importer({
      source: zip, id: source.id, name: source.name,
      owner: source.repo.split('/')[0], homepage: `https://github.com/${source.repo}`,
      license: source.license, 'license-url': source.licenseUrl,
      redistributable: 'yes', kind: ['cloud', 'diagram', 'architecture'].includes(source.category) ? 'architecture' : source.category === 'brand' ? 'brand' : 'ui',
      customization: source.category === 'ui' || source.category === 'emoji' || source.category === 'avatar' ? 'free' : 'none',
      commercial: source.commercial || 'unverified',
      ...(source.attribution ? { attribution: source.attribution } : {}),
    });
    if (!result.ok) throw new Error(result.errors.join('; '));
    // Guardar procedencia inmutable para la auditoría del catálogo.
    const defPath = join(ROOT, 'src/catalog/collections', `${source.id}.json`);
    const def = result.def;
    def.source.commit = sha;
    def.source.upstream = `https://github.com/${source.repo}`;
    def.restrictions = [...new Set([...(def.restrictions ?? []), ...(source.restrictions ?? [])])];
    writeFileSync(defPath, JSON.stringify(def, null, 2) + '\n');
    writeFileSync(join(ROOT, 'vendor', source.id, 'SOURCE.json'), JSON.stringify({
      source: `https://github.com/${source.repo}`, commit: sha, owner: source.repo.split('/')[0],
      homepage: `https://github.com/${source.repo}`,
      license: def.license, importedAt: new Date().toISOString(),
    }, null, 2) + '\n');
    return { repo: source.repo, sha, iconCount: result.log.imported.length,
      rejected: result.log.rejected.length, duplicate: result.log.skippedDuplicates.length };
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

if (isMainModule(import.meta.url)) {
  const at = process.argv.indexOf('--id');
  const id = at >= 0 ? process.argv[at + 1] : null;
  if (!id || !/^[a-z0-9-]+$/.test(id)) {
    console.error('Uso: npm run github:import -- --id ID_APROBADO');
    process.exit(2);
  }
  const source = loadSources().find((s) => s.id === id);
  try {
    const result = await importGithubSource(source);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) { console.error(`Importación cancelada: ${e.message}`); process.exitCode = 1; }
}
