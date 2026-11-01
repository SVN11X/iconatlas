// Utilidades compartidas por los scripts del catálogo.
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// fileURLToPath conserva las rutas Windows (C:\\...) y decodifica URLs file: correctamente.
export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Comprueba el punto de entrada de un script ESM en Windows, Linux y macOS. */
export function isMainModule(moduleUrl, argvPath = process.argv[1]) {
  return Boolean(argvPath) && moduleUrl === pathToFileURL(resolve(argvPath)).href;
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function listJson(dir) {
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => join(dir, f));
}

/** Normaliza un texto para comparación: minúsculas, sin acentos, sin símbolos. */
export function normalize(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Convierte un texto en slug estable: "Azure Data Factory" → "azure-data-factory". */
export function slugify(s) {
  return normalize(s).replace(/\s+/g, '-');
}

const SMALL = new Set(['and', 'or', 'of', 'for', 'to', 'in', 'on', 'the', 'a', 'an', 'with', 'by']);
const UPPER = new Set(['ai', 'api', 'sql', 'db', 'ui', 'ux', 'id', 'vm', 'vpn', 'dns', 'cdn', 'iot', 'sap', 'btp', 'abap', 'html', 'css', 'pdf', 'qr', 'usb', 'tv', 'gps', 'nfc', 'rss', 'sms', 'ar', 'vr', 'cd', 'ci', 'pki', 'hana', 'fhir', 'alm', 'aws', 'gcp', 'ibm', 'oauth', 'xml', 'json', 'csv', 'svg', 'png', 'jpg', 'gif', 'hd', 'hdr', '3d', '2d', '4k', 'atm', 'wifi', 'ip', 'ssh', 'ssl', 'tls', 'http', 'https', 'url', 'saas', 'erp', 'crm']);

/** "add-circle" → "Add Circle"; respeta siglas comunes. */
export function humanize(name) {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w, i) => {
      const lw = w.toLowerCase();
      if (UPPER.has(lw)) return lw === 'oauth' ? 'OAuth' : lw === 'wifi' ? 'Wi-Fi' : lw.toUpperCase();
      if (i > 0 && SMALL.has(lw)) return lw;
      return lw.charAt(0).toUpperCase() + lw.slice(1);
    })
    .join(' ');
}

/** Elimina el sufijo de estilo y devuelve { base, style }. */
export function splitStyle(name, styles, defaultStyle) {
  for (const { suffix, style } of styles) {
    if (name.endsWith(suffix)) return { base: name.slice(0, -suffix.length), style };
  }
  return { base: name, style: defaultStyle };
}

/** Clasificador de categorías basado en la taxonomía. */
export function createClassifier(taxonomy) {
  const cats = taxonomy.categories.filter((c) => c.keywords && c.keywords.length);
  const sets = cats.map((c) => ({ id: c.id, kw: new Set(c.keywords) }));
  const exact = new Map([
    ['go', 'development'], ['c', 'development'], ['r', 'development'], ['net', 'development'],
    ['box', 'storage'], ['x', 'social'], ['line', 'social'], ['signal', 'social'],
  ]);
  return function classify(base, { sourceCategory, brand } = {}) {
    if (sourceCategory && taxonomy.sourceCategories[sourceCategory]) {
      return taxonomy.sourceCategories[sourceCategory];
    }
    if (brand && exact.has(base)) return exact.get(base);
    const tokens = base.toLowerCase().split(/[-_\s]+/).filter(Boolean);
    const candidates = [base.toLowerCase(), ...tokens];
    // pares de tokens consecutivos ("virtual-machine", "load-balancer")
    for (let i = 0; i < tokens.length - 1; i++) candidates.push(`${tokens[i]}-${tokens[i + 1]}`);
    for (const { id, kw } of sets) {
      for (const t of candidates) if (kw.has(t)) return id;
    }
    // coincidencia por prefijo para marcas compuestas ("postgresqlicon", "dockerhub")
    if (brand) {
      const flat = base.replace(/[-_]/g, '');
      for (const { id, kw } of sets) {
        for (const k of kw) if (k.length >= 4 && flat.startsWith(k)) return id;
      }
      return 'brands';
    }
    return 'other';
  };
}

/** Detecta si un cuerpo SVG es monocromo (currentColor) o multicolor. */
export function detectPalette(body) {
  const hasCurrent = /currentColor/i.test(body);
  const colors = new Set();
  const re = /(?:fill|stroke|stop-color|color)\s*[:=]\s*["']?\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]+)/gi;
  let m;
  while ((m = re.exec(body))) {
    const v = m[1].toLowerCase();
    if (['none', 'currentcolor', 'inherit', 'transparent', 'url'].includes(v)) continue;
    colors.add(v);
  }
  if (colors.size === 0) return { mono: true, colors: [] };
  return { mono: hasCurrent && colors.size === 0, colors: [...colors].slice(0, 12) };
}
