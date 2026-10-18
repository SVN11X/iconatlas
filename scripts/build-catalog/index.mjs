#!/usr/bin/env node
// Construye el catálogo estático de IconAtlas a partir de:
//  - src/catalog/collections/*.json  (colecciones con recursos descargables)
//  - src/catalog/manifests/reference/*.json (fichas oficiales solo-enlace)
//  - src/catalog/providers/providers.json, src/catalog/schemas/*.json
// Salida: public/catalog/{index.json, icons.json, details/*.json, svg/<colección>/<n>.json, report.json}
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, readJson, listJson, humanize, splitStyle, createClassifier, detectPalette, slugify, normalize } from '../lib/catalog-utils.mjs';
import { findSvgIssues, sanitizeSvgDocument, splitSvg } from '../lib/svg-safety.mjs';

const require = createRequire(import.meta.url);
const OUT = join(ROOT, 'public/catalog');
const SHARD_SIZE = 400;
const args = new Set(process.argv.slice(2));

if (args.has('--if-missing') && existsSync(join(OUT, 'index.json'))) {
  console.log('[catalog] public/catalog ya existe; omitiendo (usa `npm run catalog` para regenerar).');
  process.exit(0);
}

const t0 = Date.now();
const taxonomy = readJson(join(ROOT, 'src/catalog/schemas/taxonomy.json'));
const synonyms = readJson(join(ROOT, 'src/catalog/schemas/synonyms.json'));
const { providers } = readJson(join(ROOT, 'src/catalog/providers/providers.json'));
const classify = createClassifier(taxonomy);
const titleOverrides = readJson(join(ROOT, 'src/catalog/schemas/title-overrides.json')).titles;
const categoryIds = taxonomy.categories.map((c) => c.id);
const providerIds = providers.map((p) => p.id);
const brandMatchers = providers.filter((p) => p.match).map((p) => ({ id: p.id, re: new RegExp(p.match) }));

const collectionDefs = listJson(join(ROOT, 'src/catalog/collections')).map(readJson);
const referenceDefs = listJson(join(ROOT, 'src/catalog/manifests/reference')).map(readJson);

const report = { generatedAt: new Date().toISOString(), collections: [], errors: [], warnings: [] };
const STYLE_ORDER = ['original', 'multicolor', 'monochrome', 'outline', 'filled', 'duotone', 'rounded', 'sharp', 'thin', 'light', 'bold', 'wordmark', 'external'];

// --- Fuentes --------------------------------------------------------------

function loadIconify(def) {
  // Paquete npm (@iconify-json/*) o archivo IconifyJSON local importado (source.path)
  const fromFile = def.source.type === 'iconify-file';
  const pkgDir = fromFile ? null : join(ROOT, 'node_modules', def.source.package);
  const json = fromFile ? readJson(join(ROOT, def.source.path)) : readJson(join(pkgDir, 'icons.json'));
  const info = fromFile ? json.info || {} : readJson(join(pkgDir, 'info.json'));
  const pkg = fromFile ? { version: def.source.version || info.version || null } : readJson(join(pkgDir, 'package.json'));
  let meta = {};
  if (!fromFile) { try { meta = readJson(join(pkgDir, 'metadata.json')); } catch { /* opcional */ } }
  const catOf = new Map();
  for (const [cat, names] of Object.entries(meta.categories || {})) for (const n of names) if (!catOf.has(n)) catOf.set(n, cat);
  const include = def.source.include ? new RegExp(def.source.include) : null;
  const exclude = def.source.exclude ? new RegExp(def.source.exclude) : null;
  const aliasesOf = new Map();
  for (const [alias, a] of Object.entries(json.aliases || {})) {
    if (a.parent && json.icons[a.parent] && Object.keys(a).length === 1) {
      if (!aliasesOf.has(a.parent)) aliasesOf.set(a.parent, []);
      aliasesOf.get(a.parent).push(alias);
    }
  }
  const W = json.width || 16, H = json.height || 16;
  const out = [];
  let skipped = 0;
  for (const [name, icon] of Object.entries(json.icons)) {
    if (icon.hidden) { skipped++; continue; }
    if (include && !include.test(name)) continue;
    if (exclude && exclude.test(name)) { skipped++; continue; }
    const w = icon.width || W, h = icon.height || H;
    const viewBox = `${icon.left || 0} ${icon.top || 0} ${w} ${h}`;
    out.push({ name, body: icon.body, viewBox, sourceCategory: catOf.get(name), aliases: aliasesOf.get(name) || [] });
  }
  return { icons: out, version: pkg.version, upstreamVersion: info.version || null, skipped };
}

