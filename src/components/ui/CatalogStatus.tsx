import { AlertTriangle, Loader2 } from 'lucide-react';
import { useCatalog } from '../../app/CatalogContext';
import { useI18n } from '../../app/i18n';

export function CatalogStatus() {
  const { error, retry } = useCatalog();
  const { t } = useI18n();
  if (error) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 py-24 text-center" role="alert">
        <AlertTriangle className="h-8 w-8 text-danger" aria-hidden />
        <p className="font-medium">{t('explore.error')}</p>
        <p className="text-sm text-muted">{error.message}</p>
        <button className="btn-primary" onClick={retry}>{t('explore.retry')}</button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />{t('explore.loading')}
    </div>
  );
}
