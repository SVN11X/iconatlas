import { createStore, KEYS, useStore } from './local';

export const recentStore = createStore<string[]>(KEYS.recent, []);

export function addRecentSearch(q: string) {
  const t = q.trim();
  if (t.length < 2) return;
  recentStore.set((s) => [t, ...s.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8));
}

export function clearRecentSearches() {
  recentStore.set([]);
}

export function useRecentSearches() {
  return useStore(recentStore);
}
