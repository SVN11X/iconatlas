import { copyPng, canCopyImage } from '../services/clipboard/clipboard';

describe('portapapeles', () => {
  it('no informa éxito si el navegador no admite copiar imágenes', async () => {
    expect(canCopyImage()).toBe(false);
    const r = await copyPng(new Blob([]));
    expect(r.ok).toBe(false);
  });
});
