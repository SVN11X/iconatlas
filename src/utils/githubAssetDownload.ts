import DOMPurify from 'dompurify';
import { classifyAsset, upstreamImageUrl, type RepoAsset } from './githubSourceGallery';

/** Se descarga desde GitHub al navegador del visitante: IconAtlas no replica la fuente. */
const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024;

export function safeDownloadName(repo: string, path: string): string {
  const leaf = path.split('/').at(-1) || 'asset.svg';
  const normalized = leaf.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 140);
  return `${repo.replace('/', '-')}-${normalized}`;
}

export function sanitizeExternalSvg(input: string): string {
  if (!/<svg(?:\s|>)/i.test(input)) throw new Error('El archivo no contiene un SVG válido.');
  // Conserva referencias internas (#id), pero bloquea contenidos activos y enlaces externos.
  if (/<\s*(?:script|foreignObject|iframe|object|embed|image|style)\b|\bon\w+\s*=|@import\b/i.test(input))
    throw new Error('El SVG contiene contenido activo o elementos no compatibles.');
  for (const m of input.matchAll(/\b(?:href|xlink:href)\s*=\s*(["'])(.*?)\1/gi)) {
    if (!/^#[a-zA-Z0-9_:.-]+$/.test(m[2].trim())) throw new Error('El SVG contiene referencias externas.');
  }
  if (/\b(?:href|xlink:href)\s*=\s*[^"'\s]/i.test(input) || /url\(\s*(?!["']?#)/i.test(input))
    throw new Error('El SVG contiene referencias no seguras.');
  const clean = DOMPurify.sanitize(input, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'image', 'style'],
  });
  if (typeof clean !== 'string' || !/<svg(?:\s|>)/i.test(clean)) throw new Error('No se pudo sanitizar el SVG.');
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
