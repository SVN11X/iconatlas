import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const dir = join(__dirname, '../../public/catalog');
const ready = existsSync(join(dir, 'index.json'));

describe.skipIf(!ready)('catálogo generado', () => {
  it('pasa la validación completa (IDs únicos, categorías, rutas, SVG seguros, permisos)', () => {
    // Ejecutar el CLI Node evita cargar scripts ESM de compilación dentro del runtime de Vitest/jsdom.
    const output = execFileSync(process.execPath, ['scripts/validate-icons/index.mjs'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 60000,
    });
    expect(output).toMatch(/\[validate\] OK:/);
  });

  it('las fichas oficiales restringidas no incluyen archivos descargables', () => {
    const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
    const icons = JSON.parse(readFileSync(join(dir, 'icons.json'), 'utf8'));
    const refIdx = new Set(index.collections.map((c: { kind: string }, i: number) => (c.kind === 'reference' ? i : -1)).filter((i: number) => i >= 0));
    const refs = icons.icons.filter((r: unknown[]) => refIdx.has(r[1]));
    expect(refs.length).toBeGreaterThan(200);
    expect(refs.every((r: unknown[]) => r[6] === -1)).toBe(true);
    for (const c of index.collections) if (c.kind === 'reference') expect(existsSync(join(dir, 'svg', c.id))).toBe(false);
  });

  it('las estadísticas proceden del catálogo real', () => {
    const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
    const icons = JSON.parse(readFileSync(join(dir, 'icons.json'), 'utf8'));
    expect(index.stats.icons).toBe(icons.icons.length);
    expect(index.stats.downloadable + index.stats.references).toBe(icons.icons.length);
  });
});
