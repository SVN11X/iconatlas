import { computePngSize, readPngSize, MAX_PNG_SIDE } from '../services/export/png';

describe('dimensiones PNG', () => {
  it('ajusta el lado mayor al tamaño pedido y conserva la proporción', () => {
    expect(computePngSize('0 0 24 24', { size: 2048 })).toMatchObject({ width: 2048, height: 2048 });
    expect(computePngSize('0 0 200 100', { size: 512 })).toMatchObject({ width: 512, height: 256 });
    expect(computePngSize('0 0 100 200', { size: 4096 })).toMatchObject({ width: 2048, height: 4096 });
  });
  it('centra sin deformar en tamaños personalizados', () => {
    const r = computePngSize('0 0 100 50', { width: 1200, height: 630 });
    expect(r).toMatchObject({ width: 1200, height: 630 });
    expect(r.drawW / r.drawH).toBeCloseTo(2);
  });
  it('limita el tamaño máximo', () => {
    expect(computePngSize('0 0 1 1', { size: 99999 }).width).toBe(MAX_PNG_SIDE);
  });
  it('lee las dimensiones de la cabecera IHDR', async () => {
    const bytes = new Uint8Array(24);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
    new DataView(bytes.buffer).setUint32(16, 2048);
    new DataView(bytes.buffer).setUint32(20, 1024);
    await expect(readPngSize(new Blob([bytes]))).resolves.toEqual({ width: 2048, height: 1024 });
    await expect(readPngSize(new Blob([new Uint8Array(24)]))).rejects.toThrow();
  });
});
