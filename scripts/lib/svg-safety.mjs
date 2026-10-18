// Validación y sanitización de SVG en tiempo de compilación/importación.
// Política: lista de elementos permitidos + bloqueo de atributos de evento,
// URLs externas, <script>, <foreignObject>, <iframe>, <image> remotas, etc.
import { optimize } from 'svgo';

export const MAX_SVG_BYTES = 512 * 1024; // 512 KiB por icono
export const MAX_DIMENSION = 10000;

const ALLOWED_ELEMENTS = new Set([
  'svg', 'g', 'path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect',
  'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask', 'pattern',
  'use', 'symbol', 'title', 'desc', 'text', 'tspan', 'filter', 'fegaussianblur',
  'feoffset', 'feblend', 'fecolormatrix', 'fecomposite', 'feflood', 'femerge',
  'femergenode', 'femorphology', 'fedropshadow', 'feturbulence', 'fedisplacementmap',
  'style', 'metadata', 'animate', 'animatetransform', 'set', 'marker', 'image', 'switch', 'a',
]);

const DANGEROUS_PATTERNS = [
  /<\s*script/i,
  /<\s*foreignObject/i,
  /<\s*iframe/i,
  /<\s*embed/i,
  /<\s*object/i,
  /\son[a-z]+\s*=/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
  /<!ENTITY/i,
  /<!DOCTYPE/i,
  /@import/i,
];

/** Devuelve la lista de problemas de seguridad encontrados en un fragmento SVG. */
export function findSvgIssues(svg) {
  const issues = [];
  if (typeof svg !== 'string' || svg.length === 0) return ['SVG vacío'];
  if (svg.length > MAX_SVG_BYTES) issues.push(`SVG demasiado grande (${svg.length} bytes)`);
  for (const re of DANGEROUS_PATTERNS) if (re.test(svg)) issues.push(`Patrón no permitido: ${re}`);
  // href/xlink:href solo pueden apuntar a fragmentos internos (#id) o a data:image
  const hrefRe = /(?:xlink:)?href\s*=\s*["']([^"']*)["']/gi;
  let m;
  while ((m = hrefRe.exec(svg))) {
    const v = m[1].trim();
    if (!(v.startsWith('#') || /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(v))) {
      issues.push(`Referencia externa no permitida: ${v.slice(0, 60)}`);
    }
  }
  // url(...) en estilos: solo referencias internas
  const urlRe = /url\(\s*['"]?([^)'"]*)['"]?\s*\)/gi;
  while ((m = urlRe.exec(svg))) {
    if (!m[1].trim().startsWith('#')) issues.push(`url() externa no permitida: ${m[1].slice(0, 60)}`);
  }
  const tagRe = /<\s*([a-zA-Z][\w:.-]*)/g;
  while ((m = tagRe.exec(svg))) {
    const tag = m[1].toLowerCase().replace(/^svg:/, '');
    if (!ALLOWED_ELEMENTS.has(tag)) issues.push(`Elemento no permitido: <${m[1]}>`);
  }
  return [...new Set(issues)];
}

export function isSafeSvg(svg) {
  return findSvgIssues(svg).length === 0;
}

/** Plugin SVGO que elimina contenido activo antes de la validación final. */
const sanitizePlugin = {
  name: 'iconatlasSanitize',
  fn: () => ({
    element: {
      enter: (node, parent) => {
        const name = node.name.toLowerCase();
        if (['script', 'foreignobject', 'iframe', 'embed', 'object'].includes(name)) {
          parent.children = parent.children.filter((c) => c !== node);
          return;
        }
        for (const attr of Object.keys(node.attributes)) {
          const v = String(node.attributes[attr]);
          if (/^on/i.test(attr)) delete node.attributes[attr];
          else if (/href$/i.test(attr) && !(v.startsWith('#') || /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(v))) delete node.attributes[attr];
          else if (/javascript:/i.test(v)) delete node.attributes[attr];
        }
      },
    },
  }),
};

/**
 * Sanitiza y optimiza de forma conservadora un SVG completo.
 * Conserva viewBox, colores, gradientes e IDs (prefijados) para no alterar la apariencia.
 */
export function sanitizeSvgDocument(svg, idPrefix = 'ia') {
  const result = optimize(svg, {
    multipass: false,
    plugins: [
      sanitizePlugin,
      {
        name: 'preset-default',
        params: {
          overrides: {
            cleanupIds: false,
            convertShapeToPath: false,
            mergePaths: false,
            removeUnknownsAndDefaults: { keepRoleAttr: true },
          },
        },
      },
      { name: 'prefixIds', params: { prefix: idPrefix, delim: '-' } },
      'removeDimensions',
    ],
  });
  return result.data;
}

/** Extrae viewBox y contenido interno de un documento <svg>. */
export function splitSvg(svg) {
  const open = svg.match(/<svg\b[^>]*>/i);
  if (!open) throw new Error('No es un documento SVG');
  const tag = open[0];
  const vb = tag.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  let viewBox = vb ? vb[1].trim().replace(/[\s,]+/g, ' ') : null;
  if (!viewBox) {
    const w = parseFloat((tag.match(/\swidth\s*=\s*["']([\d.]+)/i) || [])[1]);
    const h = parseFloat((tag.match(/\sheight\s*=\s*["']([\d.]+)/i) || [])[1]);
    if (w && h) viewBox = `0 0 ${w} ${h}`;
  }
  if (!viewBox) throw new Error('SVG sin viewBox ni dimensiones');
  const parts = viewBox.split(' ').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n)) || parts[2] <= 0 || parts[3] <= 0 || parts[2] > MAX_DIMENSION || parts[3] > MAX_DIMENSION) {
    throw new Error(`viewBox inválido: ${viewBox}`);
  }
  // atributos de presentación del <svg> raíz que deben conservarse (p. ej. fill="none")
  const keep = [];
  for (const a of ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'clip-rule']) {
    const r = tag.match(new RegExp(`\\s${a}\\s*=\\s*["']([^"']*)["']`, 'i'));
    if (r) keep.push(`${a}="${r[1]}"`);
  }
  const inner = svg.slice(open.index + tag.length, svg.lastIndexOf('</svg>')).trim();
  const body = keep.length ? `<g ${keep.join(' ')}>${inner}</g>` : inner;
  return { viewBox, body };
}
