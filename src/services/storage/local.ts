// Almacenamiento local versionado. Formato de claves documentado en docs/ARCHITECTURE.md:
//   iconatlas:favorites:v1        → { v: 1, ids: string[], updatedAt: string }
//   iconatlas:recent-searches:v1  → string[] (máx. 8, más reciente primero)
//   iconatlas:theme:v1            → "light" | "dark"
//   iconatlas:lang:v1             → "es" | "en"
//   iconatlas:export-prefs:v1     → { pngSize: number, background: string | null, format: "svg"|"png"|"both" }
import { useSyncExternalStore } from 'react';

export const KEYS = {
  favorites: 'iconatlas:favorites:v1',
  recent: 'iconatlas:recent-searches:v1',
  theme: 'iconatlas:theme:v1',
  lang: 'iconatlas:lang:v1',
  exportPrefs: 'iconatlas:export-prefs:v1',
} as const;

export function readKey<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeKey(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* modo privado o cuota excedida: la app sigue funcionando en memoria */
  }
}

type Listener = () => void;

/** Pequeño almacén reactivo sincronizado con localStorage y entre pestañas. */
export function createStore<T>(key: string, fallback: T, migrate?: (raw: unknown) => T) {
  let value: T = migrate ? migrate(readKey<unknown>(key, fallback)) : readKey<T>(key, fallback);
  const listeners = new Set<Listener>();
  const emit = () => listeners.forEach((l) => l());
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === key) {
        value = migrate ? migrate(readKey<unknown>(key, fallback)) : readKey<T>(key, fallback);
        emit();
      }
    });
  }
  return {
    get: () => value,
    set(next: T | ((prev: T) => T)) {
      value = typeof next === 'function' ? (next as (p: T) => T)(value) : next;
      writeKey(key, value);
      emit();
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    reload() {
      value = migrate ? migrate(readKey<unknown>(key, fallback)) : readKey<T>(key, fallback);
      emit();
    },
  };
}

export function useStore<T>(store: { get: () => T; subscribe: (l: Listener) => () => void }): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
