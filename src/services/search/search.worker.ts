/// <reference lib="webworker" />
import { createEngine, type Engine, type SearchDoc } from './engine';

let engine: Engine | null = null;

type Msg =
  | { type: 'init'; docs: SearchDoc[]; synonyms: string[][] }
  | { type: 'search'; reqId: number; q: string; limit?: number }
  | { type: 'suggest'; reqId: number; q: string };

self.onmessage = (e: MessageEvent<Msg>) => {
  const m = e.data;
  try {
    if (m.type === 'init') {
      const t = performance.now();
      engine = createEngine(m.docs, m.synonyms);
      (self as unknown as Worker).postMessage({ type: 'ready', ms: Math.round(performance.now() - t), size: engine.size });
    } else if (m.type === 'search') {
      const ids = engine ? engine.search(m.q, m.limit) : [];
      const arr = Int32Array.from(ids);
      (self as unknown as Worker).postMessage({ type: 'result', reqId: m.reqId, ids: arr }, [arr.buffer]);
    } else if (m.type === 'suggest') {
      (self as unknown as Worker).postMessage({ type: 'suggest', reqId: m.reqId, suggestions: engine ? engine.suggest(m.q) : [] });
    }
  } catch (err) {
    (self as unknown as Worker).postMessage({ type: 'error', reqId: (m as { reqId?: number }).reqId, message: (err as Error).message });
  }
};
