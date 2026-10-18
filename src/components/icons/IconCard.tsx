import { memo } from 'react';
import { BadgeCheck, Check, Clipboard, Code2, Download, ExternalLink, FileImage, Star } from 'lucide-react';
import type { Icon } from '../../types/catalog';
import { FLAG_OFFICIAL } from '../../types/catalog';
import { IconImage } from './IconImage';
import { useI18n } from '../../app/i18n';
import { isDownloadable, isMono } from '../../services/catalog/catalogStore';

export interface CardHandlers {
  onOpen: (icon: Icon) => void;
  onToggleSelect: (icon: Icon) => void;
  onCopySvg: (icon: Icon) => void;
  onCopyImage: (icon: Icon) => void;
  onDownloadPng: (icon: Icon) => void;
  onDownloadSvg: (icon: Icon) => void;
  onFavorite: (icon: Icon) => void;
}

interface Props extends CardHandlers {
  icon: Icon;
  idx: number;
  selected: boolean;
  favorite: boolean;
  selectionMode: boolean;
  providerName?: string;
}

function ActionBtn({ label, onClick, children, testId }: { label: string; onClick: () => void; children: React.ReactNode; testId?: string }) {
  return (
    <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-fg/10 hover:text-fg focus-ring" onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={label} title={label} data-testid={testId}>
      {children}
    </button>
  );
}

export const IconCard = memo(function IconCard({ icon, idx, selected, favorite, selectionMode, providerName, ...h }: Props) {
  const { t } = useI18n();
  const downloadable = isDownloadable(icon);
  const official = (icon.flags & FLAG_OFFICIAL) === FLAG_OFFICIAL;
  return (
    <div
      className={`group relative flex h-full flex-col overflow-hidden rounded-xl border bg-surface transition-[border-color,box-shadow] hover:shadow-card ${selected ? 'border-accent ring-1 ring-accent' : 'border-border hover:border-muted/40'}`}
      data-testid="icon-card"
      data-icon-id={icon.id}
    >
      <button
        type="button"
        data-idx={idx}
        className="flex flex-1 flex-col items-center gap-2 rounded-xl px-2 pb-2 pt-5 text-center focus-ring"
        onClick={(e) => (selectionMode || e.shiftKey ? h.onToggleSelect(icon) : h.onOpen(icon))}
        aria-pressed={selectionMode ? selected : undefined}
      >
        {official && <span className="sr-only">{t('card.official')}: </span>}
        <span className="flex h-12 w-full items-center justify-center">
          {/* En tema oscuro, los logotipos multicolor se muestran sobre una placa clara para mantener su legibilidad */}
          <span className={`flex items-center justify-center transition-transform duration-150 group-hover:scale-110 motion-reduce:transform-none ${!isMono(icon) && icon.shard >= 0 ? 'dark:rounded-lg dark:bg-white dark:p-1' : ''}`}>
            <IconImage icon={icon} className={!isMono(icon) && icon.shard >= 0 ? 'h-10 w-10 dark:h-9 dark:w-9' : 'h-10 w-10'} />
          </span>
        </span>
        <span className="w-full truncate text-[13px] font-medium leading-tight" title={icon.title}>{icon.title}</span>
        <span className="w-full truncate text-[11px] leading-tight text-muted" title={`${icon.collection.name}${providerName ? ` · ${providerName}` : ''}`}>
          {providerName && providerName !== icon.collection.name ? `${providerName} · ` : ''}{icon.collection.name}
        </span>
      </button>

      {/* Indicadores */}
      <div className="pointer-events-none absolute right-1.5 top-1.5 flex gap-1">
        {official && <span className="flex items-center gap-0.5 rounded bg-accent/10 px-1 py-px text-[10px] font-medium text-accent" title={t('card.official')}><BadgeCheck className="h-3 w-3" aria-hidden /></span>}
        {!downloadable && <span className="flex items-center rounded bg-warn/10 px-1 py-px text-[10px] font-medium text-warn" title={t('card.restricted')}><ExternalLink className="h-3 w-3" aria-hidden /></span>}
        {favorite && <Star className="h-3.5 w-3.5 fill-warn text-warn" aria-label={t('nav.favorites')} />}
      </div>

      {/* Selección */}
      <button
        type="button"
        className={`absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded border transition-opacity focus-ring ${selected ? 'border-accent bg-accent text-accent-fg opacity-100' : 'border-border bg-surface text-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'} ${selectionMode ? 'opacity-100' : ''} card-actions`}
        onClick={() => h.onToggleSelect(icon)}
        aria-label={`${t('card.select')}: ${icon.title}`}
        aria-pressed={selected}
        data-testid="select-toggle"
      >
        <Check className="h-3.5 w-3.5" aria-hidden />
      </button>

      {/* Acciones rápidas */}
      <div className="card-actions flex items-center justify-center gap-0.5 border-t border-border bg-surface px-1 py-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" role="toolbar" aria-label={`${t('card.actions')}: ${icon.title}`}>
        {downloadable ? (
          <>
            <ActionBtn label={t('card.copySvg')} onClick={() => h.onCopySvg(icon)} testId="action-copy-svg"><Code2 className="h-3.5 w-3.5" /></ActionBtn>
            <ActionBtn label={t('card.copyImage')} onClick={() => h.onCopyImage(icon)} testId="action-copy-image"><Clipboard className="h-3.5 w-3.5" /></ActionBtn>
            <ActionBtn label={t('card.downloadPng')} onClick={() => h.onDownloadPng(icon)} testId="action-download-png"><FileImage className="h-3.5 w-3.5" /></ActionBtn>
            <ActionBtn label={t('card.downloadSvg')} onClick={() => h.onDownloadSvg(icon)} testId="action-download-svg"><Download className="h-3.5 w-3.5" /></ActionBtn>
          </>
        ) : (
          <button type="button" className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-warn hover:bg-warn/10 focus-ring" onClick={() => h.onOpen(icon)} title={t('card.restricted')}>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />{t('card.external')}
          </button>
        )}
        <ActionBtn label={favorite ? t('card.unfavorite') : t('card.favorite')} onClick={() => h.onFavorite(icon)} testId="action-favorite">
          <Star className={`h-3.5 w-3.5 ${favorite ? 'fill-warn text-warn' : ''}`} />
        </ActionBtn>
      </div>
    </div>
  );
});
