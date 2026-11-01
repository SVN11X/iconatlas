import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { I18nProvider } from './i18n';
import { CatalogProvider } from './CatalogContext';
import { ToastProvider } from '../components/ui/Toaster';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { SelectionBar } from '../components/ui/SelectionBar';
import { IconDetail } from '../components/preview/IconDetail';
import { HomePage } from '../pages/HomePage';
import { ExplorePage } from '../pages/ExplorePage';
import { CollectionsPage } from '../pages/CollectionsPage';
import { GithubSourcesPage } from '../pages/GithubSourcesPage';
import { FavoritesPage } from '../pages/FavoritesPage';
import { AboutPage } from '../pages/AboutPage';
import { useOpenIcon } from '../hooks/useOpenIcon';
import { applyTheme, useTheme } from '../services/storage/prefs';

function DetailHost() {
  const loc = useLocation();
  const { open, close } = useOpenIcon();
  const id = new URLSearchParams(loc.search).get('icon');
  if (!id) return null;
  return <IconDetail id={id} onClose={close} onOpen={open} />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function Shell() {
  const theme = useTheme();
  useEffect(() => { applyTheme(theme); }, [theme]);
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Header />
      <main id="main" className="flex-1" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/sources" element={<GithubSourcesPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
      <SelectionBar />
      <DetailHost />
    </div>
  );
}

/**
 * HashRouter: compatible con GitHub Pages (subruta /iconatlas/) sin servidor
 * ni redirecciones 404 — los enlaces compartidos (#/explore?q=...) siempre funcionan.
 */
export function App() {
  return (
    <HashRouter>
      <I18nProvider>
        <ToastProvider>
          <CatalogProvider>
            <Shell />
          </CatalogProvider>
        </ToastProvider>
      </I18nProvider>
    </HashRouter>
  );
}
