import { test, expect } from '@playwright/test';
import { unzipSync, strFromU8 } from 'fflate';
import { PNG } from './png-decode';
import { pngSize, readDownload, waitForCatalog } from './helpers';

test.describe('despliegue bajo /iconatlas/', () => {
  test('todos los recursos se cargan desde la subruta sin errores 404', async ({ page }) => {
    const failed: string[] = [];
    page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
    page.on('pageerror', (e) => failed.push(String(e)));
    await page.goto('./');
    await expect(page.getByTestId('stats')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const scripts = await page.locator('script[src]').evaluateAll((els) => els.map((e) => (e as HTMLScriptElement).src));
    const base = process.env.BASE_PATH ?? '/iconatlas/';
    for (const s of scripts) expect(new URL(s).pathname.startsWith(base)).toBe(true);
    await page.goto('./#/explore?q=python');
    await waitForCatalog(page);
    expect(failed).toEqual([]);
  });

  test('las estadísticas proceden del catálogo real', async ({ page, request }) => {
    const index = await (await request.get('catalog/index.json')).json();
    await page.goto('./');
    const stats = page.getByTestId('stats');
    await expect(stats).toBeVisible();
    const text = (await stats.innerText()).replace(/[.,\s]/g, '');
    expect(text).toContain(String(index.stats.icons));
  });
});

test('flujo: buscar → abrir ficha → PNG 2048 × 2048 → archivo válido y transparente', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('hero-search-input').fill('python');
  await page.getByTestId('hero-search-input').press('Enter');
  await expect(page).toHaveURL(/#\/explore\?q=python/);
  await waitForCatalog(page);
  await page.locator('[data-icon-id="devicon:python"] button[data-idx]').first().click();
  const detail = page.getByTestId('icon-detail');
  await expect(detail).toBeVisible();
  await expect(detail.getByTestId('detail-preview')).toBeVisible();
  await detail.getByTestId('png-size').selectOption('2048');
  const [dl] = await Promise.all([page.waitForEvent('download'), detail.getByTestId('detail-download-png').click()]);
  expect(dl.suggestedFilename()).toBe('python-2048.png');
  const buf = await readDownload(dl);
  expect(pngSize(buf)).toMatchObject({ width: 2048, height: 2048 });
  const img = PNG.decode(buf);
  expect(img.alphaAt(0, 0)).toBe(0); // esquina transparente
  expect(img.maxAlpha()).toBe(255); // hay contenido opaco
});

test('descarga SVG original válido con viewBox y colores', async ({ page }) => {
  await page.goto('./#/explore?icon=sap-btp:sap-hana-cloud');
  const detail = page.getByTestId('icon-detail');
  await expect(detail.getByTestId('detail-preview')).toBeVisible();
  const [dl] = await Promise.all([page.waitForEvent('download'), detail.getByTestId('detail-download-svg').click()]);
  expect(dl.suggestedFilename()).toBe('sap-hana-cloud.svg');
  const svg = (await readDownload(dl)).toString('utf8');
  expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  expect(svg).toContain('viewBox="0 0 16 16"');
  expect(svg).toMatch(/linearGradient/);
  expect(svg).not.toMatch(/<script|on\w+=/i);
  const ok = await page.evaluate((s) => new DOMParser().parseFromString(s, 'image/svg+xml').getElementsByTagName('parsererror').length === 0, svg);
  expect(ok).toBe(true);
});

test('fondo blanco en PNG y color personalizado en iconos libres', async ({ page }) => {
  await page.goto('./#/explore?icon=lucide:server');
  const detail = page.getByTestId('icon-detail');
  await expect(detail.getByTestId('detail-preview')).toBeVisible();
  await detail.getByRole('radio', { name: 'White' }).last().click().catch(async () => detail.getByRole('radio', { name: 'Blanco' }).last().click());
  await detail.getByTestId('png-size').selectOption('256');
  const [dl] = await Promise.all([page.waitForEvent('download'), detail.getByTestId('detail-download-png').click()]);
  const img = PNG.decode(await readDownload(dl));
  expect(img.width).toBe(256);
  expect(img.alphaAt(0, 0)).toBe(255);
  expect(img.rgbAt(0, 0)).toEqual([255, 255, 255]);
});

test('copiar imagen y SVG al portapapeles', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Permisos de portapapeles solo en Chromium');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./#/explore?icon=devicon:docker');
  const detail = page.getByTestId('icon-detail');
  await expect(detail.getByTestId('detail-preview')).toBeVisible();
  await detail.getByTestId('detail-copy-svg').click();
  await expect(page.getByRole('status').filter({ hasText: /SVG cop/ })).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toMatch(/^<svg/);
  const copyImage = detail.getByTestId('detail-copy-image');
  if (await copyImage.isEnabled()) {
    await copyImage.click();
    await expect(page.getByRole('status').filter({ hasText: /Ima?ge?n? cop|Image copied/ })).toBeVisible();
    const types = await page.evaluate(async () => (await navigator.clipboard.read()).flatMap((i: ClipboardItem) => [...i.types]));
    expect(types).toContain('image/png');
  }
});

