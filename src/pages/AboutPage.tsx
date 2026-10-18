import { useEffect } from 'react';
import { useCatalog } from '../app/CatalogContext';
import { useI18n } from '../app/i18n';
import { CatalogStatus } from '../components/ui/CatalogStatus';

export function AboutPage() {
  const { catalog } = useCatalog();
  const { t, lang, fmt } = useI18n();
  useEffect(() => { document.title = `${t('about.title')} · IconAtlas`; }, [t]);
  if (!catalog) return <CatalogStatus />;
  const es = lang === 'es';
  const libs = catalog.index.collections.filter((c) => c.kind !== 'reference');
  const refs = catalog.index.collections.filter((c) => c.kind === 'reference');

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('about.title')}</h1>

      <section className="prose-sm mt-6 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">{es ? 'Cómo usar IconAtlas' : 'How to use IconAtlas'}</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>{es ? 'Busca con la barra superior (atajo Ctrl+K / ⌘K o «/»). Admite sinónimos en español e inglés y tolera errores tipográficos.' : 'Search with the top bar (Ctrl+K / ⌘K or “/”). Spanish/English synonyms and typos are supported.'}</li>
          <li>{es ? 'Filtra por proveedor, categoría, estilo, colección y características. La URL guarda los filtros para compartir la búsqueda.' : 'Filter by provider, category, style, collection and features. The URL keeps the filters so searches can be shared.'}</li>
          <li>{es ? 'Abre un icono para ver su licencia, variantes, vista previa con distintos fondos y opciones de exportación.' : 'Open an icon to see its license, variants, preview over different backgrounds and export options.'}</li>
          <li>{es ? 'Descarga SVG original, PNG de 64 a 4096 px (o tamaño personalizado), copia la imagen o el código SVG.' : 'Download the original SVG, PNG from 64 to 4096 px (or custom), copy the image or the SVG code.'}</li>
          <li>{es ? 'Marca favoritos (se guardan en este navegador) y usa la selección múltiple para descargar un ZIP.' : 'Mark favorites (stored in this browser) and use multi-select to download a ZIP.'}</li>
        </ol>
        <p className="text-muted">{es ? 'Atajos: Ctrl/⌘+K buscar · flechas para moverse entre iconos · Mayús+clic seleccionar · Esc cerrar la ficha.' : 'Shortcuts: Ctrl/⌘+K search · arrow keys move between icons · Shift+click select · Esc closes the detail view.'}</p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">{es ? 'Marcas comerciales' : 'Trademarks'}</h2>
        <p>{es
          ? 'Todos los nombres de productos, logotipos y marcas pertenecen a sus respectivos propietarios. La licencia de una biblioteca (por ejemplo, CC0 o MIT) cubre el archivo y el trabajo de sus autores, pero no concede derechos sobre las marcas representadas. El uso de un logotipo no implica patrocinio ni afiliación. Consulta las directrices de marca de cada propietario antes de usarlos en materiales comerciales.'
          : 'All product names, logos and brands are property of their respective owners. A library license (e.g. CC0 or MIT) covers the files and the authors’ work, but grants no trademark rights. Use of a logo does not imply endorsement or affiliation. Check each owner’s brand guidelines before commercial use.'}</p>
        <p>{es
          ? 'Los iconos oficiales de arquitectura de Azure, AWS, Google Cloud, Oracle y la marca Databricks no se redistribuyen desde IconAtlas porque sus términos solo permiten el uso en diagramas y documentación. Se muestran como fichas con enlace a la descarga oficial y, cuando existen, alternativas descargables verificadas.'
          : 'Official Azure, AWS, Google Cloud and Oracle architecture icons and Databricks brand assets are not redistributed from IconAtlas because their terms only permit use in diagrams and documentation. They are shown as entries linking to the official download and, when available, verified downloadable alternatives.'}</p>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">{es ? 'Bibliotecas integradas y licencias' : 'Integrated libraries & licenses'}</h2>
        <ul className="space-y-3">
          {libs.map((c) => (
            <li key={c.id} className="card p-4 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <a className="font-medium hover:underline" href={c.homepage} target="_blank" rel="noopener noreferrer">{c.name}</a>
                <span className="text-xs text-muted">{c.owner} · {fmt(c.count)} {t('collections.icons')} · v{c.version}</span>
              </div>
              <p className="mt-1 text-xs">{t('detail.license')}: <a className="text-accent hover:underline" href={c.license.url} target="_blank" rel="noopener noreferrer">{c.license.title} ({c.license.spdx})</a>{c.attribution ? <> · {t('detail.attribution')}: {c.attribution}</> : null}</p>
              {c.notes && <p className="mt-1 text-xs text-muted">{c.notes}</p>}
              {c.restrictions.length > 0 && <ul className="mt-1 list-disc pl-4 text-xs text-muted">{c.restrictions.map((r) => <li key={r}>{r}</li>)}</ul>}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">{es ? 'Fuentes oficiales enlazadas (no redistribuidas)' : 'Linked official sources (not redistributed)'}</h2>
        <ul className="space-y-2 text-sm">
          {refs.map((c) => (
            <li key={c.id} className="card p-3">
              <a className="font-medium hover:underline" href={c.sourceUrl} target="_blank" rel="noopener noreferrer">{c.name}</a>
              <span className="text-xs text-muted"> · {fmt(c.count)} {es ? 'fichas' : 'entries'} · {es ? 'revisado' : 'reviewed'} {c.reviewed}</span>
              <p className="mt-1 text-xs text-muted">{c.terms}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 space-y-2 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">{es ? 'Limitaciones conocidas' : 'Known limitations'}</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>{es ? 'Copiar imágenes requiere HTTPS y un navegador con soporte de ClipboardItem para PNG (Chrome, Edge, Safari y Firefox recientes). Si no está disponible, se ofrece la descarga del PNG.' : 'Copying images requires HTTPS and ClipboardItem PNG support (recent Chrome, Edge, Safari, Firefox). Otherwise the PNG download is offered.'}</li>
          <li>{es ? 'Los PNG muy grandes (4096 px o más) pueden fallar en dispositivos con poca memoria; el límite es 8192 px por lado.' : 'Very large PNGs (4096 px+) may fail on low-memory devices; the limit is 8192 px per side.'}</li>
          <li>{es ? 'La clasificación por categorías de bibliotecas genéricas es automática (palabras clave) y puede contener imprecisiones.' : 'Category classification for generic libraries is automatic (keywords) and may be imprecise.'}</li>
          <li>{es ? 'Los favoritos se guardan en el almacenamiento local de este navegador: no se sincronizan entre dispositivos.' : 'Favorites live in this browser’s local storage and do not sync across devices.'}</li>
        </ul>
        <p className="text-xs text-muted">{es ? 'Catálogo generado' : 'Catalog built'}: {new Date(catalog.index.generatedAt).toLocaleString(es ? 'es-ES' : 'en-US')}</p>
      </section>
    </div>
  );
}
