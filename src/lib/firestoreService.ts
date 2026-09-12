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
import { db, auth } from './firebase';
import { CustomWatchlist } from '../utils/watchlistStorage';
import { SecondBrainNote, SecondBrainClip } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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

// ============================================================================
// 3. SECOND BRAIN P.A.R.A KNOWLEDGE VAULT FIRESTORE SYNC
// ============================================================================

/**
 * Real-time listener for user's Second Brain P.A.R.A notes
 */
export function subscribeToSecondBrainNotes(
  userId: string,
  onUpdate: (notes: SecondBrainNote[]) => void,
  onError?: (err: Error) => void
): () => void {
  const collectionPath = `users/${userId}/second_brain_notes`;
  const notesRef = collection(db, 'users', userId, 'second_brain_notes');
  const q = query(notesRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: SecondBrainNote[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          title: data.title || 'Untitled Note',
          category: data.category || 'PROJECTS',
          ticker: data.ticker || undefined,
          patternType: data.patternType || undefined,
          tags: Array.isArray(data.tags) ? data.tags : [],
          content: data.content || '',
          createdAt: data.createdAt?.toMillis ? new Date(data.createdAt.toMillis()).toISOString() : (data.createdAt || new Date().toISOString()),
          updatedAt: data.updatedAt?.toMillis ? new Date(data.updatedAt.toMillis()).toISOString() : (data.updatedAt || new Date().toISOString()),
          sourceType: data.sourceType || 'MANUAL',
          isPinned: !!data.isPinned,
          sepaRating: data.sepaRating || 'LEADER',
          wikilinks: Array.isArray(data.wikilinks) ? data.wikilinks : [],
        });
      });
      onUpdate(items);
    },
    (error) => {
      console.error('Error listening to Second Brain notes:', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, collectionPath);
    }
  );
}

/**
 * Persist or update a Second Brain note in Firestore
 */
export async function saveSecondBrainNoteToCloud(
  userId: string,
  note: SecondBrainNote
): Promise<void> {
  const docPath = `users/${userId}/second_brain_notes/${note.id}`;
  try {
    const ref = doc(db, 'users', userId, 'second_brain_notes', note.id);
    await setDoc(
      ref,
      {
        ...note,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

/**
 * Delete a Second Brain note from Firestore
 */
export async function deleteSecondBrainNoteFromCloud(
  userId: string,
  noteId: string
): Promise<void> {
  const docPath = `users/${userId}/second_brain_notes/${noteId}`;
  try {
    const ref = doc(db, 'users', userId, 'second_brain_notes', noteId);
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

/**
 * Real-time listener for user's Chrome Extension web clips in Firestore
 */
export function subscribeToSecondBrainClips(
  userId: string,
  onUpdate: (clips: SecondBrainClip[]) => void,
  onError?: (err: Error) => void
): () => void {
  const collectionPath = `users/${userId}/second_brain_clips`;
  const clipsRef = collection(db, 'users', userId, 'second_brain_clips');
  const q = query(clipsRef, orderBy('timestamp', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: SecondBrainClip[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          title: data.title || 'Untitled Web Clip',
          url: data.url || '',
          ticker: data.ticker || undefined,
          source: data.source || 'Chrome Extension Clipper',
          content: data.content || '',
          summary: data.summary || '',
          tags: Array.isArray(data.tags) ? data.tags : ['#web-clip'],
          category: data.category || 'PROJECTS',
          timestamp: data.timestamp?.toMillis ? new Date(data.timestamp.toMillis()).toISOString() : (data.timestamp || new Date().toISOString()),
          status: data.status || 'UNPROCESSED',
        });
      });
      onUpdate(items);
    },
    (error) => {
      console.error('Error listening to Second Brain clips:', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, collectionPath);
    }
  );
}

/**
 * Persist or update a Chrome Extension clip in Firestore
 */
export async function saveSecondBrainClipToCloud(
  userId: string,
  clip: SecondBrainClip
): Promise<void> {
  const docPath = `users/${userId}/second_brain_clips/${clip.id}`;
  try {
    const ref = doc(db, 'users', userId, 'second_brain_clips', clip.id);
    await setDoc(
      ref,
      {
        ...clip,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

/**
 * Delete a Chrome Extension clip from Firestore
 */
export async function deleteSecondBrainClipFromCloud(
  userId: string,
  clipId: string
): Promise<void> {
  const docPath = `users/${userId}/second_brain_clips/${clipId}`;
  try {
    const ref = doc(db, 'users', userId, 'second_brain_clips', clipId);
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

/**
 * Sync local notes and clips up to Firestore when user signs in
 */
export async function syncLocalSecondBrainToCloud(
  userId: string,
  localNotes: SecondBrainNote[],
  localClips: SecondBrainClip[]
): Promise<void> {
  try {
    const notesRef = collection(db, 'users', userId, 'second_brain_notes');
    const existingNotesSnap = await getDocs(notesRef);
    const existingNoteIds = new Set(existingNotesSnap.docs.map((d) => d.id));

    for (const note of localNotes) {
      if (!existingNoteIds.has(note.id)) {
        await saveSecondBrainNoteToCloud(userId, note);
      }
    }

    const clipsRef = collection(db, 'users', userId, 'second_brain_clips');
    const existingClipsSnap = await getDocs(clipsRef);
    const existingClipIds = new Set(existingClipsSnap.docs.map((d) => d.id));

    for (const clip of localClips) {
      if (!existingClipIds.has(clip.id)) {
        await saveSecondBrainClipToCloud(userId, clip);
      }
    }
  } catch (err) {
    console.error('Failed to sync local Second Brain items to Firestore:', err);
  }
}

/**
 * Sync clips received from Chrome Extension (backend store) into user Firestore vault
 */
export async function syncBackendClipsToFirestore(
  userId: string,
  backendClips: SecondBrainClip[]
): Promise<number> {
  let syncedCount = 0;
  try {
    const clipsRef = collection(db, 'users', userId, 'second_brain_clips');
    const snap = await getDocs(clipsRef);
    const existingIds = new Set(snap.docs.map((d) => d.id));

    for (const clip of backendClips) {
      if (!existingIds.has(clip.id)) {
        await saveSecondBrainClipToCloud(userId, clip);
        syncedCount++;
      }
    }
  } catch (err) {
    console.error('Failed to sync backend clips to Firestore:', err);
  }
  return syncedCount;
}

