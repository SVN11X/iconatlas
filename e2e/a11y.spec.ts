import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { waitForCatalog } from './helpers';

for (const theme of ['light', 'dark'] as const) {
  test.describe(`accesibilidad (${theme})`, () => {
    test.use({ colorScheme: theme });
    for (const [name, path] of [['inicio', './'], ['explorar', './#/explore?q=database'], ['ficha', './#/explore?icon=sap-btp:sap-hana-cloud'], ['colecciones', './#/collections']] as const) {
      test(`${name}: sin infracciones WCAG 2.2 A/AA detectables`, async ({ page }) => {
        await page.goto(path);
        if (path.includes('q=')) await waitForCatalog(page);
        else await page.waitForLoadState('networkidle');
        if (path.includes('icon=')) await expect(page.getByTestId('detail-preview')).toBeVisible();
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
        expect(summary).toEqual([]);
      });
    }
  });
}
