export type Lang = 'es' | 'en';
export type Labels = Record<Lang, string>;

export interface License {
  spdx: string;
  title: string;
  url: string;
}

export interface Permissions {
  download: boolean;
  redistribute: boolean;
  modify: boolean;
  commercial: 'yes' | 'no' | 'unverified';
  attribution: boolean;
}

/** free: color/apariencia libres · brand-mono: solo variantes monocromas/color de marca · none: diseño original obligatorio */
export type Customization = 'free' | 'brand-mono' | 'none';

export interface CollectionInfo {
  id: string;
  name: string;
  kind: 'ui' | 'brand' | 'architecture' | 'reference';
  provider: string;
  owner?: string;
  homepage?: string;
  license: License;
  official: boolean;
  permissions: Permissions;
  customization: Customization;
  restrictions: string[];
  attribution?: string;
  notes?: string;
  reviewed: string;
  version: string | null;
  upstreamVersion: string | null;
  count: number;
  shards: number;
  sourceUrl?: string;
  terms?: string;
  defaultStyle?: string;
  source: { type: string; package: string | null; upstream?: string | null; commit?: string | null };
}

export interface OfficialIconSource {
  name: string;
  url: string;
  redistributable: boolean;
  reviewed: string;
  terms: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  shortName?: string;
  kind: 'cloud' | 'vendor' | 'oss';
  featured?: number;
  website: string;
  logoIcon: string | null;
  officialIcons?: OfficialIconSource[];
  count: number;
  downloadable: number;
  references: number;
  collections: string[];
}

export interface CategoryInfo {
  id: string;
  group: string;
  labels: Labels;
  count: number;
}

export interface CatalogIndex {
  version: number;
  generatedAt: string;
  stats: {
    icons: number;
    downloadable: number;
    references: number;
    collections: number;
    libraries: number;
    providers: number;
    categories: number;
  };
  groups: { id: string; labels: Labels }[];
  categories: CategoryInfo[];
  providers: ProviderInfo[];
  collections: CollectionInfo[];
  styles: string[];
  synonyms: string[][];
}

/** Fila compacta de public/catalog/icons.json (ver fields). */
export type IconRow = [
  name: string,
  collection: number,
  title: string,
  category: number,
  style: number,
  provider: number,
  shard: number,
  flags: number,
  tags: string,
  group: string,
  hex: string,
  priority: number,
];

export interface IconsFile {
  version: number;
  fields: string[];
  collections: string[];
  providers: string[];
  categories: string[];
  styles: string[];
  icons: IconRow[];
}

export const FLAG_MONO = 1;
export const FLAG_OFFICIAL = 2;
export const FLAG_BRAND_HEX = 4;
export const FLAG_LEGACY = 8;

export interface Icon {
  /** Índice en el arreglo global */
  idx: number;
  /** Identificador único "colección:nombre" */
  id: string;
  name: string;
  title: string;
  collection: CollectionInfo;
  category: string;
  style: string;
  provider: string;
  shard: number;
  flags: number;
  tags: string[];
  group: string;
  hex: string;
  priority: number;
}

export interface IconDetail {
  sourceUrl?: string;
  family?: string;
  note?: string | null;
  alternatives?: string[];
  source?: string;
  guidelines?: string;
  license?: { type: string; url?: string } | null;
  colors?: string[];
}

export interface SvgData {
  body: string;
  viewBox: string;
}

export interface Catalog {
  index: CatalogIndex;
  icons: Icon[];
  byId: Map<string, Icon>;
  collections: Map<string, CollectionInfo>;
  providers: Map<string, ProviderInfo>;
  categories: Map<string, CategoryInfo>;
}
