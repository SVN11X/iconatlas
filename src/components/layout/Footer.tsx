import { Link } from 'react-router-dom';
import { useCatalog } from '../../app/CatalogContext';
import { useI18n } from '../../app/i18n';

export function Footer() {
  const { catalog } = useCatalog();
  const { lang, fmt } = useI18n();
  const d = catalog ? new Date(catalog.index.generatedAt) : null;
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          IconAtlas · {lang === 'es' ? 'Proyecto de código abierto (MIT). Cada colección conserva su propia licencia.' : 'Open-source project (MIT). Each collection keeps its own license.'}{' '}
          <Link to="/about" className="underline underline-offset-2 hover:text-fg">{lang === 'es' ? 'Licencias y marcas' : 'Licenses & trademarks'}</Link>
        </p>
        {catalog && d && (
          <p>
            {lang === 'es' ? 'Catálogo' : 'Catalog'}: {fmt(catalog.index.stats.icons)} · {lang === 'es' ? 'generado' : 'built'} {d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US')}
          </p>
        )}
      </div>
    </footer>
  );
}
