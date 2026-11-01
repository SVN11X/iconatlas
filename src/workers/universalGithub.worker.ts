/// <reference lib="webworker" />
import { loadRemoteIndex, searchRemoteIndex } from '../utils/universalGithubIndex';

/** La descarga, validación y búsqueda del índice grande nunca bloquean el hilo de React. */
self.onmessage = async (event: MessageEvent<{ id: number; query: string }>) => {
  const { id, query } = event.data;
  try {
    const index = await loadRemoteIndex();
    if (!index) {
      self.postMessage({ id, status: 'missing', total: 0, matches: [], stats: null });
      return;
    }
    const result = searchRemoteIndex(index, query);
    self.postMessage({ id, status: 'ready', ...result, stats: index.stats });
  } catch {
    self.postMessage({ id, status: 'missing', total: 0, matches: [], stats: null });
  }
};
