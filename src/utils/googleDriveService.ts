import { getAccessToken } from './googleAuth';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  description?: string;
  starred?: boolean;
  trashed?: boolean;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  parents?: string[];
  owners?: Array<{
    displayName: string;
    emailAddress: string;
    photoLink?: string;
  }>;
}

export interface DriveStorageQuota {
  limit?: string;
  usage?: string;
  usageInDrive?: string;
  usageInDriveTrash?: string;
}

export interface DriveUserInfo {
  displayName: string;
  emailAddress: string;
  photoLink?: string;
}

export interface DriveAboutInfo {
  user: DriveUserInfo;
  storageQuota: DriveStorageQuota;
}

export interface DriveActivityItem {
  action: string;
  timestamp: string;
  targetFileName: string;
  actor: string;
}

const SEPA_FOLDER_NAME = 'Mark Minervini SEPA Trading Vault';

/**
 * Format raw byte size into human readable string
 */
export function formatByteSize(bytesStr?: string | number): string {
  if (!bytesStr) return '0 B';
  const bytes = typeof bytesStr === 'string' ? parseInt(bytesStr, 10) : bytesStr;
  if (isNaN(bytes) || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Fetch Drive user profile and quota usage
 */
export async function fetchDriveAbout(): Promise<DriveAboutInfo> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google. Please sign in.');

  const res = await fetch(
    'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,photoLink),storageQuota(limit,usage,usageInDrive,usageInDriveTrash)',
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to fetch Drive account info (${res.status})`);
  }

  return await res.json();
}

/**
 * List files in Google Drive with optional query and folder filtering
 */
export async function listDriveFiles(options?: {
  query?: string;
  folderId?: string;
  includeTrashed?: boolean;
  mimeType?: string;
  pageSize?: number;
}): Promise<DriveFileItem[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google. Please sign in.');

  const conditions: string[] = [];

  if (!options?.includeTrashed) {
    conditions.push('trashed = false');
  }

  if (options?.folderId) {
    conditions.push(`'${options.folderId}' in parents`);
  }

  if (options?.mimeType) {
    conditions.push(`mimeType = '${options.mimeType}'`);
  }

  if (options?.query && options.query.trim()) {
    const escaped = options.query.trim().replace(/'/g, "\\'");
    conditions.push(`name contains '${escaped}'`);
  }

  const q = conditions.length > 0 ? conditions.join(' and ') : undefined;
  const pageSize = options?.pageSize || 40;

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('pageSize', pageSize.toString());
  url.searchParams.set(
    'fields',
    'nextPageToken,files(id,name,mimeType,description,starred,trashed,createdTime,modifiedTime,size,webViewLink,webContentLink,iconLink,thumbnailLink,parents,owners)'
  );
  url.searchParams.set('orderBy', 'modifiedTime desc');
  if (q) {
    url.searchParams.set('q', q);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to list files from Google Drive (${res.status})`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Get or create the dedicated SEPA Trading Vault folder in Google Drive
 */
export async function getOrCreateSepaFolder(): Promise<DriveFileItem> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google. Please sign in.');

  // Search if folder already exists
  const existing = await listDriveFiles({
    query: SEPA_FOLDER_NAME,
    mimeType: 'application/vnd.google-apps.folder',
    includeTrashed: false
  });

  const matched = existing.find((f) => f.name === SEPA_FOLDER_NAME);
  if (matched) {
    return matched;
  }

  // Create folder
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: SEPA_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Official Mark Minervini SEPA Trading Strategy backup, reports, and watchlist vault'
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to create SEPA folder in Google Drive');
  }

  return await res.json();
}

/**
 * Upload text/binary content as a file to Google Drive using multipart upload
 */
export async function uploadFileToDrive(options: {
  name: string;
  content: string;
  mimeType: string;
  folderId?: string;
  description?: string;
}): Promise<DriveFileItem> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google. Please sign in.');

  const metadata: any = {
    name: options.name,
    mimeType: options.mimeType,
    description: options.description || 'Uploaded from Mark Minervini SEPA Screener'
  };

  if (options.folderId) {
    metadata.parents = [options.folderId];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${options.mimeType}\r\n\r\n` +
    options.content +
    closeDelimiter;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,createdTime,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to upload file to Google Drive');
  }

  return await res.json();
}

/**
 * Download text content of a file from Google Drive
 */
export async function downloadFileContent(fileId: string): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google. Please sign in.');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to download file content from Google Drive');
  }

  return await res.text();
}

/**
 * Move file to trash or permanently delete (DESTRUCTIVE - Requires prior user confirmation)
 */
export async function trashDriveFile(fileId: string, permanent: boolean = false): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google. Please sign in.');

  if (permanent) {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to delete file from Google Drive');
    }
  } else {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ trashed: true })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to move file to trash');
    }
  }
}

/**
 * Restore file from trash
 */
export async function restoreDriveFile(fileId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google. Please sign in.');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ trashed: false })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to restore file from trash');
  }
}

/**
 * Toggle starred status of a file
 */
export async function toggleStarFile(fileId: string, starred: boolean): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google. Please sign in.');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ starred })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to update star status');
  }
}

/**
 * Rename a file in Google Drive
 */
export async function renameDriveFile(fileId: string, newName: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google. Please sign in.');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: newName })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to rename file');
  }
}

/**
 * Query recent activity on Drive items (or fallback to modified files)
 */
export async function fetchDriveActivity(): Promise<DriveActivityItem[]> {
  const token = await getAccessToken();
  if (!token) return [];

  try {
    const res = await fetch('https://driveactivity.googleapis.com/v1/activity:query', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pageSize: 15
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.activities && Array.isArray(data.activities)) {
        return data.activities.map((act: any) => {
          const actionName = Object.keys(act.primaryActionDetail || {})[0] || 'Modified';
          const targetTitle = act.targets?.[0]?.driveItem?.title || 'Drive Item';
          const actorName = act.actors?.[0]?.user?.knownUser?.personName || 'User';
          return {
            action: actionName.replace(/([A-Z])/g, ' $1').trim(),
            timestamp: act.timestamp || new Date().toISOString(),
            targetFileName: targetTitle,
            actor: actorName
          };
        });
      }
    }
  } catch (e) {
    console.info('Drive activity API fallback:', e);
  }

  // Fallback to recent files modified
  try {
    const files = await listDriveFiles({ pageSize: 8 });
    return files.map((f) => ({
      action: 'Updated File',
      timestamp: f.modifiedTime || new Date().toISOString(),
      targetFileName: f.name,
      actor: f.owners?.[0]?.displayName || 'You'
    }));
  } catch {
    return [];
  }
}

/**
 * Full Application Backup to Google Drive (Watchlists, Trade Journal, Portfolio, Price Alerts)
 */
export async function backupApplicationToDrive(): Promise<{ file: DriveFileItem; timestamp: string }> {
  const folder = await getOrCreateSepaFolder();

  // Gather current local states
  const backupPayload = {
    version: '2.0',
    backupType: 'FULL_APPLICATION_STATE',
    createdAt: new Date().toISOString(),
    sourceApp: 'Mark Minervini SEPA Trend & VCP Screener',
    data: {
      watchlists: localStorage.getItem('minervini_custom_watchlists')
        ? JSON.parse(localStorage.getItem('minervini_custom_watchlists')!)
        : [],
      portfolio: localStorage.getItem('minervini_sepa_portfolio')
        ? JSON.parse(localStorage.getItem('minervini_sepa_portfolio')!)
        : [],
      tradeJournal: localStorage.getItem('minervini_trade_journal')
        ? JSON.parse(localStorage.getItem('minervini_trade_journal')!)
        : [],
      priceAlerts: localStorage.getItem('minervini_price_alerts')
        ? JSON.parse(localStorage.getItem('minervini_price_alerts')!)
        : [],
      audioSettings: localStorage.getItem('minervini_audio_alert_settings')
        ? JSON.parse(localStorage.getItem('minervini_audio_alert_settings')!)
        : {}
    }
  };

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const fileName = `Minervini_SEPA_Backup_${dateStr}_${timeStr}.json`;

  const file = await uploadFileToDrive({
    name: fileName,
    content: JSON.stringify(backupPayload, null, 2),
    mimeType: 'application/json',
    folderId: folder.id,
    description: `Full application backup created on ${now.toLocaleString()}`
  });

  return { file, timestamp: now.toISOString() };
}

/**
 * Restore application state from a selected Drive backup file content
 */
export function restoreStateFromDriveBackup(rawJson: string): {
  restoredItems: string[];
  watchlistsCount: number;
  portfolioCount: number;
  journalCount: number;
  alertsCount: number;
} {
  const parsed = JSON.parse(rawJson);
  if (!parsed.data) {
    throw new Error('Invalid backup format: missing root "data" object.');
  }

  const restoredItems: string[] = [];
  let watchlistsCount = 0;
  let portfolioCount = 0;
  let journalCount = 0;
  let alertsCount = 0;

  if (Array.isArray(parsed.data.watchlists)) {
    localStorage.setItem('minervini_custom_watchlists', JSON.stringify(parsed.data.watchlists));
    watchlistsCount = parsed.data.watchlists.length;
    restoredItems.push(`Watchlists (${watchlistsCount})`);
  }

  if (Array.isArray(parsed.data.portfolio)) {
    localStorage.setItem('minervini_sepa_portfolio', JSON.stringify(parsed.data.portfolio));
    portfolioCount = parsed.data.portfolio.length;
    restoredItems.push(`Portfolio Holdings (${portfolioCount})`);
    window.dispatchEvent(new CustomEvent('minervini_portfolio_updated', { detail: parsed.data.portfolio }));
  }

  if (Array.isArray(parsed.data.tradeJournal)) {
    localStorage.setItem('minervini_trade_journal', JSON.stringify(parsed.data.tradeJournal));
    journalCount = parsed.data.tradeJournal.length;
    restoredItems.push(`Trade Journal Entries (${journalCount})`);
  }

  if (Array.isArray(parsed.data.priceAlerts)) {
    localStorage.setItem('minervini_price_alerts', JSON.stringify(parsed.data.priceAlerts));
    alertsCount = parsed.data.priceAlerts.length;
    restoredItems.push(`Price Alerts (${alertsCount})`);
  }

  if (parsed.data.audioSettings) {
    localStorage.setItem('minervini_audio_alert_settings', JSON.stringify(parsed.data.audioSettings));
  }

  return {
    restoredItems,
    watchlistsCount,
    portfolioCount,
    journalCount,
    alertsCount
  };
}
