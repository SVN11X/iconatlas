import DOMPurify from 'dompurify';
import type { Icon, SvgData } from '../../types/catalog';
import { isMono } from '../catalog/catalogStore';

export interface SvgOptions {
  /** Color para iconos monocromos (solo si la colección lo permite). Formato #rgb/#rrggbb. */
  color?: string | null;
  /** Fondo opcional (#rrggbb). null = transparente. */
  background?: string | null;
  /** Margen externo en % del lado mayor (0–40). */
  padding?: number;
  /** Ancho/alto explícitos en px del documento (opcional). Se conserva la proporción. */
  size?: number | null;
}

const COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function isValidColor(c: unknown): c is string {
  return typeof c === 'string' && COLOR_RE.test(c);
}

export function parseViewBox(vb: string): [number, number, number, number] {
  const p = vb.trim().split(/[\s,]+/).map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n)) || p[2] <= 0 || p[3] <= 0) throw new Error(`viewBox inválido: ${vb}`);
  return p as [number, number, number, number];
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : String(+n.toFixed(4));
}

/** Política de personalización para un icono. */
export function customizationFor(icon: Icon) {
  const c = icon.collection.customization;
  const mono = isMono(icon);
  return {
    /** Color libre */
    freeColor: c === 'free' && mono,
    /** Solo colores predefinidos de marca: color oficial, negro, blanco */
    presetColors: c === 'brand-mono' && mono ? [icon.hex ? `#${icon.hex}` : '#000000', '#000000', '#ffffff'].filter((v, i, a) => a.indexOf(v) === i) : [],
    /** Fondo y margen no alteran el diseño del icono, por lo que siempre se permiten */
    background: true,
    padding: true,
    locked: c === 'none' || !mono,
  };
}

/** Color por defecto que se aplica a un icono monocromo al exportarlo. */
export function defaultColor(icon: Icon): string {
  if (icon.hex && icon.collection.customization === 'brand-mono') return `#${icon.hex}`;
  return '#000000';
}

/**
 * Construye un documento SVG autónomo y fiel al original.
 * - Conserva el viewBox y el contenido vectorial sin rasterizar.
 * - Sustituye currentColor solo en iconos monocromos.
 * - Añade margen/fondo ampliando el viewBox (sin escalar el contenido).
 */
export function buildSvg(icon: Icon, data: SvgData, opts: SvgOptions = {}): string {
  const [x, y, w, h] = parseViewBox(data.viewBox);
  const pad = Math.max(0, Math.min(40, opts.padding ?? 0));
  const p = (Math.max(w, h) * pad) / 100;
  const vx = x - p, vy = y - p, vw = w + 2 * p, vh = h + 2 * p;
  let body = data.body;
  const mono = isMono(icon);
  const policy = customizationFor(icon);
  let color: string | null = null;
  if (mono) {
    const wanted = isValidColor(opts.color) ? opts.color.toLowerCase() : null;
    if (policy.freeColor) color = wanted ?? defaultColor(icon);
    else if (policy.presetColors.length) color = wanted && policy.presetColors.includes(wanted) ? wanted : defaultColor(icon);
    else color = defaultColor(icon);
    body = body.replace(/currentColor/g, color);
  }
  const attrs: string[] = ['xmlns="http://www.w3.org/2000/svg"'];
  if (/xlink:/.test(body)) attrs.push('xmlns:xlink="http://www.w3.org/1999/xlink"');
  attrs.push(`viewBox="${fmt(vx)} ${fmt(vy)} ${fmt(vw)} ${fmt(vh)}"`);
  if (opts.size && opts.size > 0) {
    const s = opts.size / Math.max(vw, vh);
    attrs.push(`width="${fmt(vw * s)}"`, `height="${fmt(vh * s)}"`);
  } else {
    attrs.push(`width="${fmt(vw)}"`, `height="${fmt(vh)}"`);
  }
  // Iconos monocromos sin fill explícito (p. ej. SAP-icons) heredan el color del documento.
  if (mono && color && !/\sfill=/.test(body)) attrs.push(`fill="${color}"`);
  const bg = isValidColor(opts.background) ? `<rect x="${fmt(vx)}" y="${fmt(vy)}" width="${fmt(vw)}" height="${fmt(vh)}" fill="${opts.background}"/>` : '';
  const svg = `<svg ${attrs.join(' ')}>${bg}${body}</svg>`;
  assertSafeSvg(svg);
  return svg;
}

/**
 * Defensa en profundidad: comprueba con DOMPurify que el documento no contiene
 * elementos o atributos activos. No transforma el SVG (para no alterar su
 * fidelidad): si DOMPurify tuviera que eliminar algo, se rechaza.
 */
export function assertSafeSvg(svg: string) {
  if (typeof window === 'undefined' || !DOMPurify.isSupported) return;
  DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, ADD_TAGS: ['use'], WHOLE_DOCUMENT: false });
  const removed = (DOMPurify.removed || []).filter((r: unknown) => {
    const rr = r as { element?: Element; attribute?: Attr | null };
    // DOMPurify puede informar del propio nodo raíz o de nodos de texto vacíos; solo cuentan elementos/atributos reales
    if (rr.attribute) return !/^(xmlns(:xlink)?|xml:space|data-name|style)$/i.test(rr.attribute.name);
    return rr.element && rr.element.nodeType === 1 && !/^(svg|title|desc|metadata|style|body|html|head)$/i.test(rr.element.nodeName);
  });
  if (removed.length) throw new Error('El SVG contiene contenido no permitido y no se puede usar.');
}

export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Nombre de archivo coherente: "azure-storage-account", "aws-lambda", "databricks". */
export function fileBaseName(icon: Icon): string {
  return icon.name.replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'icon';
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
