import { zipSync, strToU8 } from 'fflate';
import type { Icon } from '../../types/catalog';

export interface ZipEntry {
  icon: Icon;
  svg?: string;
  png?: Uint8Array;
}

/** Carpeta del ZIP: proveedor (azure, aws, google-cloud, sap...) o colección para bibliotecas abiertas. */
export function zipFolder(icon: Icon): string {
  if (icon.provider === 'microsoft' && /azure/.test(icon.name)) return 'azure';
  if (icon.provider && icon.provider !== 'community') return icon.provider;
  return icon.collection.id;
}

export function attributionText(icons: Icon[]): string {
  const seen = new Map<string, Icon['collection']>();
  for (const i of icons) seen.set(i.collection.id, i.collection);
  const lines = [
    'IconAtlas — exportación',
    `Generado: ${new Date().toISOString()}`,
    '',
    'Licencias y atribuciones de las colecciones incluidas:',
    '',
  ];
  for (const c of seen.values()) {
    lines.push(`• ${c.name} — ${c.owner ?? ''}`);
    lines.push(`  Licencia: ${c.license.title} (${c.license.spdx}) ${c.license.url}`);
    if (c.attribution) lines.push(`  Atribución requerida: ${c.attribution}`);
    for (const r of c.restrictions) lines.push(`  Restricción: ${r}`);
    lines.push('');
  }
  lines.push('Las marcas comerciales y logotipos pertenecen a sus respectivos propietarios.');
  return lines.join('\n');
}

/** Construye el ZIP en memoria (localmente, sin servidor). */
export function buildZip(entries: ZipEntry[]): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const used = new Set<string>();
  for (const e of entries) {
    const folder = zipFolder(e.icon);
    let base = `${folder}/${e.icon.name}`;
    if (used.has(base)) base = `${folder}/${e.icon.name}-${e.icon.collection.id}`;
    used.add(base);
    if (e.svg) files[`${base}.svg`] = strToU8(e.svg);
    if (e.png) files[`${base}.png`] = e.png;
  }
  files['LICENSES.txt'] = strToU8(attributionText(entries.map((e) => e.icon)));
  return zipSync(files, { level: 6 });
}