function loadUi5(def) {
  const dir = join(ROOT, 'node_modules', def.source.package, def.source.dir);
  const pkg = readJson(join(ROOT, 'node_modules', def.source.package, 'package.json'));
  const out = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js')).sort()) {
    const src = readFileSync(join(dir, f), 'utf8');
    const name = (src.match(/const name = "([^"]+)"/) || [])[1];
    const pathData = (src.match(/const pathData = "([^"]+)"/) || [])[1];
    const viewBox = (src.match(/const viewBox = "([^"]+)"/) || [])[1] || '0 0 16 16';
    if (!name || !pathData) continue;
    out.push({ name: slugify(name), body: `<path d="${pathData}"/>`, viewBox, aliases: [], ltr: /const ltr = true/.test(src) });
  }
  return { icons: out, version: pkg.version, upstreamVersion: pkg.version, skipped: 0 };
}

function loadSvgFolder(def) {
  const dir = join(ROOT, def.source.path);
  const strip = def.source.strip ? new RegExp(def.source.strip, 'g') : null;
  const out = [];
  const seen = new Set();
  for (const f of readdirSync(dir).filter((x) => x.toLowerCase().endsWith('.svg')).sort()) {
    const raw = readFileSync(join(dir, f), 'utf8');
    let name = basename(f, '.svg');
    if (strip) name = name.replace(strip, '');
    name = slugify(name.replace(/_/g, ' '));
    if (seen.has(name)) { report.warnings.push(`${def.id}: nombre duplicado ${name} (${f}), se conserva el primero`); continue; }
    seen.add(name);
    try {
      const clean = sanitizeSvgDocument(raw, `${def.id}-${name}`.replace(/[^a-z0-9-]/g, ''));
      const { viewBox, body } = splitSvg(clean);
      out.push({ name, body, viewBox, aliases: [], file: f });
    } catch (e) {
      report.errors.push(`${def.id}/${f}: ${e.message}`);
    }
  }
  return { icons: out, version: def.source.commit ? def.source.commit.slice(0, 12) : null, upstreamVersion: def.source.commitDate || null, skipped: 0 };
}

// --- Metadatos adicionales (Simple Icons) ----------------------------------

async function loadSimpleIconsMeta() {
  const map = new Map();
  try {
    const mod = await import('simple-icons');
    for (const v of Object.values(mod)) {
      if (v && typeof v === 'object' && v.slug) map.set(v.slug, v);
    }
  } catch (e) {
    report.warnings.push(`No se pudo cargar simple-icons para metadatos: ${e.message}`);
  }
  return map;
}

// --- Construcción ------------------------------------------------------------

const siMeta = await loadSimpleIconsMeta();
const siTitleBySlug = new Map([...siMeta.values()].map((v) => [v.slug, v.title]));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'svg'), { recursive: true });
mkdirSync(join(OUT, 'details'), { recursive: true });

const collections = [];
const rows = [];
const allIds = new Set();
const styleSet = new Set();

// prioridad de ordenación en "Todos": arquitectura y marcas primero
const KIND_PRIORITY = { reference: 0, architecture: 1, brand: 2, ui: 3 };

