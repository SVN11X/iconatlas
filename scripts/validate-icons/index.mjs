#!/usr/bin/env node
// Valida el catálogo generado en public/catalog. Sale con código 1 si hay errores.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readJson } from '../lib/catalog-utils.mjs';
import { findSvgIssues } from '../lib/svg-safety.mjs';

export function validateCatalog(dir = join(ROOT, 'public/catalog')) {
  const errors = [];
  const warn = [];
  if (!existsSync(join(dir, 'index.json'))) return { errors: ['Falta public/catalog/index.json; ejecuta `npm run catalog`'], warnings: [] };
  const index = readJson(join(dir, 'index.json'));
  const icons = readJson(join(dir, 'icons.json'));
  const F = Object.fromEntries(icons.fields.map((f, i) => [f, i]));
  const collById = new Map(index.collections.map((c) => [c.id, c]));

  // Metadatos obligatorios de colecciones
  for (const c of index.collections) {
    for (const k of ['id', 'name', 'kind', 'provider', 'license', 'permissions', 'reviewed']) if (c[k] == null) errors.push(`${c.id}: falta '${k}'`);
    if (c.license && (!c.license.spdx || !c.license.url)) errors.push(`${c.id}: licencia incompleta`);
    for (const k of ['download', 'redistribute', 'modify', 'commercial', 'attribution']) if (c.permissions?.[k] === undefined) errors.push(`${c.id}: permiso '${k}' sin definir`);
    if (c.kind === 'reference' && (c.permissions.download || c.permissions.redistribute)) errors.push(`${c.id}: una colección solo-enlace no puede permitir descarga`);
    if (c.kind === 'reference' && !c.sourceUrl) errors.push(`${c.id}: falta sourceUrl oficial`);
    if (c.kind !== 'reference' && !c.permissions.redistribute) errors.push(`${c.id}: colección con archivos locales sin permiso de redistribución`);
    if (!index.providers.some((p) => p.id === c.provider)) errors.push(`${c.id}: proveedor desconocido ${c.provider}`);
  }

  // Iconos
  const ids = new Set();
  const shardCache = new Map();
  const nameRe = /^[a-z0-9][a-z0-9-]*$/;
  for (const r of icons.icons) {
    const coll = index.collections[r[F.collection]];
    if (!coll) { errors.push(`Icono ${r[F.name]}: colección inválida`); continue; }
    const id = `${coll.id}:${r[F.name]}`;
    if (ids.has(id)) errors.push(`ID duplicado: ${id}`);
    ids.add(id);
    if (!nameRe.test(r[F.name])) errors.push(`${id}: identificador con caracteres no válidos`);
    if (!r[F.title] || typeof r[F.title] !== 'string') errors.push(`${id}: nombre vacío`);
    if (!index.categories[r[F.category]]) errors.push(`${id}: categoría inexistente`);
    if (!index.styles[r[F.style]]) errors.push(`${id}: estilo inexistente`);
    if (!index.providers[r[F.provider]]) errors.push(`${id}: proveedor inexistente`);
    if (coll.kind === 'reference') {
      if (r[F.shard] !== -1) errors.push(`${id}: ficha solo-enlace con archivo local`);
      continue;
    }
    const shardPath = join(dir, 'svg', coll.id, `${r[F.shard]}.json`);
    if (!shardCache.has(shardPath)) {
      if (!existsSync(shardPath)) { errors.push(`${id}: falta el fragmento ${shardPath}`); shardCache.set(shardPath, {}); continue; }
      shardCache.set(shardPath, JSON.parse(readFileSync(shardPath, 'utf8')));
    }
    const entry = shardCache.get(shardPath)[r[F.name]];
    if (!entry) { errors.push(`${id}: SVG no encontrado en su fragmento`); continue; }
    const [body, viewBox] = entry;
    const vb = String(viewBox).split(' ').map(Number);
    if (vb.length !== 4 || vb.some((n) => !Number.isFinite(n)) || vb[2] <= 0 || vb[3] <= 0) errors.push(`${id}: viewBox inválido (${viewBox})`);
    const issues = findSvgIssues(body);
    if (issues.length) errors.push(`${id}: SVG inseguro: ${issues.join('; ')}`);
  }

  // Duplicados accidentales de título dentro de una misma colección y estilo (aviso)
  const seen = new Map();
  for (const r of icons.icons) {
    const k = `${r[F.collection]}|${r[F.style]}|${String(r[F.title]).toLowerCase()}`;
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  const dupTitles = [...seen.values()].filter((n) => n > 1).length;
  if (dupTitles) warn.push(`${dupTitles} títulos repetidos dentro de una misma colección y estilo (variantes legítimas posibles)`);

  for (const p of index.providers) if (p.logoIcon && !ids.has(p.logoIcon)) errors.push(`Proveedor ${p.id}: logoIcon inexistente ${p.logoIcon}`);
  if (index.stats.icons !== icons.icons.length) errors.push('Las estadísticas no coinciden con el número de iconos');
  return { errors, warnings: warn, total: icons.icons.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t = Date.now();
  const { errors, warnings, total } = validateCatalog();
  warnings.forEach((w) => console.warn('[validate] aviso: ' + w));
  if (errors.length) {
    console.error(`[validate] ${errors.length} errores`);
    errors.slice(0, 50).forEach((e) => console.error('  - ' + e));
    process.exit(1);
  }
  console.log(`[validate] OK: ${total} recursos validados en ${((Date.now() - t) / 1000).toFixed(1)} s`);
}
