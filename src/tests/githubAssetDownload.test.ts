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
