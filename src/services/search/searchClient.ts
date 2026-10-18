import type { Catalog } from '../../types/catalog';
import { createEngine, type Engine, type SearchDoc } from './engine';

type Pending = { resolve: (v: never) => void; reject: (e: Error) => void };

export function buildDocs(catalog: Catalog): SearchDoc[] {
  return catalog.icons.map((i) => {
    const prov = catalog.providers.get(i.provider);
    const cat = catalog.categories.get(i.category);
    return {
      id: i.idx,
      title: i.title,
      name: i.name.replace(/-/g, ' '),
      tags: i.tags.join(' '),
      coll: i.collection.name,
      prov: prov && i.provider !== 'community' ? `${prov.name} ${prov.shortName ?? ''}` : '',
      cat: cat ? `${cat.labels.es} ${cat.labels.en}` : '',
      priority: i.priority,
    };
  });
}

/** Cliente de búsqueda: ejecuta el índice en un Web Worker para no bloquear la interfaz. */
export class SearchClient {
  private worker: Worker | null = null;
  private engine: Engine | null = null;
  private seq = 0;
  private pending = new Map<number, Pending>();
  readonly ready: Promise<void>;

  constructor(catalog: Catalog) {
    const docs = buildDocs(catalog);
    const synonyms = catalog.index.synonyms;
    this.ready = new Promise<void>((resolve, reject) => {
      try {
        if (typeof Worker === 'undefined') throw new Error('no worker');
        this.worker = new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e) => {
          const m = e.data;
          if (m.type === 'ready') resolve();
          else if (m.type === 'result') this.settle(m.reqId, Array.from(m.ids as Int32Array));
          else if (m.type === 'suggest') this.settle(m.reqId, m.suggestions);
          else if (m.type === 'error') {
            const p = this.pending.get(m.reqId);
            if (p) { this.pending.delete(m.reqId); p.reject(new Error(m.message)); } else reject(new Error(m.message));
          }
        };
        this.worker.onerror = () => {
          // Si el worker falla (CSP, navegador antiguo), se usa el motor en el hilo principal.
          this.worker?.terminate();
          this.worker = null;
          this.engine = createEngine(docs, synonyms);
          resolve();
        };
        this.worker.postMessage({ type: 'init', docs, synonyms });
      } catch {
        this.engine = createEngine(docs, synonyms);
        resolve();
      }
    });
  }

  private settle(reqId: number, value: unknown) {
    const p = this.pending.get(reqId);
    if (p) {
      this.pending.delete(reqId);
      (p.resolve as (v: unknown) => void)(value);
    }
  }

  private call<T>(type: 'search' | 'suggest', q: string, limit?: number): Promise<T> {
    if (this.engine) return Promise.resolve((type === 'search' ? this.engine.search(q, limit) : this.engine.suggest(q)) as T);
    const reqId = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(reqId, { resolve: resolve as (v: never) => void, reject });
      this.worker!.postMessage({ type, reqId, q, limit });
    });
  }

  async search(q: string, limit?: number): Promise<number[]> {
    await this.ready;
    return this.call<number[]>('search', q, limit);
  }

  async suggest(q: string): Promise<string[]> {
    await this.ready;
    return this.call<string[]>('suggest', q);
  }
}
