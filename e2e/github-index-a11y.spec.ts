import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { waitForCatalog } from './helpers';

// Reproduce el fallo detectado en CI: las pruebas con el índice provisional vacío
// no renderizaban tarjetas remotas y no verificaban sus nombres accesibles.
const remoteIndex = {
  version: 1,
  generatedAt: '2026-11-01T00:00:00.000Z',
  sources: [{
    id: 'gcp-awesome', name: 'Google Cloud', repo: 'AwesomeLogos/google-cloud-icons',
    category: 'cloud', status: 'watch', redistributionApproved: false,
    sha: 'a'.repeat(40), count: 2, partial: false, error: '',
  }],
  assets: [
    [0, 'icons/cloud-storage.svg', 0, 180],
    [0, 'assets/cloud-compute.svg', 0, 180],
  ],
  stats: { registeredSources: 1, indexedSources: 1, partialSources: 0, failedSources: 0, indexedAssets: 2 },
};

for (const theme of ['light', 'dark'] as const) {
  test(`resultados GitHub poblados accesibles (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.route('**/github-index/index.json', route => route.fulfill({ json: remoteIndex }));
    await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /></svg>',
    }));

    await page.goto('./#/explore?q=cloud');
    await waitForCatalog(page);
    const remote = page.getByTestId('remote-github-results');
    const cards = remote.getByTestId('remote-github-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.filter({ hasText: 'cloud-storage.svg' })).toHaveAccessibleName('cloud-storage.svg Google Cloud');

    const results = await new AxeBuilder({ page })
      .include('[data-testid="remote-github-results"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
}
