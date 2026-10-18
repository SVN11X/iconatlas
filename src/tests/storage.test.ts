import { favoritesStore, toggleFavorite, removeFavorites } from '../services/storage/favorites';
import { addRecentSearch, recentStore } from '../services/storage/recent';
import { KEYS } from '../services/storage/local';

describe('almacenamiento local', () => {
  beforeEach(() => { localStorage.clear(); favoritesStore.reload(); recentStore.reload(); });

  it('añade y elimina favoritos y los persiste con formato versionado', () => {
    expect(toggleFavorite('lucide:home')).toBe(true);
    toggleFavorite('devicon:python');
    const raw = JSON.parse(localStorage.getItem(KEYS.favorites)!);
    expect(raw.v).toBe(1);
    expect(raw.ids).toEqual(['devicon:python', 'lucide:home']);
    expect(toggleFavorite('lucide:home')).toBe(false);
    removeFavorites(['devicon:python']);
    expect(favoritesStore.get().ids).toEqual([]);
  });

  it('migra el formato antiguo (array)', () => {
    localStorage.setItem(KEYS.favorites, JSON.stringify(['a:b']));
    favoritesStore.reload();
    expect(favoritesStore.get().ids).toEqual(['a:b']);
  });

  it('búsquedas recientes sin duplicados y limitadas', () => {
    for (let i = 0; i < 12; i++) addRecentSearch(`q${i}`);
    addRecentSearch('Q11');
    expect(recentStore.get()).toHaveLength(8);
    expect(recentStore.get()[0]).toBe('Q11');
  });
});
