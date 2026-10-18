import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Catalog } from '../types/catalog';
import { loadCatalog } from '../services/catalog/catalogStore';
import { SearchClient } from '../services/search/searchClient';

interface CatalogCtx {
  catalog: Catalog | null;
  error: Error | null;
  retry: () => void;
  search: SearchClient | null;
  searchReady: boolean;
}

const Ctx = createContext<CatalogCtx | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState<SearchClient | null>(null);
  const [searchReady, setSearchReady] = useState(false);

  useEffect(() => {
    let alive = true;
    setError(null);
    loadCatalog()
      .then((c) => {
        if (!alive) return;
        setCatalog(c);
        // El índice de búsqueda se construye en segundo plano tras la primera pintura.
        const start = () => {
          const client = new SearchClient(c);
          setSearch(client);
          client.ready.then(() => alive && setSearchReady(true)).catch(() => undefined);
        };
        const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
        if (ric) ric(start, { timeout: 800 });
        else setTimeout(start, 50);
      })
      .catch((e) => alive && setError(e instanceof Error ? e : new Error(String(e))));
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  const value = useMemo(() => ({ catalog, error, retry, search, searchReady }), [catalog, error, retry, search, searchReady]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCatalog(): CatalogCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCatalog fuera de CatalogProvider');
  return c;
}
