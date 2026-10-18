#!/usr/bin/env node
// Importador de colecciones para IconAtlas.
//
// Uso:
//   npm run import-icons -- --source <carpeta|archivo.zip|archivo.json|npm:@iconify-json/xyz> \
//     --id mi-coleccion --name "Mi colección" --owner "Autor" --homepage https://... \
//     --license MIT --license-url https://.../LICENSE --redistributable yes \
//     [--provider community] [--kind ui|brand|architecture] [--customization free|brand-mono|none] \
//     [--attribution "texto"] [--commercial yes|no|unverified] [--strip "regex"] [--official] [--dry-run]
//
// El importador:
//  1. Exige procedencia y licencia (no importa recursos cuya redistribución no esté confirmada).
//  2. Identifica el formato (carpeta SVG, ZIP, IconifyJSON o paquete npm).
//  3. Sanitiza cada SVG (elimina scripts, eventos y referencias externas) y valida viewBox/dimensiones.
//  4. Normaliza nombres, detecta duplicados (mismo nombre → variante -2; mismo contenido → se omite y se registra).
//  5. Copia los archivos a vendor/<id>/, escribe SOURCE.json e import-log.json
//     y genera src/catalog/collections/<id>.json. Después: `npm run catalog`.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { join, extname, basename, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { unzipSync, strFromU8 } from 'fflate';
import { ROOT, slugify } from '../lib/catalog-utils.mjs';
import { findSvgIssues, sanitizeSvgDocument, splitSvg } from '../lib/svg-safety.mjs';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

