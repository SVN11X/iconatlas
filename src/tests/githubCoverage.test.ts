import { describe, expect, it } from 'vitest';
import { githubSourceCount, githubSources, uniqueLibraryCount, type GithubCoverage } from '../utils/githubCoverage';

describe('bibliotecas locales y fuentes GitHub unificadas', () => {
  it('cuenta bibliotecas únicas sin duplicar repositorios ya integrados', () => {
    expect(githubSources).toHaveLength(71);
    expect(uniqueLibraryCount(['iconoir', 'lucide', 'biblioteca-local'])).toBe(72);
  });

  it('muestra el recuento publicado de Google Cloud sin atribuirlo a la colección local', () => {
    const report: GithubCoverage = {
      generatedAt: '2026-11-01T00:00:00Z',
      stats: { registeredSources: 71, indexedSources: 71, partialSources: 2, failedSources: 0, indexedAssets: 397718 },
      sources: [{ id: 'gcp-awesome', repo: 'AwesomeLogos/google-cloud-icons', count: 218, partial: false, error: '' }],
    };
    expect(githubSourceCount(report, 'gcp-awesome')).toBe(218);
    expect(githubSourceCount(null, 'gcp-awesome')).toBeNull();
  });
});
