import type { Icon, IconDetail, SvgData } from '../types/catalog';
import { FLAG_MONO } from '../types/catalog';
import { parseViewBox } from '../services/export/svg';
import { sanitizeExternalSvg } from './githubAssetDownload';
import type { RemoteHit } from './universalGithubIndex';
import registry from '../catalog/github-sources.json';

/** Convierte un SVG remoto saneado al mismo formato vectorial que consume el editor local. */
export function remoteSvgToData(input: string): SvgData {
  const safe = sanitizeExternalSvg(input);
  const doc = new DOMParser().parseFromString(safe, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.localName !== 'svg' || doc.querySelector('parsererror')) throw new Error('El SVG remoto no tiene una estructura válida.');
  let viewBox = root.getAttribute('viewBox') || '';
  if (!viewBox) {
    const width = Number.parseFloat(root.getAttribute('width') || '');
    const height = Number.parseFloat(root.getAttribute('height') || '');
    if (!(width > 0 && height > 0)) throw new Error('El SVG remoto no indica viewBox ni dimensiones válidas.');
    viewBox = `0 0 ${width} ${height}`;
  }
  parseViewBox(viewBox);
  // Conserva las propiedades visuales de la raíz; no se ejecutan scripts ni se permiten recursos externos.
  const retained = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'clip-rule', 'opacity', 'color', 'style'];
  const attrs = retained.flatMap(k => {
    const v = root.getAttribute(k);
    return v === null ? [] : [`${k}="${v.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`];
  });
  return { viewBox, body: `<g ${attrs.join(' ')}>${root.innerHTML}</g>` };
}

/** Solo se habilita recoloración cuando hay un color heredado y permiso declarado de modificación. */
export function makeRemoteSvgIcon(hit: RemoteHit, data: SvgData): { icon: Icon; details: IconDetail } {
  const record = registry.sources.find(s => s.id === hit.source.id);
  const name = hit.asset.path.split('/').at(-1)!.replace(/\.svg$/i, '');
  const title = name.replace(/[-_]+/g, ' ');
  const licenseName = record?.license || 'No verificada';
  const licenseUrl = record?.licenseUrl || `https://github.com/${hit.source.repo}`;
  const approved = !!record?.redistributionApproved && record?.status === 'approved';
  const recolor = approved && /currentColor/i.test(data.body);
  const parts = hit.asset.path.split('/').map(encodeURIComponent).join('/');
  const sourceUrl = `https://github.com/${hit.source.repo}/blob/${encodeURIComponent(hit.source.sha)}/${parts}`;
  return {
    icon: {
      idx: -1, id: `github-${hit.source.id}:${hit.asset.path}`, name, title,
      collection: {
        id: `github-${hit.source.id}`, name: hit.source.name, kind: hit.source.category === 'cloud' || hit.source.category === 'brands' ? 'brand' : 'ui',
        provider: 'community', owner: hit.source.repo, homepage: `https://github.com/${hit.source.repo}`,
        license: { spdx: approved ? licenseName : 'UNKNOWN', title: licenseName, url: licenseUrl },
        official: false, permissions: { download: true, redistribute: approved, modify: approved, commercial: 'unverified', attribution: true },
        customization: recolor ? 'free' : 'none',
        restrictions: approved ? ['Comprueba las condiciones de uso de marcas y otros derechos de terceros.'] : ['Licencia o derechos de modificación no verificados; conserva el diseño original.'],
        reviewed: new Date().toISOString().slice(0,10), version: hit.source.sha.slice(0, 12), upstreamVersion: null,
        count: hit.source.count, shards: 0, sourceUrl, source: { type: 'github', package: null, upstream: hit.source.repo, commit: hit.source.sha },
      },
      category: hit.source.category, style: recolor ? 'outline' : 'original', provider: 'community', shard: 0,
      flags: recolor ? FLAG_MONO : 0, tags: [], group: hit.asset.path, hex: '', priority: 0,
    },
    details: { sourceUrl, note: 'Archivo cargado desde GitHub y sanitizado en el navegador. No se almacena en IconAtlas.', license: { type: licenseName, url: licenseUrl } },
  };
}
