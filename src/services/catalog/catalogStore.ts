import type { Catalog, CatalogIndex, Icon, IconDetail, IconsFile, SvgData } from '../../types/catalog';
import { FLAG_MONO } from '../../types/catalog';

const BASE = `${import.meta.env.BASE_URL}catalog/`;

let catalogPromise: Promise<Catalog> | null = null;
const shardCache = new Map<string, Promise<Record<string, [string, string]>>>();
const detailCache = new Map<string, Promise<Record<string, IconDetail>>>();
let cacheName: string | null = null;

async function fetchJson<T>(path: string, persistent = false): Promise<T> {
  const url = BASE + path;
  // Caché local persistente (Cache Storage) para fragmentos SVG, versionada por compilación.
  if (persistent && cacheName && typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(cacheName);
      const hit = await cache.match(url);
      if (hit) return (await hit.json()) as T;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} al cargar ${path}`);
      cache.put(url, res.clone()).catch(() => undefined);
      return (await res.json()) as T;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('HTTP')) throw e;
      /* Cache Storage no disponible: continuar con fetch normal */
    }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} al cargar ${path}`);
  return (await res.json()) as T;
}

export function hydrate(index: CatalogIndex, file: IconsFile): Catalog {
  const collections = new Map(index.collections.map((c) => [c.id, c]));
  const providers = new Map(index.providers.map((p) => [p.id, p]));
  const categories = new Map(index.categories.map((c) => [c.id, c]));
  const collArr = file.collections.map((id) => collections.get(id)!);
  const icons: Icon[] = new Array(file.icons.length);
  const byId = new Map<string, Icon>();
  file.icons.forEach((r, idx) => {
    const collection = collArr[r[1]];
    const icon: Icon = {
      idx,
      id: `${collection.id}:${r[0]}`,
      name: r[0],
      title: r[2],
      collection,
      category: file.categories[r[3]],
      style: file.styles[r[4]],
      provider: file.providers[r[5]] ?? 'community',
      shard: r[6],
      flags: r[7],
      tags: r[8] ? r[8].split('|') : [],
      group: r[9],
      hex: r[10],
      priority: r[11],
    };
    icons[idx] = icon;
    byId.set(icon.id, icon);
  });
  return { index, icons, byId, collections, providers, categories };
}

export function loadCatalog(): Promise<Catalog> {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      const [index, file] = await Promise.all([fetchJson<CatalogIndex>('index.json'), fetchJson<IconsFile>('icons.json')]);
      cacheName = `iconatlas-catalog-${index.generatedAt}`;
      cleanupOldCaches(cacheName);
      return hydrate(index, file);
    })();
    catalogPromise.catch(() => {
      catalogPromise = null;
    });
  }
  return catalogPromise;
}

function cleanupOldCaches(current: string) {
  if (typeof caches === 'undefined') return;
  caches
    .keys()
    .then((keys) => keys.filter((k) => k.startsWith('iconatlas-catalog-') && k !== current).forEach((k) => caches.delete(k)))
    .catch(() => undefined);
}

export function isDownloadable(icon: Icon): boolean {
  return icon.shard >= 0 && icon.collection.permissions.download;
}

export function isMono(icon: Icon): boolean {
  return (icon.flags & FLAG_MONO) === FLAG_MONO;
}

export async function getSvgData(icon: Icon): Promise<SvgData> {
  if (icon.shard < 0) throw new Error('Este recurso no dispone de archivo local (solo enlace a la fuente oficial).');
  const key = `${icon.collection.id}/${icon.shard}`;
  let p = shardCache.get(key);
  if (!p) {
    p = fetchJson<Record<string, [string, string]>>(`svg/${key}.json`, true);
    shardCache.set(key, p);
    p.catch(() => shardCache.delete(key));
  }
  const shard = await p;
  const entry = shard[icon.name];
  if (!entry) throw new Error(`No se encontró el SVG de ${icon.id}`);
  return { body: entry[0], viewBox: entry[1] };
}

export async function getDetails(icon: Icon): Promise<IconDetail> {
  const id = icon.collection.id;
  let p = detailCache.get(id);
  if (!p) {
    p = fetchJson<Record<string, IconDetail>>(`details/${id}.json`);
    detailCache.set(id, p);
    p.catch(() => detailCache.delete(id));
  }
  return (await p)[icon.name] ?? {};
}

/** Solo para pruebas */
export function __resetCatalogForTests() {
  catalogPromise = null;
  shardCache.clear();
  detailCache.clear();
}
