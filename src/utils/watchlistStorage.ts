import { MinerviniTradeSetup } from '../types';
import { MOCK_STOCKS } from '../data/mockStocks';

export interface CustomWatchlist {
  id: string;
  name: string;
  description: string;
  tickers: string[];
  isDefault?: boolean;
  createdAt: string;
}

const STORAGE_KEY_WATCHLISTS = 'minervini_sepa_watchlists_v2';
const STORAGE_KEY_FAVORITES = 'minervini_sepa_favorites_v2';

export const INITIAL_WATCHLISTS: CustomWatchlist[] = [
  {
    id: 'wl-stage2-leaders',
    name: 'SEPA Stage 2 Leaders',
    description: 'High momentum growth stocks passing 7+ Trend Template rules',
    tickers: ['HAL', 'TRENT', 'POLYCAB', 'DIXON', 'KAYNES'],
    isDefault: true,
    createdAt: new Date().toLocaleDateString()
  },
  {
    id: 'wl-vcp-squeezes',
    name: 'VCP Tight Coils',
    description: 'Extreme volume dry-up (< -40%) coiling at breakout pivots',
    tickers: ['POLYCAB', 'DIXON', 'TATAELXSI', 'HAL'],
    isDefault: true,
    createdAt: new Date().toLocaleDateString()
  },
  {
    id: 'wl-high-rs',
    name: 'High RS Stars (RS > 90)',
    description: 'Top market outperformers leading sector rotations',
    tickers: ['TRENT', 'KAYNES', 'POLYCAB', 'BEL'],
    isDefault: true,
    createdAt: new Date().toLocaleDateString()
  }
];

export function getStoredWatchlists(): CustomWatchlist[] {
  if (typeof window === 'undefined') return INITIAL_WATCHLISTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WATCHLISTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_WATCHLISTS, JSON.stringify(INITIAL_WATCHLISTS));
      return INITIAL_WATCHLISTS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load watchlists from storage', e);
    return INITIAL_WATCHLISTS;
  }
}

export function saveStoredWatchlists(watchlists: CustomWatchlist[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_WATCHLISTS, JSON.stringify(watchlists));
    window.dispatchEvent(new CustomEvent('minervini_watchlists_updated'));
  } catch (e) {
    console.error('Failed to save watchlists', e);
  }
}

export function getFavoriteTickers(): string[] {
  if (typeof window === 'undefined') return ['HAL', 'TRENT'];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FAVORITES);
    return raw ? JSON.parse(raw) : ['HAL', 'TRENT'];
  } catch (e) {
    return ['HAL', 'TRENT'];
  }
}

export function saveFavoriteTickers(favorites: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favorites));
    window.dispatchEvent(new CustomEvent('minervini_favorites_updated'));
  } catch (e) {
    console.error('Failed to save favorites', e);
  }
}
