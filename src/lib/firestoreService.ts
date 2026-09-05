import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase';
import { CustomWatchlist } from '../utils/watchlistStorage';

export type UserWatchlist = CustomWatchlist;

// ============================================================================
// 1. WATCHLISTS FIRESTORE SYNC
// ============================================================================

export function subscribeToUserWatchlists(
  userId: string,
  onUpdate: (watchlists: UserWatchlist[]) => void,
  onError?: (err: Error) => void
): () => void {
  const watchlistsRef = collection(db, 'users', userId, 'watchlists');
  const q = query(watchlistsRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: UserWatchlist[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          name: data.name || 'Untitled List',
          description: data.description || '',
          tickers: Array.isArray(data.tickers) ? data.tickers : [],
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || Date.now()),
          updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : (data.updatedAt || Date.now()),
          isCustom: data.isCustom !== false,
          colorTag: data.colorTag || '#f59e0b',
        });
      });
      onUpdate(items);
    },
    (err) => {
      console.error('Error listening to user watchlists:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveUserWatchlistToCloud(
  userId: string,
  watchlist: UserWatchlist
): Promise<void> {
  const ref = doc(db, 'users', userId, 'watchlists', watchlist.id);
  await setDoc(
    ref,
    {
      ...watchlist,
      updatedAt: serverTimestamp(),
      createdAt: watchlist.createdAt || serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteUserWatchlistFromCloud(
  userId: string,
  watchlistId: string
): Promise<void> {
  const ref = doc(db, 'users', userId, 'watchlists', watchlistId);
  await deleteDoc(ref);
}

export async function syncLocalWatchlistsToCloud(
  userId: string,
  localWatchlists: UserWatchlist[]
): Promise<void> {
  try {
    const watchlistsRef = collection(db, 'users', userId, 'watchlists');
    const existingSnap = await getDocs(watchlistsRef);
    const existingIds = new Set(existingSnap.docs.map((d) => d.id));

    // Upload local lists that do not exist on cloud yet
    for (const wl of localWatchlists) {
      if (!existingIds.has(wl.id)) {
        await saveUserWatchlistToCloud(userId, wl);
      }
    }
  } catch (err) {
    console.error('Failed to migrate local watchlists to cloud:', err);
  }
}

// ============================================================================
// 2. PORTFOLIO HOLDINGS & REBALANCING STORAGE
// ============================================================================

export interface PortfolioHolding {
  id: string;
  ticker: string;
  companyName: string;
  sector: string;
  shares: number;
  avgBuyPrice: number;
  currentPrice: number;
  targetAllocationPct: number; // User defined target % of portfolio
  stopLossPrice?: number;
  notes?: string;
  vcpStage?: string;
  rsRating?: number;
  updatedAt?: number;
}

export interface PortfolioSettings {
  totalCash: number;
  targetCashPct: number; // e.g. 10%
  maxSinglePositionPct: number; // e.g. 20%
  maxSectorExposurePct: number; // e.g. 30%
  riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  updatedAt?: number;
}

export const DEFAULT_PORTFOLIO_SETTINGS: PortfolioSettings = {
  totalCash: 25000,
  targetCashPct: 15,
  maxSinglePositionPct: 20,
  maxSectorExposurePct: 35,
  riskTolerance: 'MODERATE',
};

export function subscribeToUserPortfolio(
  userId: string,
  onUpdate: (holdings: PortfolioHolding[]) => void,
  onError?: (err: Error) => void
): () => void {
  const holdingsRef = collection(db, 'users', userId, 'portfolio_holdings');

  return onSnapshot(
    holdingsRef,
    (snapshot) => {
      const items: PortfolioHolding[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          ticker: data.ticker || '',
          companyName: data.companyName || data.ticker || '',
          sector: data.sector || 'General',
          shares: Number(data.shares) || 0,
          avgBuyPrice: Number(data.avgBuyPrice) || 0,
          currentPrice: Number(data.currentPrice) || Number(data.avgBuyPrice) || 0,
          targetAllocationPct: Number(data.targetAllocationPct) || 0,
          stopLossPrice: data.stopLossPrice ? Number(data.stopLossPrice) : undefined,
          notes: data.notes || '',
          vcpStage: data.vcpStage || '',
          rsRating: data.rsRating ? Number(data.rsRating) : undefined,
          updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now(),
        });
      });
      onUpdate(items);
    },
    (err) => {
      console.error('Error listening to user portfolio:', err);
      if (onError) onError(err);
    }
  );
}

export async function savePortfolioHoldingToCloud(
  userId: string,
  holding: PortfolioHolding
): Promise<void> {
  const ref = doc(db, 'users', userId, 'portfolio_holdings', holding.id);
  await setDoc(
    ref,
    {
      ...holding,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deletePortfolioHoldingFromCloud(
  userId: string,
  holdingId: string
): Promise<void> {
  const ref = doc(db, 'users', userId, 'portfolio_holdings', holdingId);
  await deleteDoc(ref);
}

export function subscribeToPortfolioSettings(
  userId: string,
  onUpdate: (settings: PortfolioSettings) => void
): () => void {
  const ref = doc(db, 'users', userId, 'settings', 'portfolio');
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      const d = snap.data();
      onUpdate({
        totalCash: Number(d.totalCash) ?? DEFAULT_PORTFOLIO_SETTINGS.totalCash,
        targetCashPct: Number(d.targetCashPct) ?? DEFAULT_PORTFOLIO_SETTINGS.targetCashPct,
        maxSinglePositionPct: Number(d.maxSinglePositionPct) ?? DEFAULT_PORTFOLIO_SETTINGS.maxSinglePositionPct,
        maxSectorExposurePct: Number(d.maxSectorExposurePct) ?? DEFAULT_PORTFOLIO_SETTINGS.maxSectorExposurePct,
        riskTolerance: d.riskTolerance || DEFAULT_PORTFOLIO_SETTINGS.riskTolerance,
        updatedAt: d.updatedAt?.toMillis ? d.updatedAt.toMillis() : Date.now(),
      });
    } else {
      onUpdate(DEFAULT_PORTFOLIO_SETTINGS);
    }
  });
}

export async function savePortfolioSettingsToCloud(
  userId: string,
  settings: PortfolioSettings
): Promise<void> {
  const ref = doc(db, 'users', userId, 'settings', 'portfolio');
  await setDoc(
    ref,
    {
      ...settings,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
