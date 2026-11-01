import { describe, expect, it } from 'vitest';
import registry from '../catalog/github-sources.json';
import { classifyAsset, getAssets, matchSources, upstreamImageUrl } from '../utils/githubSourceGallery';

const sources = registry.sources;

describe('explorador integrado de fuentes GitHub', () => {
  it('hace visibles todas las fuentes registradas, no solo las aprobadas para importación', () => {
    expect(sources.length).toBeGreaterThanOrEqual(71);
    expect(matchSources(sources, 'AwesomeLogos/google-cloud-icons').map(s => s.id)).toContain('gcp-awesome');
    expect(matchSources(sources, '').length).toBe(sources.length);
  });
  it('valida rutas SVG/PNG sin aceptar rutas inseguras ni archivos sobredimensionados', () => {
    expect(classifyAsset('svg/cpu.svg', 1234)).toBe('svg');
    expect(classifyAsset('img/icon.png', 23)).toBe('raster');
    expect(classifyAsset('library/cloud.excalidrawlib', 123)).toBe('library');
    expect(classifyAsset('cursor/move.cur', 123)).toBe('cursor');
    expect(classifyAsset('../evil.svg')).toBeNull();
    expect(classifyAsset('assets/script.svg?x=1')).toBeNull();
    expect(classifyAsset('oversize.svg', 12_000_000)).toBeNull();
    expect(classifyAsset('icons/readme.md')).toBeNull();
  });
  it('filtra assets mediante el árbol de GitHub', () => {
    expect(getAssets({ tree: [
      { type: 'blob', path: 'svg/cloud.svg', size: 100 },
      { type: 'blob', path: 'svg/cloud.svg', size: 100 },
      { type: 'blob', path: 'svg/x.png', size: 100 },
      { type: 'blob', path: 'src/index.js', size: 100 },
      { type: 'blob', path: '../bad.svg', size: 100 },
    ] })).toHaveLength(2);
  });
  it('solo crea URLs de imágenes en el host GitHub permitido', () => {
    expect(upstreamImageUrl('AwesomeLogos/google-cloud-icons', 'main', 'icons/cloud.svg')).toBe('https://raw.githubusercontent.com/AwesomeLogos/google-cloud-icons/main/icons/cloud.svg');
    expect(upstreamImageUrl('evil.invalid/a/../../', 'main', 'x.svg')).toBeNull();
    expect(upstreamImageUrl('foo/bar', 'main', '../../evil.svg')).toBeNull();
  });
});