const SPDX_OK = new Set(['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'CC0-1.0', 'CC-BY-4.0', 'CC-BY-3.0', 'OFL-1.1', 'MPL-2.0', 'Unlicense']);

export function runImport(args) {
  const errors = [];
  for (const k of ['source', 'id', 'name', 'license', 'license-url', 'owner']) if (!args[k]) errors.push(`Falta --${k}`);
  if (args.redistributable !== 'yes') errors.push('Debe confirmarse --redistributable yes tras revisar la licencia: IconAtlas no incorpora recursos cuya redistribución sea incierta.');
  if (args.id && !/^[a-z0-9][a-z0-9-]*$/.test(args.id)) errors.push('--id solo admite minúsculas, números y guiones');
  if (args.license && !SPDX_OK.has(args.license)) errors.push(`Licencia ${args.license} no reconocida como abierta. Revísala manualmente y añádela a SPDX_OK si procede.`);
  if (errors.length) return { ok: false, errors };

  const id = args.id;
  const vendorDir = join(ROOT, 'vendor', id);
  const log = { importedAt: new Date().toISOString(), source: args.source, imported: [], skippedDuplicates: [], renamedVariants: [], rejected: [] };
  const source = String(args.source);
  let collectionSource;

  if (source.startsWith('npm:')) {
    const pkg = source.slice(4);
    if (!existsSync(join(ROOT, 'node_modules', pkg, 'icons.json'))) return { ok: false, errors: [`Instala primero el paquete: npm i -D ${pkg}`] };
    collectionSource = { type: 'iconify', package: pkg };
  } else if (extname(source).toLowerCase() === '.json') {
    const json = JSON.parse(readFileSync(source, 'utf8'));
    if (!json.icons || typeof json.icons !== 'object') return { ok: false, errors: ['El JSON no tiene formato IconifyJSON (falta "icons")'] };
    for (const [name, icon] of Object.entries(json.icons)) {
      const issues = findSvgIssues(icon.body || '');
      if (issues.length) { log.rejected.push({ name, issues }); delete json.icons[name]; }
    }
    if (!args['dry-run']) {
      mkdirSync(vendorDir, { recursive: true });
      writeFileSync(join(vendorDir, 'icons.json'), JSON.stringify(json));
    }
    log.imported = Object.keys(json.icons);
    collectionSource = { type: 'iconify-file', path: relative(ROOT, join(vendorDir, 'icons.json')), version: json.info?.version ?? null };
  } else {
    // Carpeta o ZIP de SVG
    const files = [];
    if (extname(source).toLowerCase() === '.zip') {
      const entries = unzipSync(new Uint8Array(readFileSync(source)));
      for (const [path, data] of Object.entries(entries)) {
        if (path.includes('..') || path.startsWith('/')) { log.rejected.push({ name: path, issues: ['Ruta insegura en ZIP'] }); continue; }
        if (path.toLowerCase().endsWith('.svg')) files.push({ path, content: strFromU8(data) });
      }
    } else if (existsSync(source) && statSync(source).isDirectory()) {
      const walk = (d) => {
        for (const f of readdirSync(d)) {
          const p = join(d, f);
          if (statSync(p).isDirectory()) walk(p);
          else if (f.toLowerCase().endsWith('.svg')) files.push({ path: relative(source, p), content: readFileSync(p, 'utf8') });
        }
      };
      walk(source);
    } else {
      return { ok: false, errors: [`Fuente no encontrada o formato no soportado: ${source}`] };
    }
    const strip = args.strip ? new RegExp(String(args.strip), 'g') : null;
    const byName = new Map();
    const byHash = new Map();
    const outFiles = [];
    for (const f of files.sort((a, b) => a.path.localeCompare(b.path))) {
      let name = basename(f.path, '.svg');
      if (strip) name = name.replace(strip, '');
      name = slugify(name.replace(/[_.]/g, ' '));
      if (!name) { log.rejected.push({ name: f.path, issues: ['Nombre vacío tras normalizar'] }); continue; }
      if (Buffer.byteLength(f.content) > 512 * 1024) { log.rejected.push({ name: f.path, issues: ['Archivo > 512 KiB'] }); continue; }
      let clean;
      try {
        clean = sanitizeSvgDocument(f.content, `${id}-${name}`);
        const { body } = splitSvg(clean);
        const issues = findSvgIssues(body);
        if (issues.length) throw new Error(issues.join('; '));
      } catch (e) {
        log.rejected.push({ name: f.path, issues: [e.message] });
        continue;
      }
      const hash = createHash('sha256').update(clean.replace(new RegExp(`${id}-${name}-`, 'g'), '')).digest('hex').slice(0, 16);
      if (byHash.has(hash)) { log.skippedDuplicates.push({ file: f.path, sameAs: byHash.get(hash) }); continue; }
      let finalName = name;
      for (let n = 2; byName.has(finalName); n++) finalName = `${name}-${n}`;
      if (finalName !== name) log.renamedVariants.push({ file: f.path, name: finalName });
      byName.set(finalName, f.path);
      byHash.set(hash, finalName);
      outFiles.push({ name: finalName, svg: clean });
    }
    if (!args['dry-run']) {
      rmSync(join(vendorDir, 'svg'), { recursive: true, force: true });
      mkdirSync(join(vendorDir, 'svg'), { recursive: true });
      for (const f of outFiles) writeFileSync(join(vendorDir, 'svg', `${f.name}.svg`), f.svg);
    }
    log.imported = outFiles.map((f) => f.name);
    collectionSource = { type: 'svg-folder', path: relative(ROOT, join(vendorDir, 'svg')), upstream: args.homepage || null };
  }

  const kind = ['ui', 'brand', 'architecture'].includes(args.kind) ? args.kind : 'ui';
  const customization = ['free', 'brand-mono', 'none'].includes(args.customization) ? args.customization : kind === 'ui' ? 'free' : 'none';
  const def = {
    id,
    name: args.name,
    kind,
    provider: args.provider || 'community',
    source: collectionSource,
    owner: args.owner,
    homepage: args.homepage || null,
    license: { spdx: args.license, title: args.license, url: args['license-url'] },
    official: !!args.official,
    permissions: { download: true, redistribute: true, modify: customization === 'free', commercial: ['yes', 'no', 'unverified'].includes(args.commercial) ? args.commercial : 'unverified', attribution: !!args.attribution },
    customization,
    defaultStyle: kind === 'ui' ? 'outline' : 'original',
    styles: [],
    brandMatching: kind === 'brand',
    restrictions: kind === 'ui' ? [] : ['Las marcas representadas pertenecen a sus propietarios.'],
    ...(args.attribution ? { attribution: String(args.attribution) } : {}),
    reviewed: new Date().toISOString().slice(0, 10),
  };
  if (!args['dry-run']) {
    mkdirSync(vendorDir, { recursive: true });
    writeFileSync(join(vendorDir, 'SOURCE.json'), JSON.stringify({ source: args.source, homepage: args.homepage || null, license: def.license, owner: def.owner, importedAt: log.importedAt }, null, 2));
    writeFileSync(join(vendorDir, 'import-log.json'), JSON.stringify(log, null, 2));
    writeFileSync(join(ROOT, 'src/catalog/collections', `${id}.json`), JSON.stringify(def, null, 2));
  }
  return { ok: true, def, log };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || Object.keys(args).length === 0) {
    console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
    process.exit(0);
  }
  const r = runImport(args);
  if (!r.ok) {
    console.error('[import] No se importó nada:');
    r.errors.forEach((e) => console.error('  - ' + e));
    process.exit(1);
  }
  const { log } = r;
  console.log(`[import] ${r.def.id}: ${log.imported.length} iconos importados, ${log.skippedDuplicates.length} duplicados omitidos, ${log.renamedVariants.length} variantes renombradas, ${log.rejected.length} rechazados.`);
  if (log.rejected.length) log.rejected.slice(0, 10).forEach((x) => console.warn(`  rechazado ${x.name}: ${x.issues.join('; ')}`));
  console.log(args['dry-run'] ? '[import] Simulación: no se escribieron archivos.' : '[import] Ejecuta `npm run catalog` para regenerar el catálogo.');
}
