import { expect, type Page, type Download } from '@playwright/test';
import { readFileSync } from 'node:fs';

export async function waitForCatalog(page: Page) {
  await expect(page.getByTestId('icon-card').first()).toBeVisible({ timeout: 30_000 });
}

export async function readDownload(d: Download): Promise<Buffer> {
  const p = await d.path();
  return readFileSync(p!);
}

export function pngSize(buf: Buffer) {
  expect(buf.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25] };
}
