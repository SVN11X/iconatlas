import { parseViewBox } from './svg';

export const PNG_SIZES = [64, 128, 256, 512, 1024, 2048, 4096] as const;
export const MAX_PNG_SIDE = 8192;

export interface PngOptions {
  /** Lado mayor en px (la proporción del icono se conserva). */
  size?: number;
  /** Ancho y alto exactos: el icono se centra y se ajusta sin deformarse. */
  width?: number;
  height?: number;
  /** Color de fondo (#rrggbb) o null para transparencia real. */
  background?: string | null;
}

/** Calcula las dimensiones finales del PNG a partir del viewBox del SVG. */
export function computePngSize(viewBox: string, opts: PngOptions): { width: number; height: number; drawW: number; drawH: number } {
  const [, , w, h] = parseViewBox(viewBox);
  const clamp = (n: number) => Math.max(1, Math.min(MAX_PNG_SIDE, Math.round(n)));
  if (opts.width && opts.height) {
    const W = clamp(opts.width), H = clamp(opts.height);
    const s = Math.min(W / w, H / h);
    return { width: W, height: H, drawW: w * s, drawH: h * s };
  }
  const side = clamp(opts.size ?? 1024);
  const s = side / Math.max(w, h);
  const width = clamp(w * s), height = clamp(h * s);
  return { width, height, drawW: width, drawH: height };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('El navegador no pudo interpretar el SVG para generar el PNG.'));
    img.src = src;
  });
}

/**
 * Rasteriza un SVG a PNG en el navegador mediante Canvas.
 * El SVG se dimensiona al tamaño de destino antes de dibujarlo para que el
 * renderizado vectorial se realice a resolución completa (sin reescalar un bitmap).
 * Como la imagen procede de un blob local (mismo origen), el canvas no queda "contaminado".
 */
export async function svgToPng(svg: string, opts: PngOptions = {}): Promise<Blob> {
  const vb = svg.match(/viewBox="([^"]+)"/);
  if (!vb) throw new Error('SVG sin viewBox');
  const { width, height, drawW, drawH } = computePngSize(vb[1], opts);
  const sized = svg.replace(/<svg\b([^>]*)>/, (_m, attrs: string) => {
    const cleaned = attrs.replace(/\s(width|height)="[^"]*"/g, '');
    return `<svg${cleaned} width="${drawW}" height="${drawH}" preserveAspectRatio="xMidYMid meet">`;
  });
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D no disponible en este navegador.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (opts.background) {
      ctx.fillStyle = opts.background;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('No se pudo generar el PNG (memoria insuficiente o tamaño no admitido).');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Lee las dimensiones de un PNG desde su cabecera IHDR. */
export async function readPngSize(blob: Blob): Promise<{ width: number; height: number }> {
  const buf = new Uint8Array(await blob.slice(0, 24).arrayBuffer());
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!sig.every((b, i) => buf[i] === b)) throw new Error('No es un PNG válido');
  const dv = new DataView(buf.buffer);
  return { width: dv.getUint32(16), height: dv.getUint32(20) };
}
