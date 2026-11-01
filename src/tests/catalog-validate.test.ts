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

  it('no publica fichas sin SVG como resultados utilizables', () => {
    const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
    const icons = JSON.parse(readFileSync(join(dir, 'icons.json'), 'utf8'));
    expect(index.stats.references).toBe(0);
    expect(index.collections.every((c: { kind: string }) => c.kind !== 'reference')).toBe(true);
    expect(icons.icons.every((r: unknown[]) => typeof r[6] === 'number' && (r[6] as number) >= 0)).toBe(true);
    const report = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8'));
    expect(report.unpublishedReferences.length).toBeGreaterThan(0);
  });

  it('las estadísticas proceden del catálogo real', () => {
    const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
    const icons = JSON.parse(readFileSync(join(dir, 'icons.json'), 'utf8'));
    expect(index.stats.icons).toBe(icons.icons.length);
    expect(index.stats.downloadable + index.stats.references).toBe(icons.icons.length);
  });
});
