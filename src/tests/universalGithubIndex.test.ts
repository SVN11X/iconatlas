import { describe, it, expect } from 'vitest';
import { searchRemoteIndex, validateRemoteIndex, type RemoteIndex } from '../utils/universalGithubIndex';

const SHA = 'a'.repeat(40);
const index: RemoteIndex = {
  version: 1, generatedAt: '2026-11-01T00:00:00Z',
  sources: [
    { id: 'gcp-awesome', name: 'Google Cloud', repo: 'AwesomeLogos/google-cloud-icons', category: 'cloud', status: 'watch', redistributionApproved: false, sha: SHA, count: 2, partial: false, error: '' },
    { id: 'other', name: 'Other', repo: 'someone/icons', category: 'ui', status: 'approved', redistributionApproved: true, sha: SHA, count: 1, partial: false, error: '' },
  ],
  assets: [[0, 'icons/compute-engine.svg', 0, 200], [0, 'icons/cloud-storage.svg', 0, 190], [1, 'cloud-storage.svg', 0, 100]],
  stats: { registeredSources: 2, indexedSources: 2, partialSources: 0, failedSources: 0, indexedAssets: 3 },
};

describe('buscador universal de archivos GitHub', () => {
  it('busca por título de icono y por fuente, incluido Google Cloud', () => {
    expect(searchRemoteIndex(index, 'compute engine').total).toBe(1);
    expect(searchRemoteIndex(index, 'google cloud').total).toBe(2);
    expect(searchRemoteIndex(index, 'cloud-storage').total).toBe(2);
  });
  it('abre una biblioteca GitHub completa aunque la búsqueda esté vacía', () => {
    const results = searchRemoteIndex(index, '', 120, 'gcp-awesome');
    expect(results.total).toBe(2);
    expect(results.matches.every(h => h.source.id === 'gcp-awesome')).toBe(true);
    expect(searchRemoteIndex(index, '').total).toBe(0);
    expect(searchRemoteIndex(index, 'cloud', 120, 'other').total).toBe(1);
  });
  it('mantiene los resultados remotos separados de las cifras de iconos locales', () => {
    const results = searchRemoteIndex(index, 'cloud', 1);
    expect(results.total).toBe(3);
    expect(results.matches).toHaveLength(1);
    expect(results.matches[0].asset.kind).toBe('svg');
  });
  it('rechaza índices inválidos y rutas inseguras aunque el JSON sea externo', () => {
    expect(validateRemoteIndex(index)).toBe(true);
    expect(validateRemoteIndex({ ...index, sources: [], assets: index.assets })).toBe(false);
    const changed = { ...index, assets: [[0, '../escape.svg', 0, 10]] };
    expect(searchRemoteIndex(changed as RemoteIndex, 'escape').total).toBe(0);
  });
});
