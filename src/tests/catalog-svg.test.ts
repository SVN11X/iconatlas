import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import DOMPurify from 'dompurify';
import { hydrate } from '../services/catalog/catalogStore';
import { buildSvg } from '../services/export/svg';
import type { CatalogIndex, IconsFile } from '../types/catalog';

const dir = join(__dirname, '../../public/catalog');
const ready = existsSync(join(dir, 'index.json'));

describe.skipIf(!ready)('SVG del catálogo real', () => {
  const index = ready ? (JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as CatalogIndex) : null!;
  const file = ready ? (JSON.parse(readFileSync(join(dir, 'icons.json'), 'utf8')) as IconsFile) : null!;
  const catalog = ready ? hydrate(index, file) : null!;

  it('todas las colecciones descargables producen SVG válidos y seguros (primer fragmento)', () => {
    const failures: string[] = [];
    for (const c of index.collections.filter((x) => x.kind !== 'reference')) {
      const shard = JSON.parse(readFileSync(join(dir, 'svg', c.id, '0.json'), 'utf8')) as Record<string, [string, string]>;
      for (const [name, [body, viewBox]] of Object.entries(shard)) {
        const icon = catalog.byId.get(`${c.id}:${name}`)!;
        try {
          const svg = buildSvg(icon, { body, viewBox });
          const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
          if (doc.getElementsByTagName('parsererror').length) failures.push(`${icon.id}: XML inválido`);
        } catch (e) {
          failures.push(`${icon.id}: ${(e as Error).message} :: ${JSON.stringify(DOMPurify.removed.slice(0, 3).map((r: any) => r.attribute?.name ?? r.element?.nodeName))}`);
        }
      }
    }
    expect(failures.slice(0, 20)).toEqual([]);
  });
});