for (const def of collectionDefs) {
  const loader = { iconify: loadIconify, 'iconify-file': loadIconify, ui5: loadUi5, 'svg-folder': loadSvgFolder }[def.source.type];
  if (!loader) { report.errors.push(`${def.id}: tipo de fuente desconocido ${def.source.type}`); continue; }
  let data;
  try { data = loader(def); } catch (e) { report.errors.push(`${def.id}: ${e.message}`); continue; }
  const icons = data.icons.sort((a, b) => a.name.localeCompare(b.name));
  const shards = [];
  const details = {};
  let rejected = 0;
  const cIdx = collections.length;
  const kept = [];
  for (const icon of icons) {
    const issues = findSvgIssues(icon.body);
    if (issues.length) { rejected++; report.errors.push(`${def.id}:${icon.name} rechazado: ${issues.join('; ')}`); continue; }
    kept.push(icon);
  }
  kept.forEach((icon, i) => {
    const id = `${def.id}:${icon.name}`;
    if (allIds.has(id)) { report.errors.push(`ID duplicado ${id}`); return; }
    allIds.add(id);
    const { base, style: rawStyle } = splitStyle(icon.name, def.styles || [], def.defaultStyle || 'original');
    const pal = detectPalette(icon.body);
    let style = rawStyle;
    if (def.kind === 'brand' && rawStyle === 'original') style = pal.mono ? 'monochrome' : 'multicolor';
    if (def.kind === 'architecture') style = pal.mono ? 'monochrome' : 'original';
    styleSet.add(style);
    let provider = def.provider;
    if (def.brandMatching) {
      const hit = brandMatchers.find((m) => m.re.test(icon.name));
      provider = hit ? hit.id : 'community';
    }
    let title;
    const si = def.source.meta === 'simple-icons' ? siMeta.get(icon.name) : null;
    if (si) title = si.title;
    else if (def.kind === 'brand') title = titleOverrides[base] || siTitleBySlug.get(base) || siTitleBySlug.get(base.replace(/-/g, '')) || humanize(base.replace(/([a-z])(\d)/g, '$1 $2'));
    else title = humanize(base);
    if (def.id === 'sap-btp') title = humanize(base).replace(/^SAP /, 'SAP ').replace(/\bS4hana\b/i, 'S/4HANA').replace(/Btp\b/, 'BTP');
    const category = classify(base, { sourceCategory: icon.sourceCategory, brand: def.kind === 'brand' });
    const shard = Math.floor(i / SHARD_SIZE);
    (shards[shard] ||= {})[icon.name] = [icon.body, icon.viewBox];
    let flags = 0;
    if (pal.mono) flags |= 1;
    if (def.official || (def.kind === 'brand' && false)) flags |= 2;
    if (si?.hex) flags |= 4;
    const tags = new Set([...(icon.aliases || []).map((a) => a.replace(/-/g, ' '))]);
    if (si?.aliases?.aka) si.aliases.aka.forEach((a) => tags.add(a));
    if (si?.aliases?.dup) si.aliases.dup.forEach((d) => d.title && tags.add(d.title));
    rows.push([icon.name, cIdx, title, categoryIds.indexOf(category), style, providerIds.indexOf(provider), shard, flags, [...tags].join('|'), base, si?.hex || '', KIND_PRIORITY[def.kind] ?? 9]);
    if (si && (si.license || si.guidelines || si.source)) {
      details[icon.name] = { source: si.source, guidelines: si.guidelines, license: si.license || null };
    }
    if (pal.colors.length) (details[icon.name] ||= {}).colors = pal.colors;
  });
  const cdir = join(OUT, 'svg', def.id);
  mkdirSync(cdir, { recursive: true });
  shards.forEach((s, n) => writeFileSync(join(cdir, `${n}.json`), JSON.stringify(s)));
  writeFileSync(join(OUT, 'details', `${def.id}.json`), JSON.stringify(details));
  const { source, ...rest } = def;
  collections.push({
    ...rest,
    source: { type: source.type, package: source.package || null, upstream: source.upstream || null, commit: source.commit || null },
    version: data.version,
    upstreamVersion: data.upstreamVersion,
    count: kept.length,
    shards: shards.length,
  });
  report.collections.push({ id: def.id, version: data.version, total: kept.length, rejected, skippedHiddenOrExcluded: data.skipped });
  console.log(`[catalog] ${def.id.padEnd(18)} ${String(kept.length).padStart(6)} iconos  (v${data.version})${rejected ? `  ${rejected} rechazados` : ''}`);
}

// --- Fichas oficiales solo-enlace -------------------------------------------

const brandIndex = new Map(); // nombre normalizado → ids descargables (para "alternativas")
for (const r of rows) {
  const c = collections[r[1]];
  if (c.kind !== 'brand' && c.kind !== 'architecture') continue;
  const keys = [normalize(r[2]).replace(/\s+/g, ''), r[9].replace(/-/g, '')];
  for (const k of keys) {
    if (!brandIndex.has(k)) brandIndex.set(k, []);
    const id = `${c.id}:${r[0]}`;
    if (!brandIndex.get(k).includes(id)) brandIndex.get(k).push(id);
  }
}

