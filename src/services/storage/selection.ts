import { useSyncExternalStore } from 'react';

// Selección múltiple en memoria (no se persiste entre sesiones).
let selected = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const selectionStore = {
  get: () => selected,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    selected = next;
    emit();
  },
  addMany(ids: string[]) {
    selected = new Set([...selected, ...ids]);
    emit();
  },
  clear() {
    selected = new Set();
    emit();
  },
};

export function useSelection(): Set<string> {
  return useSyncExternalStore(selectionStore.subscribe, selectionStore.get, selectionStore.get);
}