test('descarga múltiple: ZIP con SVG + PNG organizado por carpetas', async ({ page }) => {
  await page.goto('./#/explore?q=kubernetes');
  await waitForCatalog(page);
  const cards = page.getByTestId('icon-card');
  await cards.nth(0).hover();
  await cards.nth(0).getByTestId('select-toggle').click();
  await cards.nth(1).hover();
  await cards.nth(1).getByTestId('select-toggle').click();
  // Incluir un recurso de proveedor (SAP) para comprobar las carpetas
  await page.goto('./#/explore?q=sap%20hana%20cloud');
  await waitForCatalog(page);
  const sap = page.locator('[data-icon-id="sap-btp:sap-hana-cloud"]').first();
  await sap.hover();
  await sap.getByTestId('select-toggle').click();
  await expect(page.getByTestId('selection-count')).toContainText('3');
  await page.getByTestId('open-zip').click();
  const dialog = page.getByTestId('zip-dialog');
  await dialog.getByText('SVG + PNG').click();
  await dialog.getByTestId('zip-size').selectOption('128');
  const [dl] = await Promise.all([page.waitForEvent('download'), dialog.getByTestId('zip-generate').click()]);
  expect(dl.suggestedFilename()).toBe('iconatlas-export.zip');
  const files = unzipSync(new Uint8Array(await readDownload(dl)));
  const names = Object.keys(files);
  expect(names).toContain('LICENSES.txt');
  expect(names).toContain('sap/sap-hana-cloud.svg');
  expect(names).toContain('sap/sap-hana-cloud.png');
  expect(names.filter((n) => n.endsWith('.svg'))).toHaveLength(3);
  expect(names.filter((n) => n.endsWith('.png'))).toHaveLength(3);
  for (const n of names.filter((x) => x.endsWith('.png'))) expect(pngSize(Buffer.from(files[n])).width).toBe(128);
  expect(strFromU8(files['LICENSES.txt'])).toContain('Apache');
});

test('favoritos persisten entre sesiones', async ({ page }) => {
  await page.goto('./#/explore?q=terraform');
  await waitForCatalog(page);
  const card = page.getByTestId('icon-card').first();
  const id = await card.getAttribute('data-icon-id');
  await card.hover();
  await card.getByTestId('action-favorite').click();
  await page.reload();
  await page.goto('./#/favorites');
  await expect(page.locator(`[data-icon-id="${id}"]`)).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('iconatlas:favorites:v1') || '{}'));
  expect(stored.ids).toContain(id);
});

test('filtros combinables reflejados en la URL', async ({ page }) => {
  await page.goto('./#/explore?provider=sap&feature=svg');
  await waitForCatalog(page);
  const ids = await page.getByTestId('icon-card').evaluateAll((els) => els.slice(0, 30).map((e) => e.getAttribute('data-icon-id')));
  expect(ids.length).toBeGreaterThan(5);
  for (const id of ids) expect(id).toMatch(/^(sap-btp|sap-icons|logos|simple-icons|devicon):/);
  await page.locator('#facet-category input[type=checkbox]').first().click();
  await expect(page).toHaveURL(/category=[a-z-]+/);
  await expect(page).toHaveURL(/provider=sap/);
});

test('recursos oficiales restringidos: búsqueda interna sin redirección y sin descarga', async ({ page }) => {
  await page.goto('./#/explore?q=azure%20data%20factory');
  await waitForCatalog(page);
  await page.locator('[data-icon-id="azure-architecture:azure-data-factory"] button[data-idx]').first().click();
  const detail = page.getByTestId('icon-detail');
  await expect(detail.getByTestId('external-panel')).toBeVisible();
  await expect(detail.getByTestId('detail-download-png')).toHaveCount(0);
  const link = detail.getByRole('link', { name: /find icons inside iconatlas|buscar iconos dentro de iconatlas/i });
  await expect(link).toHaveAttribute('href', /#\/explore\?q=/);
  await link.click();
  await expect(page).toHaveURL(/#\/explore\?q=/);
  await expect(page.getByTestId('icon-detail')).toHaveCount(0);
});

test('búsqueda: atajo Ctrl+K, autocompletado y sinónimos', async ({ page }) => {
  await page.goto('./#/collections');
  await page.keyboard.press('Control+k');
  const input = page.getByTestId('search-input');
  await expect(input).toBeFocused();
  await input.fill('base de datos');
  await expect(page.getByRole('listbox')).toBeVisible();
  await input.press('Enter');
  await waitForCatalog(page);
  const count = await page.getByTestId('result-count').innerText();
  expect(Number(count.replace(/\D/g, ''))).toBeGreaterThan(50);
});

test('estado vacío informativo', async ({ page }) => {
  await page.goto('./#/explore?q=zzqqxxyyww');
  await expect(page.getByTestId('empty-state')).toBeVisible({ timeout: 30_000 });
});

test('tema oscuro persistente', async ({ page }) => {
  await page.goto('./');
  const before = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  await page.getByRole('button', { name: /theme|tema/i }).click();
  await page.reload();
  const after = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  expect(after).toBe(!before);
});
