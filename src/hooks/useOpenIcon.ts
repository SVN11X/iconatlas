import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** Abre/cierra la ficha de un icono mediante el parámetro ?icon= (enlazable y compartible). */
export function useOpenIcon() {
  const nav = useNavigate();
  const loc = useLocation();
  const open = useCallback((id: string) => {
    const p = new URLSearchParams(loc.search);
    p.set('icon', id);
    nav({ pathname: loc.pathname, search: `?${p.toString()}` }, { replace: false });
  }, [nav, loc.pathname, loc.search]);
  const close = useCallback(() => {
    const p = new URLSearchParams(loc.search);
    p.delete('icon');
    const s = p.toString();
    nav({ pathname: loc.pathname, search: s ? `?${s}` : '' }, { replace: false });
  }, [nav, loc.pathname, loc.search]);
  return { open, close };
}
