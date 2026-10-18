import { useCallback } from 'react';
import type { Icon } from '../types/catalog';
import { getSvgData, isDownloadable } from '../services/catalog/catalogStore';
import { buildSvg, downloadBlob, fileBaseName, type SvgOptions } from '../services/export/svg';
import { svgToPng, type PngOptions } from '../services/export/png';
import { copyPng, copyText } from '../services/clipboard/clipboard';
import { toggleFavorite } from '../services/storage/favorites';
import { useToast } from '../components/ui/Toaster';
import { useI18n } from '../app/i18n';

export function useIconActions() {
  const { notify } = useToast();
  const { t } = useI18n();

  const ensure = useCallback((icon: Icon) => {
    if (!isDownloadable(icon)) {
      notify(t('card.restricted'), 'error');
      return false;
    }
    return true;
  }, [notify, t]);

  const getSvg = useCallback(async (icon: Icon, opts?: SvgOptions) => buildSvg(icon, await getSvgData(icon), opts), []);

  const downloadSvg = useCallback(async (icon: Icon, opts?: SvgOptions) => {
    if (!ensure(icon)) return;
    try {
      const svg = await getSvg(icon, opts);
      const f = `${fileBaseName(icon)}.svg`;
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), f);
      notify(t('toast.downloaded', { f }));
    } catch (e) {
      notify(t('toast.error', { m: (e as Error).message }), 'error');
    }
  }, [ensure, getSvg, notify, t]);

  const downloadPng = useCallback(async (icon: Icon, png: PngOptions = { size: 1024 }, opts?: SvgOptions) => {
    if (!ensure(icon)) return;
    try {
      const svg = await getSvg(icon, opts);
      const blob = await svgToPng(svg, png);
      const dim = png.width && png.height ? `${png.width}x${png.height}` : `${png.size ?? 1024}`;
      const f = `${fileBaseName(icon)}-${dim}.png`;
      downloadBlob(blob, f);
      notify(t('toast.downloaded', { f }));
    } catch (e) {
      notify(t('toast.error', { m: (e as Error).message }), 'error');
    }
  }, [ensure, getSvg, notify, t]);

  const copySvg = useCallback(async (icon: Icon, opts?: SvgOptions) => {
    if (!ensure(icon)) return;
    try {
      const svg = await getSvg(icon, opts);
      const r = await copyText(svg);
      notify(r.ok ? t('toast.svgCopied') : `${t('toast.copyFailed')} (${r.message})`, r.ok ? 'success' : 'error');
    } catch (e) {
      notify(t('toast.error', { m: (e as Error).message }), 'error');
    }
  }, [ensure, getSvg, notify, t]);

  const copyImage = useCallback(async (icon: Icon, png: PngOptions = { size: 512 }, opts?: SvgOptions) => {
    if (!ensure(icon)) return;
    // La promesa del PNG se entrega a ClipboardItem sin esperar (activación de usuario en Safari).
    const blob = getSvg(icon, opts).then((svg) => svgToPng(svg, png));
    const r = await copyPng(blob);
    if (r.ok) notify(t('toast.imageCopied'));
    else notify(`${t('toast.copyFailed')} (${r.message})`, 'error', { label: t('toast.download'), onClick: () => void downloadPng(icon, png, opts) });
  }, [ensure, getSvg, notify, t, downloadPng]);

  const copyName = useCallback(async (icon: Icon) => {
    const r = await copyText(icon.title);
    notify(r.ok ? t('toast.nameCopied') : t('toast.copyFailed'), r.ok ? 'success' : 'error');
  }, [notify, t]);

  const favorite = useCallback((icon: Icon) => {
    const added = toggleFavorite(icon.id);
    notify(added ? t('toast.favAdded') : t('toast.favRemoved'), 'info');
  }, [notify, t]);

  return { downloadSvg, downloadPng, copySvg, copyImage, copyName, favorite, getSvg };
}
