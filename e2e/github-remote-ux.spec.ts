import { test, expect } from '@playwright/test';

const index = {
  version: 1, generatedAt: '2026-11-01T00:00:00.000Z',
  sources: [{ id: 'gcp-awesome', name: 'Google Cloud', repo: 'AwesomeLogos/google-cloud-icons',
    category: 'cloud', status: 'watch', redistributionApproved: false,
    sha: 'a'.repeat(40), count: 1, partial: false, error: '' }],
  assets: [[0, 'docs/images/access_context_manager.svg', 0, 420]],
  stats: { registeredSources: 71, indexedSources: 71, partialSources: 0, failedSources: 0, indexedAssets: 397718 },
};
const styled = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="g"><stop offset="0" stop-color="#4285f4"/><stop offset="1" stop-color="#34a853"/></linearGradient></defs><style>.cls-1{fill:url(#g)}</style><path class="cls-1" d="M1 1H23V23H1Z"/></svg>`;

test('un SVG con CSS interno legítimo abre el editor normal', async ({ page }) => {
  await page.route('**/github-index/index.json', route => route.fulfill({ json: index }));
  await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({ contentType: 'image/svg+xml',
    headers: { 'access-control-allow-origin': '*' }, body: styled }));
  await page.goto('./#/explore?remoteSource=gcp-awesome');
  await page.getByTestId('remote-github-card').click();
  const editor = page.getByTestId('icon-detail');
  await expect(editor).toBeVisible();
  await expect(editor.getByTestId('detail-preview')).toBeVisible();
  await expect(editor.getByTestId('detail-download-svg')).toBeEnabled();
});

test('el panel se muestra sin esperar la respuesta de GitHub', async ({ page }) => {
  await page.route('**/github-index/index.json', route => route.fulfill({ json: index }));
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('https://raw.githubusercontent.com/**', async route => {
    // La miniatura no debe quedar bloqueada: solo demoramos la petición del editor.
    if (route.request().resourceType() !== 'image') await gate;
    await route.fulfill({ status: 200, contentType: 'image/svg+xml',
      headers: { 'access-control-allow-origin': '*' }, body: styled });
  });
  await page.goto('./#/explore?remoteSource=gcp-awesome');
  await page.getByTestId('remote-github-card').click();
  const editor = page.getByTestId('icon-detail');
  await expect(editor).toBeVisible();
  await expect(editor.getByTestId('remote-editor-loading')).toBeVisible();
  await expect(editor.getByTestId('detail-download-svg')).toBeDisabled();
  release();
  await expect(editor.getByTestId('detail-preview')).toBeVisible();
});

test('los SVG de cualquier biblioteca pueden guardarse en Favoritos', async ({ page }) => {
  await page.route('**/github-index/index.json', route => route.fulfill({ json: index }));
  await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({
    contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: styled,
  }));
  await page.goto('./#/explore?remoteSource=gcp-awesome');
  const card = page.getByTestId('remote-github-card');
  await expect(card).toHaveCount(1);
  await card.hover();
  await card.getByTestId('action-favorite').click();
  await page.goto('./#/favorites');
  await expect(page.getByTestId('remote-github-card')).toHaveCount(1);
  await page.getByTestId('remote-github-card').click();
  await expect(page.getByTestId('icon-detail').getByTestId('detail-preview')).toBeVisible();
});
