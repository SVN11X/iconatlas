import { createStore, KEYS, useStore } from './local';

export interface FavoritesState {
  v: 1;
  ids: string[];
  updatedAt: string;
}

function migrate(raw: unknown): FavoritesState {
  // Admite el formato antiguo (array simple) por si se importan datos de versiones previas.
  if (Array.isArray(raw)) return { v: 1, ids: raw.filter((x) => typeof x === 'string'), updatedAt: new Date().toISOString() };
  const r = raw as Partial<FavoritesState> | null;
  if (r && Array.isArray(r.ids)) return { v: 1, ids: r.ids.filter((x) => typeof x === 'string'), updatedAt: r.updatedAt ?? '' };
  return { v: 1, ids: [], updatedAt: '' };
}

export const favoritesStore = createStore<FavoritesState>(KEYS.favorites, { v: 1, ids: [], updatedAt: '' }, migrate);

export function toggleFavorite(id: string): boolean {
  let added = false;
  favoritesStore.set((s) => {
    const has = s.ids.includes(id);
    added = !has;
    return { v: 1, ids: has ? s.ids.filter((x) => x !== id) : [id, ...s.ids], updatedAt: new Date().toISOString() };
  });
  return added;
}

export function removeFavorites(ids: string[]) {
  const drop = new Set(ids);
  favoritesStore.set((s) => ({ v: 1, ids: s.ids.filter((x) => !drop.has(x)), updatedAt: new Date().toISOString() }));
}

export function useFavorites(): string[] {
  return useStore(favoritesStore).ids;
}
