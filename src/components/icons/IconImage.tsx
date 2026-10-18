import { ExternalLink, ImageOff } from 'lucide-react';
import type { Icon } from '../../types/catalog';
import { useIconPreview } from '../../hooks/useIconPreview';
import { useCatalog } from '../../app/CatalogContext';

interface Props {
  icon: Icon;
  className?: string;
  color?: string | null;
  alt?: string;
  style?: React.CSSProperties;
}

/**
 * Muestra un icono como <img src="data:image/svg+xml,..."> — el SVG nunca se
 * inserta en el DOM, por lo que no puede ejecutar scripts (defensa XSS) y los
 * IDs internos (gradientes) no colisionan entre iconos.
 */
export function IconImage({ icon, className = 'h-8 w-8', color, alt = '', style }: Props) {
  const { uri, error } = useIconPreview(icon, color !== undefined ? { color } : undefined);
  if (icon.shard < 0) return <ExternalPlaceholder icon={icon} className={className} alt={alt} style={style} />;
  if (error) return <ImageOff className={`${className} text-danger/70`} aria-label={alt || 'Error al cargar el icono'} />;
  if (!uri) return <span className={`${className} animate-pulse rounded-md bg-fg/5`} aria-hidden style={style} />;
  return <img src={uri} alt={alt} className={`${className} object-contain`} draggable={false} decoding="async" style={style} />;
}

/** Marcador para fichas oficiales solo-enlace: iniciales + logotipo del proveedor (de una colección abierta). */
function ExternalPlaceholder({ icon, className, alt, style }: Props) {
  const { catalog } = useCatalog();
  const logoId = catalog?.providers.get(icon.provider)?.logoIcon;
  const logo = logoId ? catalog?.byId.get(logoId) : null;
  const initials = icon.title.replace(/^(Microsoft|Azure|Amazon|AWS|Google Cloud|Google|SAP|OCI|Oracle|Databricks)\s+/i, '').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    return (
      <span className={`${className} relative flex items-center justify-center rounded-md border border-dashed border-muted/50 text-[0.6em] font-semibold text-muted`} role={alt ? 'img' : undefined} aria-label={alt || undefined} style={style}>
        <span aria-hidden className="leading-none">{initials || '?'}</span>
        {logo && logo.shard >= 0 ? (
          <span className="absolute -bottom-1.5 -left-1.5 flex h-[45%] w-[45%] items-center justify-center rounded bg-surface p-px"><IconImage icon={logo} className="h-full w-full" /></span>
        ) : null}
        <ExternalLink className="absolute -bottom-1 -right-1 h-3 w-3 rounded-sm bg-surface text-muted" aria-hidden />
      </span>
    );
}