for (const def of referenceDefs) {
  const cIdx = collections.length;
  const details = {};
  const used = new Set();
  let n = 0;
  for (const e of def.entries) {
    let name = slugify(e.name);
    if (used.has(name)) name = `${name}-${slugify(e.family || 'x')}`;
    used.add(name);
    const id = `${def.id}:${name}`;
    if (allIds.has(id)) { report.errors.push(`ID duplicado ${id}`); continue; }
    allIds.add(id);
    if (!categoryIds.includes(e.category)) report.errors.push(`${id}: categoría desconocida ${e.category}`);
    const key = normalize(e.name).replace(/\s+/g, '');
    const prefixStripped = normalize(e.name.replace(/^(Microsoft|Azure|Amazon|AWS|Google Cloud|Google|SAP|OCI|Oracle)\s+/i, '')).replace(/\s+/g, '');
    const alternatives = [...new Set([...(brandIndex.get(key) || []), ...(def.provider === 'microsoft' || def.provider === 'aws' ? brandIndex.get(`${def.provider === 'aws' ? 'amazon' : 'microsoft'}${prefixStripped}`) || [] : [])])].slice(0, 6);
    const flags = 2 | (e.legacy ? 8 : 0);
    rows.push([name, cIdx, e.name, categoryIds.indexOf(e.category), 'external', providerIds.indexOf(def.provider), -1, flags, [...(e.aliases || []), e.family].filter(Boolean).join('|'), name, '', 0]);
    details[name] = { sourceUrl: e.sourceUrl || def.sourceUrl, family: e.family, note: e.note || null, alternatives };
    n++;
  }
  styleSet.add('external');
  writeFileSync(join(OUT, 'details', `${def.id}.json`), JSON.stringify(details));
  const { entries, source, ...rest } = def;
  collections.push({ ...rest, source: { type: 'reference' }, version: def.reviewed, upstreamVersion: null, count: n, shards: 0 });
  report.collections.push({ id: def.id, version: def.reviewed, total: n, rejected: 0, skippedHiddenOrExcluded: 0 });
  console.log(`[catalog] ${def.id.padEnd(26)} ${String(n).padStart(6)} fichas oficiales (solo enlace)`);
}

// --- Índices y estadísticas ---------------------------------------------------

const styles = STYLE_ORDER.filter((s) => styleSet.has(s)).concat([...styleSet].filter((s) => !STYLE_ORDER.includes(s)));
const styleIdx = new Map(styles.map((s, i) => [s, i]));
for (const r of rows) r[4] = styleIdx.get(r[4]);

const provCount = new Map(), catCount = new Map(), provDownload = new Map(), provRefs = new Map();
let downloadable = 0, references = 0;
for (const r of rows) {
  const p = providerIds[r[5]];
  const coll = collections[r[1]];
  provCount.set(p, (provCount.get(p) || 0) + 1);
  catCount.set(r[3], (catCount.get(r[3]) || 0) + 1);
  if (coll.kind === 'reference') { references++; provRefs.set(p, (provRefs.get(p) || 0) + 1); }
  else { downloadable++; provDownload.set(p, (provDownload.get(p) || 0) + 1); }
}

const providerOut = providers.map(({ match, ...p }) => ({
  ...p,
  count: provCount.get(p.id) || 0,
  downloadable: provDownload.get(p.id) || 0,
  references: provRefs.get(p.id) || 0,
  collections: collections.filter((c) => c.provider === p.id).map((c) => c.id),
  logoIcon: p.logoIcon && allIds.has(p.logoIcon) ? p.logoIcon : null,
}));
for (const p of providers) if (p.logoIcon && !allIds.has(p.logoIcon)) report.warnings.push(`logoIcon inexistente para ${p.id}: ${p.logoIcon}`);

const categoryOut = taxonomy.categories.map((c, i) => ({ id: c.id, group: c.group, labels: c.labels, count: catCount.get(i) || 0 }));

const index = {
  version: 1,
  generatedAt: report.generatedAt,
  stats: {
    icons: rows.length,
    downloadable,
    references,
    collections: collections.length,
    libraries: collections.filter((c) => c.kind !== 'reference').length,
    providers: providerOut.filter((p) => p.count > 0 && p.id !== 'community').length,
    categories: categoryOut.filter((c) => c.count > 0).length,
  },
  groups: taxonomy.groups,
  categories: categoryOut,
  providers: providerOut,
  collections,
  styles,
  synonyms: synonyms.groups,
};

const iconsFile = {
  version: 1,
  fields: ['name', 'collection', 'title', 'category', 'style', 'provider', 'shard', 'flags', 'tags', 'group', 'hex', 'priority'],
  collections: collections.map((c) => c.id),
  providers: providerIds,
  categories: categoryIds,
  styles,
  icons: rows,
};

writeFileSync(join(OUT, 'index.json'), JSON.stringify(index));
writeFileSync(join(OUT, 'icons.json'), JSON.stringify(iconsFile));
report.totals = index.stats;
report.durationMs = Date.now() - t0;
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));

console.log(`[catalog] Total: ${rows.length} recursos (${downloadable} descargables, ${references} fichas oficiales solo-enlace) en ${collections.length} colecciones. ${(report.durationMs / 1000).toFixed(1)} s`);
if (report.warnings.length) console.warn(`[catalog] ${report.warnings.length} avisos (ver public/catalog/report.json)`);
if (report.errors.length) {
  console.error(`[catalog] ${report.errors.length} errores:`);
  report.errors.slice(0, 20).forEach((e) => console.error('  - ' + e));
  if (args.has('--strict')) process.exit(1);
}
