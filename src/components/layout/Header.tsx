import { Link, NavLink } from 'react-router-dom';
import { Moon, Star, Sun, Languages } from 'lucide-react';
import { Logo } from './Logo';
import { SearchBox } from '../search/SearchBox';
import { useI18n } from '../../app/i18n';
import { themeStore, useTheme } from '../../services/storage/prefs';
import { useFavorites } from '../../services/storage/favorites';

export function Header() {
  const { t, lang, setLang } = useI18n();
  const theme = useTheme();
  const favs = useFavorites();
  const navCls = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-2.5 py-1.5 text-sm transition-colors focus-ring ${isActive ? 'bg-fg/5 text-fg' : 'text-muted hover:text-fg'}`;
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-1 focus:text-accent-fg">{t('nav.skip')}</a>
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2 rounded-md font-semibold tracking-tight focus-ring" aria-label="IconAtlas — inicio">
          <Logo />
          <span className="hidden sm:inline">IconAtlas</span>
        </Link>
        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Principal">
          <NavLink to="/explore" className={navCls}>{t('nav.explore')}</NavLink>
          <NavLink to="/collections" className={navCls}>{t('nav.collections')}</NavLink>
          <NavLink to="/sources" className={navCls}>GitHub</NavLink>
          <NavLink to="/about" className={navCls}>{t('nav.about')}</NavLink>
        </nav>
        <div className="min-w-0 flex-1">
          <SearchBox />
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <NavLink to="/favorites" className={({ isActive }) => `icon-btn relative ${isActive ? 'text-fg' : ''}`} aria-label={`${t('nav.favorites')} (${favs.length})`} title={t('nav.favorites')}>
            <Star className="h-[18px] w-[18px]" />
            {favs.length > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[16px] rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-4 text-accent-fg">{favs.length > 99 ? '99+' : favs.length}</span>}
          </NavLink>
          <button className="icon-btn w-auto px-2" onClick={() => setLang(lang === 'es' ? 'en' : 'es')} title={`${t('lang.label')}: ${lang === 'es' ? 'Español' : 'English'}`}>
            <Languages className="h-[18px] w-[18px]" aria-hidden />
            <span className="sr-only">{t('lang.label')}:</span>
            <span className="ml-0.5 text-[10px] font-semibold uppercase">{lang}</span>
          </button>
          <button className="icon-btn" onClick={() => themeStore.set(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? t('theme.light') : t('theme.dark')} title={t('theme.toggle')}>
            {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-1.5 md:hidden" aria-label="Principal móvil">
        <NavLink to="/explore" className={navCls}>{t('nav.explore')}</NavLink>
        <NavLink to="/collections" className={navCls}>{t('nav.collections')}</NavLink>
          <NavLink to="/sources" className={navCls}>GitHub</NavLink>
        <NavLink to="/favorites" className={navCls}>{t('nav.favorites')}</NavLink>
        <NavLink to="/about" className={navCls}>{t('nav.about')}</NavLink>
      </nav>
    </header>
  );
}
