import MiniSearch from 'minisearch';

export interface SearchDoc {
  id: number;
  title: string;
  name: string;
  tags: string;
  coll: string;
  prov: string;
  cat: string;
  /** 0 = máxima prioridad (fichas oficiales), 3 = iconos de interfaz */
  priority: number;
}

const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'e', 'o', 'para', 'con', 'en', 'un', 'una', 'the', 'of', 'for', 'and', 'with', 'a', 'an', 'to', 'on', 'in']);

export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function tokenize(s: string): string[] {
  return normalizeText(s).split(/[\s\-_/.,:;()[\]{}&+|"'!?]+/).filter(Boolean);
}

function processTerm(term: string): string | null {
  const t = normalizeText(term);
  if (!t || STOP.has(t)) return null;
  return t;
}

export interface Engine {
  search(q: string, limit?: number): number[];
  suggest(q: string, limit?: number): string[];
  size: number;
}

/** Calcula las consultas alternativas a partir del diccionario de sinónimos. */
export function expandQuery(q: string, groups: string[][]): string[] {
  const nq = ` ${tokenize(q).join(' ')} `;
  const out = new Set<string>();
  for (const group of groups) {
    const terms = group.map((t) => tokenize(t).join(' ')).filter(Boolean);
    const sorted = [...terms].sort((a, b) => b.length - a.length);
    for (const t of sorted) {
      if (nq.includes(` ${t} `)) {
        for (const alt of terms) if (alt !== t) out.add(nq.replace(` ${t} `, ` ${alt} `).trim());
        break;
      }
    }
  }
  out.delete(nq.trim());
  return [...out].slice(0, 12);
}

export function createEngine(docs: SearchDoc[], synonyms: string[][]): Engine {
  const prio = new Float32Array(docs.length ? Math.max(...docs.map((d) => d.id)) + 1 : 0);
  const titles: string[] = [];
  for (const d of docs) {
    prio[d.id] = 1 + (3 - Math.min(3, d.priority)) * 0.12;
    titles[d.id] = ` ${tokenize(d.title).join(' ')} `;
  }
  const ms = new MiniSearch<SearchDoc>({
    idField: 'id',
    fields: ['title', 'name', 'tags', 'coll', 'prov', 'cat'],
    storeFields: [],
    tokenize,
    processTerm,
    searchOptions: {
      boost: { title: 4, name: 2, tags: 2, prov: 1.5, coll: 1, cat: 0.6 },
      prefix: (term) => term.length >= 2,
      fuzzy: (term) => (term.length >= 6 ? 0.2 : term.length >= 4 ? 0.12 : false),
      combineWith: 'AND',
      boostDocument: (id) => prio[id as number] || 1,
    },
  });
  ms.addAll(docs);

  function run(q: string, weight: number, scores: Map<number, number>, combineWith: 'AND' | 'OR' = 'AND') {
    const results = ms.search(q, { combineWith });
    const max = results.length ? results[0].score : 1;
    for (const r of results) {
      // puntuaciones normalizadas por consulta para que los sinónimos no superen a la consulta original
      const s = (r.score / max) * weight;
      const prev = scores.get(r.id as number);
      if (prev === undefined || s > prev) scores.set(r.id as number, s);
    }
  }

  return {
    size: docs.length,
    search(q: string, limit = 5000) {
      const query = q.trim();
      if (!query) return [];
      const scores = new Map<number, number>();
      run(query, 1, scores);
      for (const alt of expandQuery(query, synonyms)) run(alt, 0.7, scores);
      if (scores.size < 10 && tokenize(query).length > 1) run(query, 0.4, scores, 'OR');
      // Bonificación: el título contiene todos los términos buscados (o coincide exactamente).
      const qt = tokenize(query).filter((t) => !STOP.has(t));
      const exact = ` ${qt.join(' ')} `;
      for (const [id, sc] of scores) {
        const title = titles[id];
        if (!title) continue;
        if (title === exact) scores.set(id, sc * 3);
        else if (qt.length && qt.every((t) => title.includes(` ${t}`))) scores.set(id, sc * 2);
      }
      return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
    },
    suggest(q: string, limit = 6) {
      if (!q.trim()) return [];
      return ms
        .autoSuggest(q, { fuzzy: 0.15, prefix: true, boost: { title: 4 }, combineWith: 'AND' })
        .slice(0, limit)
        .map((s) => s.suggestion);
    },
  };
}
