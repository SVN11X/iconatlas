import { describe, expect, it } from 'vitest';
import { safeDownloadName, sanitizeExternalSvg, prepareRemoteAssetDownload } from '../utils/githubAssetDownload';

describe('descarga directa desde GitHub sin navegación externa', () => {
  it('genera nombre seguro y mantiene formato original', () => {
    expect(safeDownloadName('owner/repo', 'icons/flower.svg')).toBe('owner-repo-flower.svg');
  });
  it('sanea SVG válido y rechaza JavaScript externo', () => {
    expect(sanitizeExternalSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M1 1"/></svg>')).toContain('<svg');
    expect(() => sanitizeExternalSvg('<svg onload="alert(1)"></svg>')).toThrow();
    expect(() => sanitizeExternalSvg('<svg><script>alert(1)</script></svg>')).toThrow();
  });
  it('conserva estilos internos y gradientes de un icono legítimo', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="g"><stop offset="0" stop-color="#4285f4"/></linearGradient></defs><style>.cloud{fill:url(#g);stroke:#34a853}</style><path class="cloud" d="M1 1H20V20H1Z"/></svg>`;
    const result = sanitizeExternalSvg(svg);
    expect(result).toContain('.cloud');
    expect(result).toMatch(/linearGradient/i);
    expect(result).toContain('url(#g)');
  });
  it('rechaza CSS remoto y referencias a recursos activos', () => {
    expect(() => sanitizeExternalSvg('<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://example.com/a.css)</style></svg>')).toThrow();
    expect(() => sanitizeExternalSvg('<svg xmlns="http://www.w3.org/2000/svg"><style>.x{fill:url(https://example.com/id)}</style></svg>')).toThrow();
    expect(() => sanitizeExternalSvg('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/icon.png"/></svg>')).toThrow();
    expect(() => sanitizeExternalSvg('<svg xmlns="http://www.w3.org/2000/svg"><path onclick="alert(1)"/></svg>')).toThrow();
  });
  it('descarga a Blob usando solo el host permitido', async () => {
    const fetcher = async (url: string | URL | Request) => {
      expect(String(url)).toBe('https://raw.githubusercontent.com/AwesomeLogos/google-cloud-icons/main/icons/cloud.svg');
      return new Response('<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>');
    };
    const out = await prepareRemoteAssetDownload('AwesomeLogos/google-cloud-icons', 'main', { path: 'icons/cloud.svg', kind: 'svg' }, fetcher as typeof fetch);
    expect(out.filename).toBe('AwesomeLogos-google-cloud-icons-cloud.svg');
    expect(await out.blob.text()).toContain('<svg');
  });
  it('bloquea rutas fuera del repositorio', async () => {
    await expect(prepareRemoteAssetDownload('some/repo', 'main', { path: '../x.svg', kind: 'svg' })).rejects.toThrow('Ruta');
  });
});
