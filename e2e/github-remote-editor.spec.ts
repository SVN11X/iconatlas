import { test, expect } from '@playwright/test';
import { pngSize, readDownload } from './helpers';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="#4285f4"><path d="M1 1H47V47H1z"/></svg>';
const index = {
  version: 1, generatedAt: '2026-11-01T00:00:00.000Z',
  sources: [{ id: 'gcp-awesome', name: 'Google Cloud (AwesomeLogos)', repo: 'AwesomeLogos/google-cloud-icons',
    category: 'cloud', status: 'watch', redistributionApproved: false, sha: 'a'.repeat(40), count: 1, partial: false, error: '' }],
  assets: [[0, 'docs/favicon.svg', 0, 150]],
  stats: { registeredSources: 71, indexedSources: 71, partialSources: 0, failedSources: 0, indexedAssets: 397718 },
};

test('un SVG GitHub abre el mismo editor que los iconos locales y exporta SVG y PNG', async ({ page }) => {
  await page.route('**/github-index/index.json', route => route.fulfill({ json: index }));
  await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({
    status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: svg,
  }));
  await page.goto('./#/explore?remoteSource=gcp-awesome');
  const gallery = page.getByTestId('remote-github-results');
  await expect(gallery.getByTestId('remote-github-card')).toHaveCount(1);
  await gallery.getByTestId('remote-github-card').click();
  const editor = page.getByTestId('icon-detail');
  await expect(editor).toBeVisible();
  await expect(editor.getByTestId('detail-preview')).toBeVisible();
  await expect(editor.getByTestId('detail-copy-svg')).toBeVisible();
  await expect(editor.getByTestId('detail-copy-image')).toBeVisible();
  await expect(editor.getByTestId('png-size')).toBeVisible();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await editor.getByTestId('detail-copy-svg').click();
  // El idioma de la interfaz depende del navegador (es/en). Verificamos el resultado real.
  await expect(page.getByRole('status').filter({ hasText: /SVG copiado|SVG copied/i })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^<svg\b/i);

  // El archivo solicitado es docs/favicon.svg, no cloud.svg.
  const [svgFile] = await Promise.all([
    page.waitForEvent('download'),
    editor.getByTestId('detail-download-svg').click(),
  ]);
  expect(svgFile.suggestedFilename()).toBe('favicon.svg');
  const exportedSvg = (await readDownload(svgFile)).toString('utf8');
  expect(exportedSvg).toMatch(/^<svg\b/);
  expect(exportedSvg).toContain('viewBox=');

  await editor.getByTestId('png-size').selectOption('256');
  const [pngFile] = await Promise.all([
    page.waitForEvent('download'),
    editor.getByTestId('detail-download-png').click(),
  ]);
  expect(pngFile.suggestedFilename()).toBe('favicon-256.png');
  expect(pngSize(await readDownload(pngFile))).toMatchObject({ width: 256, height: 256 });
});

test('desde la galería de una fuente GitHub también se abre el editor SVG', async ({ page }) => {
  await page.route('https://api.github.com/repos/AwesomeLogos/google-cloud-icons', route => route.fulfill({ json: {
    full_name: 'AwesomeLogos/google-cloud-icons', default_branch: 'main', archived: false,
  } }));
  await page.route('https://api.github.com/repos/AwesomeLogos/google-cloud-icons/git/trees/**', route => route.fulfill({ json: {
    truncated: false, tree: [{ path: 'docs/favicon.svg', type: 'blob', size: 150 }],
  } }));
  await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({ status: 200,
    contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: svg,
  }));
  await page.goto('./#/sources?source=gcp-awesome');
  await page.getByRole('button', { name: 'Previsualizar docs/favicon.svg' }).click();
  await expect(page.getByTestId('icon-detail')).toBeVisible();
  await expect(page.getByTestId('detail-download-png')).toBeVisible();
});
