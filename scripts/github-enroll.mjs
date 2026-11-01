#!/usr/bin/env node
/** Registra automáticamente repositorios descubiertos como fuentes EN SEGUIMIENTO.
 * No descarga ni publica sus SVG; la redistribución requiere revisión posterior.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, isMainModule } from './lib/catalog-utils.mjs';
import { REPO_RE } from './lib/github-repos.mjs';

const REGISTRY = join(ROOT, 'src/catalog/github-sources.json');
const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 75);
}

/** Idempotente: registrar la misma exploración dos veces no cambia el archivo. */
export function enrollCandidates(registry, discovery) {
  if (registry?.schemaVersion !== 1 || !Array.isArray(registry.sources)) throw new Error('Registro inválido');
  if (!Array.isArray(discovery?.candidates)) throw new Error('Informe de descubrimiento inválido');
  const result = structuredClone(registry);
  const known = new Set(result.sources.map(s => s.repo.toLowerCase()));
  const ids = new Set(result.sources.map(s => s.id));
  const added = [];
  const ignored = [];
  for (const candidate of discovery.candidates.slice(0, 250)) {
    const repo = String(candidate.repo ?? '');
    if (!REPO_RE.test(repo)) { ignored.push({ repo, why: 'invalid-repo' }); continue; }
    if (known.has(repo.toLowerCase())) { ignored.push({ repo, why: 'already-registered' }); continue; }
    const formats = candidate.formats ?? {};
    const svg = Math.max(0, Number(formats.svg) || 0);
    const libraries = Math.max(0, Number(formats.excalidrawlib) || 0);
    if (!svg && !libraries && !candidate.truncated) { ignored.push({ repo, why: 'no-supported-assets' }); continue; }
    const prefix = slug(repo.replace('/', '-')) || 'source';
    let id = prefix;
    for (let n = 2; ids.has(id) || !SAFE_ID.test(id); n++) id = `${prefix.slice(0, 64)}-${n}`;
    const source = {
      id,
      repo,
      category: libraries && !svg ? 'diagram' : 'ui',
      status: 'watch',
      license: null,
      licenseUrl: null,
      redistributionApproved: false,
      name: repo.split('/')[1],
      candidateLicense: String(candidate.licenseDetected ?? 'unknown').slice(0, 80),
      notes: `Descubierto por GitHub Actions; ${svg} SVG, ${libraries} bibliotecas. Revisar derechos, procedencia y adaptador antes de publicar.`,
    };
    result.sources.push(source);
    added.push(source);
    known.add(repo.toLowerCase()); ids.add(id);
  }
  return { registry: result, added, ignored };
}

if (isMainModule(import.meta.url)) {
  const index = process.argv.indexOf('--from');
  if (index < 0 || !process.argv[index + 1]) {
    console.error('Uso: node scripts/github-enroll.mjs --from github-discovery-report.json');
    process.exit(2);
  }
  const path = process.argv[index + 1];
  const result = enrollCandidates(JSON.parse(readFileSync(REGISTRY, 'utf8')), JSON.parse(readFileSync(path, 'utf8')));
  if (result.added.length) writeFileSync(REGISTRY, JSON.stringify(result.registry, null, 2) + '\n');
  console.log(`[enroll] ${result.added.length} nuevas fuentes en seguimiento; ${result.ignored.length} omitidas`);
  for (const source of result.added) console.log(`[enroll] ${source.repo} -> ${source.id} (watch)`);
}
