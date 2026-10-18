#!/usr/bin/env node
// Comprueba el estado de las fuentes del catálogo SIN modificar nada:
//  - Nuevas versiones de paquetes npm (Iconify JSON, UI5, simple-icons).
//  - Iconos añadidos / retirados respecto al catálogo generado actual.
//  - Cambios de licencia declarada en el paquete.
//  - Enlaces rotos de fuentes oficiales (fichas solo-enlace y proveedores).
// Resultado: sync-report.json + resumen en Markdown (GITHUB_STEP_SUMMARY si existe).
// Uso: node scripts/check-sources/index.mjs [--no-network-links] [--out sync-report.json]
import { writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { ROOT, readJson, listJson } from '../lib/catalog-utils.mjs';

const argv = process.argv.slice(2);
const outPath = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : join(ROOT, 'sync-report.json');
const skipLinks = argv.includes('--no-network-links');
const TIMEOUT = 20000;

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try { return await fetch(url, { ...opts, signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': 'iconatlas-source-check' } }); }
  finally { clearTimeout(t); }
}

/** Lector mínimo de tar (ustar) para extraer un archivo concreto de un .tgz de npm. */
function extractFromTgz(buf, wanted) {
  const tar = gunzipSync(buf);
  let off = 0;
  while (off + 512 <= tar.length) {
    const name = tar.subarray(off, off + 100).toString('utf8').replace(/\0.*$/s, '');
    if (!name) break;
    const size = parseInt(tar.subarray(off + 124, off + 136).toString('utf8').replace(/\0.*$/s, '').trim(), 8) || 0;
    const prefix = tar.subarray(off + 345, off + 500).toString('utf8').replace(/\0.*$/s, '');
    const full = prefix ? `${prefix}/${name}` : name;
    if (full === wanted || full.endsWith('/' + wanted.replace(/^package\//, ''))) return tar.subarray(off + 512, off + 512 + size).toString('utf8');
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return null;
}

const catalogDir = join(ROOT, 'public/catalog');
const haveCatalog = existsSync(join(catalogDir, 'icons.json'));
const current = haveCatalog ? readJson(join(catalogDir, 'icons.json')) : null;
const currentIndex = haveCatalog ? readJson(join(catalogDir, 'index.json')) : null;
const namesBy = new Map();
if (current) for (const r of current.icons) {
  const c = current.collections[r[1]];
  if (!namesBy.has(c)) namesBy.set(c, new Set());
  namesBy.get(c).add(r[0]);
}

const report = { checkedAt: new Date().toISOString(), packages: [], links: [], errors: [] };
const defs = listJson(join(ROOT, 'src/catalog/collections')).map(readJson);

for (const def of defs) {
  const pkg = def.source.package;
  if (!pkg) { report.packages.push({ collection: def.id, type: def.source.type, note: def.source.upstream ? `Fuente vendorizada (${def.source.upstream} @ ${def.source.commit?.slice(0, 12)}). Revisión manual requerida.` : 'Sin paquete npm' }); continue; }
  try {
    let installed = null;
    try { installed = readJson(join(ROOT, 'node_modules', pkg, 'package.json')); } catch { /* no instalado */ }
    const res = await fetchWithTimeout(`https://registry.npmjs.org/${pkg.replace('/', '%2F')}/latest`);
    if (!res.ok) throw new Error(`registry HTTP ${res.status}`);
    const latest = await res.json();
    const entry = {
      collection: def.id, package: pkg,
      installedVersion: installed?.version || null, latestVersion: latest.version,
      updateAvailable: installed ? installed.version !== latest.version : true,
      licenseRecorded: def.license.spdx, licenseLatest: latest.license || null,
      licenseChanged: latest.license && def.license.spdx !== 'LicenseRef-Proprietary' ? String(latest.license) !== def.license.spdx : false,
    };
    if (entry.updateAvailable && def.source.type === 'iconify' && latest.dist?.tarball && namesBy.has(def.id)) {
      const tgz = Buffer.from(await (await fetchWithTimeout(latest.dist.tarball)).arrayBuffer());
      const iconsJson = extractFromTgz(tgz, 'package/icons.json');
      if (iconsJson) {
        const j = JSON.parse(iconsJson);
        const inc = def.source.include ? new RegExp(def.source.include) : null;
        const exc = def.source.exclude ? new RegExp(def.source.exclude) : null;
        const latestNames = new Set(Object.entries(j.icons).filter(([n, i]) => !i.hidden && (!inc || inc.test(n)) && !(exc && exc.test(n))).map(([n]) => n));
        const cur = namesBy.get(def.id);
        entry.added = [...latestNames].filter((n) => !cur.has(n));
        entry.removed = [...cur].filter((n) => !latestNames.has(n));
        // posibles renombrados: retirado con alias en la nueva versión
        entry.renamed = entry.removed.filter((n) => j.aliases?.[n]?.parent).map((n) => ({ from: n, to: j.aliases[n].parent }));
        entry.addedCount = entry.added.length; entry.removedCount = entry.removed.length;
        entry.added = entry.added.slice(0, 50); entry.removed = entry.removed.slice(0, 50);
      }
    }
    report.packages.push(entry);
  } catch (e) {
    report.errors.push(`${def.id}: ${e.message}`);
  }
}

if (!skipLinks) {
  const urls = new Map();
  for (const ref of listJson(join(ROOT, 'src/catalog/manifests/reference')).map(readJson)) {
    urls.set(ref.sourceUrl, ref.id);
    for (const e of ref.entries) if (e.sourceUrl) urls.set(e.sourceUrl, `${ref.id}:${e.name}`);
  }
  for (const p of readJson(join(ROOT, 'src/catalog/providers/providers.json')).providers) {
    for (const o of p.officialIcons || []) urls.set(o.url, `provider:${p.id}`);
  }
  for (const [url, owner] of urls) {
    try {
      let res = await fetchWithTimeout(url, { method: 'HEAD' });
      if (res.status === 405 || res.status === 403) res = await fetchWithTimeout(url, { method: 'GET' });
      report.links.push({ url, owner, status: res.status, ok: res.ok });
    } catch (e) {
      report.links.push({ url, owner, status: 0, ok: false, error: e.message });
    }
  }
}

report.summary = {
  lastCatalogBuild: currentIndex?.generatedAt || null,
  totalIcons: currentIndex?.stats.icons ?? null,
  updatesAvailable: report.packages.filter((p) => p.updateAvailable).length,
  licenseChanges: report.packages.filter((p) => p.licenseChanged).map((p) => p.collection),
  brokenLinks: report.links.filter((l) => !l.ok).length,
  errors: report.errors.length,
};
writeFileSync(outPath, JSON.stringify(report, null, 2));

const md = [
  '# IconAtlas — comprobación de fuentes',
  '',
  `Fecha: ${report.checkedAt} · Último catálogo: ${report.summary.lastCatalogBuild ?? 'no generado'} · Recursos: ${report.summary.totalIcons ?? '—'}`,
  '',
  '| Colección | Instalada | Última | Nuevos | Retirados | Licencia |',
  '|---|---|---|---|---|---|',
  ...report.packages.filter((p) => p.package).map((p) => `| ${p.collection} | ${p.installedVersion ?? '—'} | ${p.latestVersion} | ${p.addedCount ?? (p.updateAvailable ? '?' : 0)} | ${p.removedCount ?? (p.updateAvailable ? '?' : 0)} | ${p.licenseChanged ? `⚠️ ${p.licenseRecorded} → ${p.licenseLatest}` : p.licenseRecorded} |`),
  '',
  `Enlaces oficiales comprobados: ${report.links.length} · rotos: ${report.summary.brokenLinks}`,
  ...report.links.filter((l) => !l.ok).map((l) => `- ❌ ${l.url} (${l.owner}) → ${l.status || l.error}`),
  ...(report.errors.length ? ['', '## Errores', ...report.errors.map((e) => `- ${e}`)] : []),
  '',
  '> Las colecciones oficiales restringidas y las fuentes vendorizadas nunca se actualizan automáticamente: requieren revisión manual de sus términos.',
].join('\n');
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
