import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Playwright carga las pruebas con Node.js; evitar imports JSON sin atributo type: 'json'.
const githubRegistry = JSON.parse(readFileSync(new URL('../src/catalog/github-sources.json', import.meta.url), 'utf8')) as { sources: { id: string }[] };

const remoteIndex = {
  version: 1, generatedAt: '2026-11-01T00:00:00Z',
  sources: [{ id: 'gcp-awesome', name: 'Google Cloud (AwesomeLogos)', repo: 'AwesomeLogos/google-cloud-icons',
    category: 'cloud', status: 'watch', redistributionApproved: false, sha: 'a'.repeat(40), count: 2, partial: false, error: '' }],
  assets: [[0, 'product/cloud-storage.svg', 0, 200], [0, 'product/compute-engine.svg', 0, 200]],
  stats: { registeredSources: 71, indexedSources: 71, partialSources: 2, failedSources: 0, indexedAssets: 397718 },
};
const report = { generatedAt: '2026-11-01T00:00:00Z', stats: remoteIndex.stats,
  sources: [{ id: 'gcp-awesome', repo: 'AwesomeLogos/google-cloud-icons', count: 218, partial: false, error: '' }],
};

test('muestra todas las bibliotecas y agrega Google Cloud remoto al buscador', async ({ page }) => {
  await page.route('**/github-index/report.json', route => route.fulfill({ json: report }));
  await page.route('**/github-index/index.json', route => route.fulfill({ json: remoteIndex }));
  await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /></svg>',
  }));
  await page.goto('./#/collections');
  // /collections presenta una tabla, no tarjetas de iconos; la cifra cambia al descubrir fuentes.
  const librariesHeading = page.getByRole('heading', { name: /Bibliotecas integradas|Integrated libraries/i });
  await expect(librariesHeading).toBeVisible();
  const libraryRows = page.getByRole('table').locator('tbody tr');
  const libraryCount = await libraryRows.count();
  expect(libraryCount).toBeGreaterThanOrEqual(githubRegistry.sources.length);
  await expect(librariesHeading).toContainText(new RegExp(`·\\s*${libraryCount}$`));
  const googleRow = page.getByRole('row').filter({ hasText: 'AwesomeLogos/google-cloud-icons' });
  await expect(googleRow).toContainText('218');
  await googleRow.getByRole('link', { name: 'Google Cloud (AwesomeLogos)' }).click();
  await expect(page).toHaveURL(/remoteSource=gcp-awesome/);
  const remote = page.getByTestId('remote-github-results');
  await expect(remote.getByTestId('remote-github-card')).toHaveCount(2);
});
