export type ClipboardResult = { ok: true } | { ok: false; reason: 'unsupported' | 'denied' | 'insecure' | 'error'; message: string };

function fail(reason: Exclude<ClipboardResult, { ok: true }>['reason'], message: string): ClipboardResult {
  return { ok: false, reason, message };
}

export function canCopyImage(): boolean {
  if (typeof window === 'undefined' || !window.isSecureContext) return false;
  if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function' || typeof ClipboardItem === 'undefined') return false;
  const supports = (ClipboardItem as unknown as { supports?: (t: string) => boolean }).supports;
  return typeof supports === 'function' ? supports('image/png') : true;
}

/** Copia texto (código SVG, nombre). Usa la API Clipboard y, si no está disponible, execCommand. */
export async function copyText(text: string): Promise<ClipboardResult> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === 'NotAllowedError') return fail('denied', 'El navegador denegó el acceso al portapapeles.');
      /* continuar con el método alternativo */
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok ? { ok: true } : fail('unsupported', 'Este navegador no permite copiar al portapapeles.');
  } catch {
    return fail('unsupported', 'Este navegador no permite copiar al portapapeles.');
  }
}

/**
 * Copia una imagen PNG. Se pasa una Promise<Blob> directamente a ClipboardItem
 * para conservar la "activación de usuario" en Safari mientras se genera el PNG.
 */
export async function copyPng(blob: Promise<Blob> | Blob): Promise<ClipboardResult> {
  if (!window.isSecureContext) return fail('insecure', 'Copiar imágenes requiere HTTPS.');
  if (!canCopyImage()) return fail('unsupported', 'Este navegador no permite copiar imágenes al portapapeles.');
  try {
    const item = new ClipboardItem({ 'image/png': Promise.resolve(blob) });
    await navigator.clipboard.write([item]);
    return { ok: true };
  } catch (e) {
    const name = (e as DOMException)?.name;
    if (name === 'NotAllowedError') return fail('denied', 'El navegador denegó el permiso para escribir imágenes en el portapapeles.');
    return fail('error', (e as Error)?.message || 'No fue posible copiar la imagen.');
  }
}
