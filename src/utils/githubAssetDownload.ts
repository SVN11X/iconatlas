import DOMPurify from 'dompurify';
import { classifyAsset, upstreamImageUrl, type RepoAsset } from './githubSourceGallery';

/** Se descarga desde GitHub al navegador del visitante: IconAtlas no replica la fuente. */
const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024;

export function safeDownloadName(repo: string, path: string): string {
  const leaf = path.split('/').at(-1) || 'asset.svg';
  const normalized = leaf.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 140);
  return `${repo.replace('/', '-')}-${normalized}`;
}

/** Verifica CSS embebido; solo admite referencias a elementos del mismo SVG. */
function isSafeLocalCss(value: string): boolean {
  if (/@(?:import|charset|namespace|font-face|supports|document)\b|expression\s*\(|(?:javascript|vbscript|data)\s*:|(?:-moz-binding|behavior)\s*:/i.test(value)) return false;
  const withoutLocalReferences = value.replace(/url\(\s*(['"]?)#[a-zA-Z0-9_:.-]+\1\s*\)/gi, '');
  return !/url\s*\(/i.test(withoutLocalReferences);
}

/** Admite estilos internos legítimos sin ejecutar scripts ni importar recursos externos. */
export function sanitizeExternalSvg(input: string): string {
  if (!/<svg(?:\s|>)/i.test(input)) throw new Error('El archivo no contiene un SVG válido.');
  if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(input)) throw new Error('El SVG contiene declaraciones externas no permitidas.');
  const doc = new DOMParser().parseFromString(input, 'image/svg+xml');
  if (doc.documentElement.localName !== 'svg' || doc.querySelector('parsererror')) throw new Error('El SVG no tiene una estructura XML válida.');

  for (const element of Array.from(doc.querySelectorAll('*'))) {
    const tag = element.localName.toLowerCase();
    if (['script', 'foreignobject', 'iframe', 'object', 'embed'].includes(tag))
      throw new Error('El SVG incluye elementos ejecutables no permitidos.');
    if (tag === 'style' && !isSafeLocalCss(element.textContent || ''))
      throw new Error('El SVG incluye estilos que cargan recursos externos.');
    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      if (/^on[a-z]/.test(name) || name === 'xml:base' || name === 'src')
        throw new Error('El SVG contiene eventos o rutas externas no permitidos.');
      if (name === 'href' || name.endsWith(':href')) {
        const internal = /^#[a-zA-Z0-9_:.-]+$/.test(value);
        // Los PNG/JPEG embebidos no ejecutan SVG/JavaScript y no dependen de una URL externa.
        const embeddedRaster = tag === 'image' && /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(value) && value.length <= 5 * 1024 * 1024;
        if (!internal && !embeddedRaster) throw new Error('El SVG contiene referencias externas no permitidas.');
      } else if ((name === 'style' || /url\s*\(/i.test(value)) && !isSafeLocalCss(value)) {
        throw new Error('El SVG contiene referencias CSS externas.');
      }
      if (/javascript\s*:|vbscript\s*:/i.test(value)) throw new Error('El SVG contiene instrucciones no permitidas.');
    }
  }

  const clean = DOMPurify.sanitize(input, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['style', 'image', 'use'],
    FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'object', 'embed'],
  });
  if (typeof clean !== 'string' || !/<svg(?:\s|>)/i.test(clean)) throw new Error('No se pudo sanitizar el SVG.');
  // Defensa adicional tras la sanitización: ningún vínculo remoto puede sobrevivir.
  const sanitized = new DOMParser().parseFromString(clean, 'image/svg+xml');
  if (sanitized.querySelector('parsererror')) throw new Error('El SVG sanitizado no es válido.');
  for (const element of Array.from(sanitized.querySelectorAll('*'))) {
    if (element.localName.toLowerCase() === 'style' && !isSafeLocalCss(element.textContent || ''))
      throw new Error('El SVG contiene estilos no seguros.');
    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      if (/^on[a-z]/.test(name) || name === 'xml:base') throw new Error('El SVG contiene un evento no permitido.');
      if ((name === 'href' || name.endsWith(':href')) && !/^#[a-zA-Z0-9_:.-]+$/.test(value) &&
        !(element.localName.toLowerCase() === 'image' && /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(value)))
        throw new Error('El SVG sanitizado tiene una referencia externa.');
      if ((name === 'style' || /url\s*\(/i.test(value)) && !isSafeLocalCss(value))
        throw new Error('El SVG sanitizado tiene estilos externos.');
    }
  }
  return clean;
}

export async function prepareRemoteAssetDownload(
  repo: string, branch: string, asset: RepoAsset, fetcher: typeof fetch = fetch,
): Promise<{ blob: Blob; filename: string }> {
  const kind = classifyAsset(asset.path, asset.size);
  const url = upstreamImageUrl(repo, branch, asset.path);
  if (!kind || kind !== asset.kind || !url) throw new Error('Ruta o formato no permitido.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetcher(url, { mode: 'cors', credentials: 'omit', redirect: 'error', signal: controller.signal });
    if (!response.ok) throw new Error(`GitHub respondió HTTP ${response.status}.`);
    if (Number(response.headers.get('content-length') || 0) > MAX_DOWNLOAD_BYTES) throw new Error('Archivo demasiado grande para descarga segura.');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No se pudo leer el archivo desde GitHub.');
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_DOWNLOAD_BYTES) throw new Error('Archivo superior al límite de 10 MB.');
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    const bytes = new Uint8Array(total);
    let pos = 0;
    for (const chunk of chunks) { bytes.set(chunk, pos); pos += chunk.byteLength; }
    let blob: Blob;
    if (kind === 'svg') {
      const safe = sanitizeExternalSvg(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      blob = new Blob([safe], { type: 'image/svg+xml;charset=utf-8' });
    } else {
      const types: Record<string, string> = { png: 'image/png', webp: 'image/webp', avif: 'image/avif', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', ico: 'image/x-icon', excalidrawlib: 'application/json', cur: 'application/octet-stream', ani: 'application/octet-stream' };
      const extension = asset.path.split('.').at(-1)?.toLowerCase() || '';
      blob = new Blob([new Uint8Array(bytes).buffer], { type: types[extension] || 'application/octet-stream' });
    }
    return { blob, filename: safeDownloadName(repo, asset.path) };
  } catch (error) {
    if (error instanceof TypeError) throw new Error('La fuente no permite la descarga desde el navegador (CORS o conexión).');
    throw error;
  } finally { clearTimeout(timer); }
}
