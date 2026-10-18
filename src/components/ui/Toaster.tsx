import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type Kind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: Kind; message: string; action?: { label: string; onClick: () => void } }
interface ToastCtx { notify: (message: string, kind?: Kind, action?: Toast['action']) => void }

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback<ToastCtx['notify']>((message, kind = 'success', action) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, kind, message, action }]);
    setTimeout(() => dismiss(id), kind === 'error' ? 6500 : 3200);
  }, [dismiss]);
  const value = useMemo(() => ({ notify }), [notify]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex max-w-sm animate-slide-up items-center gap-2 rounded-lg border border-border bg-elevated px-3 py-2 text-sm shadow-pop">
            {t.kind === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden /> : t.kind === 'error' ? <AlertTriangle className="h-4 w-4 shrink-0 text-danger" aria-hidden /> : <Info className="h-4 w-4 shrink-0 text-accent" aria-hidden />}
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.action && (
              <button className="btn-ghost h-7 px-2 text-xs font-medium text-accent" onClick={() => { t.action!.onClick(); dismiss(t.id); }}>{t.action.label}</button>
            )}
            <button className="rounded p-1 text-muted hover:text-fg focus-ring" onClick={() => dismiss(t.id)} aria-label="Cerrar notificación"><X className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast fuera de ToastProvider');
  return c;
}
