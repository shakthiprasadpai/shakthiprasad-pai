import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, googleLogout, getAccessToken } from '../utils/googleAuth';
import {
  DriveFileItem,
  DriveAboutInfo,
  DriveActivityItem,
  fetchDriveAbout,
  listDriveFiles,
  getOrCreateSepaFolder,
  uploadFileToDrive,
  downloadFileContent,
  trashDriveFile,
  restoreDriveFile,
  toggleStarFile,
  renameDriveFile,
  fetchDriveActivity,
  backupApplicationToDrive,
  restoreStateFromDriveBackup,
  formatByteSize
} from '../utils/googleDriveService';
import { openGooglePicker, PickedFile } from '../utils/googlePicker';
import { MinerviniTradeSetup } from '../types';
import {
  HardDrive,
  FileSpreadsheet,
  FileText,
  FileJson,
  File,
  Folder,
  Star,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Search,
  Plus,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User as UserIcon,
  LogOut,
  FolderOpen,
  Eye,
  Edit2,
  ArchiveRestore,
  Sparkles,
  Database,
  Lock,
  Layers,
  Activity,
  X
} from 'lucide-react';

interface GoogleDriveViewProps {
  stocks?: MinerviniTradeSetup[];
  isObsidian?: boolean;
}

type FileFilterType = 'ALL' | 'SPREADSHEET' | 'DOC' | 'JSON_BACKUP' | 'PDF' | 'FOLDER';

export const GoogleDriveView: React.FC<GoogleDriveViewProps> = ({
  stocks = [],
  isObsidian = true
}) => {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Drive state
  const [aboutInfo, setAboutInfo] = useState<DriveAboutInfo | null>(null);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [activities, setActivities] = useState<DriveActivityItem[]>([]);
  const [sepaFolder, setSepaFolder] = useState<DriveFileItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Filtering & View controls
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<FileFilterType>('ALL');
  const [showStarredOnly, setShowStarredOnly] = useState<boolean>(false);
  const [viewTrash, setViewTrash] = useState<boolean>(false);
  const [inSepaFolderOnly, setInSepaFolderOnly] = useState<boolean>(false);

  // Destructive Action Confirmation Modal State (MANDATORY REQUIREMENT)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText: string;
    actionType: 'trash' | 'permanent_delete' | 'restore_backup';
    targetFileId?: string;
    targetFileName?: string;
    backupContent?: string;
  } | null>(null);

  // Rename File Modal State
  const [renameDialog, setRenameDialog] = useState<{
    isOpen: boolean;
    fileId: string;
    currentName: string;
    newName: string;
  } | null>(null);

  // New File/Backup creation in progress
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);

  // Initialize Auth state listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setNeedsAuth(false);
        loadDriveData();
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const showNotification = (type: 'success' | 'error' | 'info', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage(null);
    }, 6000);
  };

  // Main Drive Data Loader
  const loadDriveData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [about, folder, activityList] = await Promise.all([
        fetchDriveAbout().catch(() => null),
        getOrCreateSepaFolder().catch(() => null),
        fetchDriveActivity().catch(() => [])
      ]);

      if (about) setAboutInfo(about);
      if (folder) setSepaFolder(folder);
      setActivities(activityList);

      const filesList = await listDriveFiles({
        includeTrashed: viewTrash,
        query: searchQuery,
        folderId: inSepaFolderOnly && folder ? folder.id : undefined
      });
      setFiles(filesList);
    } catch (err: any) {
      console.error('Error loading Google Drive data:', err);
      showNotification('error', err.message || 'Failed to load Google Drive files.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, viewTrash, inSepaFolderOnly]);

  // Trigger reload when search or trash toggle changes
  useEffect(() => {
    if (!needsAuth) {
      loadDriveData();
    }
  }, [loadDriveData, needsAuth]);

  // Google Sign-In handler
  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
        showNotification('success', `Connected to Google Drive as ${result.user.displayName || result.user.email}`);
        loadDriveData();
      }
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      showNotification('error', err.message || 'Google Sign-In failed. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Google Sign-Out handler
  const handleGoogleSignOut = async () => {
    await googleLogout();
    setUser(null);
    setNeedsAuth(true);
    setFiles([]);
    setAboutInfo(null);
    showNotification('info', 'Signed out from Google Drive.');
  };

  // Full Backup to Google Drive
  const handleCreateFullBackup = async () => {
    setIsBackingUp(true);
    try {
      const { file } = await backupApplicationToDrive();
      showNotification('success', `Backup saved to Google Drive: "${file.name}" in SEPA Trading Vault!`);
      loadDriveData();
    } catch (err: any) {
      console.error('Backup error:', err);
      showNotification('error', err.message || 'Failed to create backup on Google Drive.');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Export current SEPA Screener Setups as a report on Google Drive
  const handleExportSetupsReportToDrive = async () => {
    setIsBackingUp(true);
    try {
      const folder = await getOrCreateSepaFolder();
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const csvHeader = 'Ticker,Name,Sector,Industry,CurrentPrice,PivotPrice,TrendScore,RS_Rating,VCP_Stage,StopLoss,Target1\n';
      const csvRows = stocks
        .map(
          (s) =>
            `"${s.ticker}","${s.name}","${s.sector}","${s.industry}",${s.currentPrice},${s.pivotPrice},${s.trendScore},${s.rsRating},"${s.vcpStage}",${s.stopLossPrice},${s.target1Price}`
        )
        .join('\n');
      const csvContent = csvHeader + csvRows;

      const file = await uploadFileToDrive({
        name: `Minervini_SEPA_Setups_${dateStr}.csv`,
        content: csvContent,
        mimeType: 'text/csv',
        folderId: folder.id,
        description: `Mark Minervini SEPA Trend Template trade setups snapshot with ${stocks.length} candidates`
      });

      showNotification('success', `Exported ${stocks.length} setups to Google Drive: "${file.name}"`);
      loadDriveData();
    } catch (err: any) {
      console.error('Export setups error:', err);
      showNotification('error', err.message || 'Failed to export setups to Google Drive.');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Create Pre-Market Prep Document in Drive
  const handleCreatePreMarketDoc = async () => {
    setIsBackingUp(true);
    try {
      const folder = await getOrCreateSepaFolder();
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const content = `# Mark Minervini Pre-Market Preparation & Trading Plan
**Date**: ${now.toLocaleDateString()} | **Trader**: ${user?.displayName || 'Minervini Practitioner'}

---

## 1. General Market Assessment (M in SEPA)
- Major Indices Trend: [Confirmed Stage 2 Uptrend / In Correction / Mixed]
- Breadth & Distribution Days Count: [Low / Moderate / Elevated]
- Key Leading Sectors: Electronics, Defence, Capital Goods, IT

## 2. Active Focus Candidates for Today
${stocks.slice(0, 5).map((s, idx) => `${idx + 1}. **${s.ticker}** (${s.name})
   - Pivot Price: $${s.pivotPrice} | Stop Loss: $${s.stopLossPrice} (${s.stopLossPercent}% risk)
   - Pattern: ${s.patternType} (${s.vcpStage})
   - RS Rating: ${s.rsRating}/99 | Trend Score: ${s.trendScore}/8`).join('\n\n')}

## 3. Position Sizing & Risk Rules
- Max portfolio risk per trade: 1.0% - 1.25%
- Hard stop-loss violation threshold: -7% to -8% non-negotiable
- Progressive Exposure: Scale into winning trades, sit on hands during choppy churn.

---
*Created automatically via Mark Minervini SEPA Trend & VCP Screener.*`;

      const file = await uploadFileToDrive({
        name: `SEPA_PreMarket_Plan_${dateStr}.md`,
        content,
        mimeType: 'text/markdown',
        folderId: folder.id,
        description: 'Mark Minervini pre-market trading discipline and routine checklist'
      });

      showNotification('success', `Pre-Market Plan created in Google Drive: "${file.name}"`);
      loadDriveData();
    } catch (err: any) {
      console.error('Create doc error:', err);
      showNotification('error', err.message || 'Failed to create plan on Google Drive.');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Star / Unstar toggle
  const handleToggleStar = async (file: DriveFileItem) => {
    try {
      const newStarred = !file.starred;
      await toggleStarFile(file.id, newStarred);
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, starred: newStarred } : f))
      );
      showNotification('success', newStarred ? `Starred "${file.name}"` : `Unstarred "${file.name}"`);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update star');
    }
  };

  // Rename prompt submission
  const handleSubmitRename = async () => {
    if (!renameDialog || !renameDialog.newName.trim()) return;
    try {
      await renameDriveFile(renameDialog.fileId, renameDialog.newName.trim());
      setFiles((prev) =>
        prev.map((f) => (f.id === renameDialog.fileId ? { ...f, name: renameDialog.newName.trim() } : f))
      );
      showNotification('success', `Renamed file to "${renameDialog.newName.trim()}"`);
      setRenameDialog(null);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to rename file');
    }
  };

  // Open Google Picker
  const handleOpenGooglePicker = async () => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No access token available.');
      await openGooglePicker({
        accessToken: token,
        viewType: 'ALL',
        onFilePicked: (picked: PickedFile) => {
          showNotification('info', `Selected from Drive: "${picked.name}"`);
          loadDriveData();
        }
      });
    } catch (err: any) {
      console.error('Picker error:', err);
      showNotification('error', err.message || 'Google Picker could not be opened.');
    }
  };

  // Trigger restore preview modal with confirmation
  const handleInitiateRestore = async (file: DriveFileItem) => {
    try {
      setIsLoading(true);
      const content = await downloadFileContent(file.id);
      const parsed = JSON.parse(content);
      const watchlistsCount = parsed.data?.watchlists?.length || 0;
      const portfolioCount = parsed.data?.portfolio?.length || 0;
      const journalCount = parsed.data?.tradeJournal?.length || 0;
      const alertsCount = parsed.data?.priceAlerts?.length || 0;

      setConfirmDialog({
        isOpen: true,
        title: 'Restore Application State from Backup?',
        description: `This will update your local app data from backup file "${file.name}".\n\nSnapshot contains:\n• Watchlists: ${watchlistsCount}\n• Portfolio Holdings: ${portfolioCount}\n• Trade Journal Entries: ${journalCount}\n• Price Alerts: ${alertsCount}\n\nExisting items will be synchronized with this snapshot.`,
        confirmText: 'Yes, Restore Backup',
        actionType: 'restore_backup',
        targetFileId: file.id,
        targetFileName: file.name,
        backupContent: content
      });
    } catch (err: any) {
      showNotification('error', 'This file is not a valid SEPA JSON backup.');
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger Trash Confirmation (MANDATORY User Confirmation for Destructive Operations)
  const handleRequestTrash = (file: DriveFileItem) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Move File to Google Drive Trash?',
      description: `Are you sure you want to move "${file.name}" to the Google Drive Trash?\n\nYou can restore it from the Trash tab at any time before 30 days.`,
      confirmText: 'Move to Trash',
      actionType: 'trash',
      targetFileId: file.id,
      targetFileName: file.name
    });
  };

  // Trigger Permanent Delete Confirmation
  const handleRequestPermanentDelete = (file: DriveFileItem) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Permanently Delete File from Google Drive?',
      description: `WARNING: This action CANNOT be undone. "${file.name}" will be deleted permanently from your Google Drive storage.`,
      confirmText: 'Permanently Delete',
      actionType: 'permanent_delete',
      targetFileId: file.id,
      targetFileName: file.name
    });
  };

  // Execute Confirmed Destructive Action
  const handleExecuteConfirmedAction = async () => {
    if (!confirmDialog) return;
    const { actionType, targetFileId, targetFileName, backupContent } = confirmDialog;
    setConfirmDialog(null);

    try {
      if (actionType === 'trash' && targetFileId) {
        await trashDriveFile(targetFileId, false);
        setFiles((prev) => prev.filter((f) => f.id !== targetFileId));
        showNotification('success', `Moved "${targetFileName}" to Google Drive Trash.`);
      } else if (actionType === 'permanent_delete' && targetFileId) {
        await trashDriveFile(targetFileId, true);
        setFiles((prev) => prev.filter((f) => f.id !== targetFileId));
        showNotification('success', `Permanently deleted "${targetFileName}".`);
      } else if (actionType === 'restore_backup' && backupContent) {
        const result = restoreStateFromDriveBackup(backupContent);
        showNotification(
          'success',
          `Successfully restored ${result.restoredItems.join(', ')} from Google Drive backup!`
        );
      }
    } catch (err: any) {
      console.error('Action error:', err);
      showNotification('error', err.message || 'Operation failed.');
    }
  };

  // Filtered files list
  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      if (showStarredOnly && !file.starred) return false;

      if (activeFilter === 'SPREADSHEET') {
        return (
          file.mimeType.includes('spreadsheet') ||
          file.name.endsWith('.csv') ||
          file.name.endsWith('.xlsx')
        );
      }
      if (activeFilter === 'DOC') {
        return (
          file.mimeType.includes('document') ||
          file.name.endsWith('.md') ||
          file.name.endsWith('.txt')
        );
      }
      if (activeFilter === 'JSON_BACKUP') {
        return file.name.endsWith('.json') || file.mimeType.includes('json');
      }
      if (activeFilter === 'PDF') {
        return file.name.endsWith('.pdf') || file.mimeType.includes('pdf');
      }
      if (activeFilter === 'FOLDER') {
        return file.mimeType.includes('folder');
      }
      return true;
    });
  }, [files, showStarredOnly, activeFilter]);

  // Render icon based on mime type
  const renderFileIcon = (file: DriveFileItem) => {
    if (file.mimeType.includes('folder')) {
      return <Folder className="w-5 h-5 text-amber-500 fill-amber-500/20" />;
    }
    if (file.mimeType.includes('spreadsheet') || file.name.endsWith('.csv')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    }
    if (file.mimeType.includes('document') || file.name.endsWith('.md')) {
      return <FileText className="w-5 h-5 text-blue-500" />;
    }
    if (file.name.endsWith('.json') || file.mimeType.includes('json')) {
      return <FileJson className="w-5 h-5 text-purple-500" />;
    }
    return <File className="w-5 h-5 text-gray-400" />;
  };

  // Storage calculation
  const storageUsageBytes = aboutInfo?.storageQuota?.usage ? parseInt(aboutInfo.storageQuota.usage, 10) : 0;
  const storageLimitBytes = aboutInfo?.storageQuota?.limit ? parseInt(aboutInfo.storageQuota.limit, 10) : 0;
  const storagePercent = storageLimitBytes > 0 ? Math.min(100, Math.round((storageUsageBytes / storageLimitBytes) * 100)) : 0;

  return (
    <div className={`space-y-6 ${isObsidian ? 'text-gray-100' : 'text-gray-900'}`}>
      {/* Toast Notification Banner */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3.5 border text-xs font-mono font-bold flex items-center justify-between rounded shadow-lg ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                : statusMessage.type === 'error'
                ? 'bg-rose-950/80 border-rose-500/60 text-rose-300'
                : 'bg-amber-950/80 border-amber-500/60 text-amber-300'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : statusMessage.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-gray-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Header & Account Status */}
      <div
        className={`p-6 border rounded-lg shadow-sm transition-all ${
          isObsidian
            ? 'bg-[#161b22] border-[#30363d]'
            : 'bg-white border-[#e5e4e1]'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 shadow-md">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-serif font-black tracking-tight flex items-center gap-2">
                  <span>Google Drive Trading Vault</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
                    Workspace Connected
                  </span>
                </h1>
                <p className="text-xs text-gray-400 font-mono">
                  Cloud backup, SEPA reports export, watchlists synchronization & document storage
                </p>
              </div>
            </div>
          </div>

          {/* Auth Action Area */}
          <div className="flex flex-wrap items-center gap-3">
            {needsAuth ? (
              /* Official Google Sign In Button Style */
              <button
                id="google-drive-sign-in-button"
                onClick={handleGoogleSignIn}
                disabled={isLoggingIn}
                className="gsi-material-button cursor-pointer transition-all hover:scale-102 active:scale-98 shadow-md"
              >
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      style={{ display: 'block' }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      ></path>
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      ></path>
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      ></path>
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      ></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    {isLoggingIn ? 'Connecting to Drive...' : 'Sign in with Google'}
                  </span>
                  <span style={{ display: 'none' }}>Sign in with Google</span>
                </div>
              </button>
            ) : (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 px-3 py-1.5 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold">{user?.email}</span>
                </div>

                <button
                  onClick={handleOpenGooglePicker}
                  className="px-3 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 flex items-center space-x-1.5 transition-all cursor-pointer"
                  title="Open Google Drive Picker dialog"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Drive Picker</span>
                </button>

                <button
                  onClick={loadDriveData}
                  disabled={isLoading}
                  className="p-2 rounded text-xs bg-slate-800 hover:bg-slate-700 text-gray-300 border border-slate-700 transition-all cursor-pointer"
                  title="Refresh Drive files"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
                </button>

                <button
                  onClick={handleGoogleSignOut}
                  className="p-2 rounded text-xs bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition-all cursor-pointer"
                  title="Sign out from Google Drive"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quota & Dedicated Folder info banner (When logged in) */}
        {!needsAuth && aboutInfo && (
          <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            {/* Storage Quota */}
            <div className="p-3 rounded bg-black/20 border border-white/5 space-y-1.5">
              <div className="flex justify-between items-center text-gray-400">
                <span className="uppercase text-[10px]">Drive Storage</span>
                <span>{storagePercent}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
              <div className="text-[11px] text-gray-300">
                {formatByteSize(storageUsageBytes)} of {formatByteSize(storageLimitBytes)}
              </div>
            </div>

            {/* SEPA Folder */}
            <div className="p-3 rounded bg-black/20 border border-white/5 space-y-1">
              <div className="text-gray-400 uppercase text-[10px] flex items-center space-x-1">
                <Folder className="w-3 h-3 text-amber-500" />
                <span>SEPA Cloud Vault</span>
              </div>
              <div className="font-bold truncate text-gray-200">
                {sepaFolder?.name || 'Mark Minervini Vault'}
              </div>
              <div className="text-[10px] text-emerald-400">
                Auto-provisioned in Google Drive
              </div>
            </div>

            {/* Files Indexed */}
            <div className="p-3 rounded bg-black/20 border border-white/5 space-y-1">
              <div className="text-gray-400 uppercase text-[10px]">Files Indexed</div>
              <div className="text-lg font-bold text-amber-400">{files.length}</div>
              <div className="text-[10px] text-gray-400">
                {files.filter((f) => f.starred).length} Starred • {files.filter((f) => f.name.endsWith('.json')).length} Backups
              </div>
            </div>

            {/* Account Connected */}
            <div className="p-3 rounded bg-black/20 border border-white/5 space-y-1">
              <div className="text-gray-400 uppercase text-[10px]">Google Account</div>
              <div className="font-bold truncate text-gray-200">
                {aboutInfo.user.displayName || 'Google User'}
              </div>
              <div className="text-[10px] text-gray-400 truncate">
                {aboutInfo.user.emailAddress}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Toolbar */}
      {!needsAuth && (
        <div
          className={`p-4 border rounded-lg shadow-sm flex flex-wrap items-center justify-between gap-3 ${
            isObsidian
              ? 'bg-[#161b22] border-[#30363d]'
              : 'bg-white border-[#e5e4e1]'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            {/* 1-Click Full Backup to Drive */}
            <button
              onClick={handleCreateFullBackup}
              disabled={isBackingUp}
              className="px-3.5 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center space-x-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{isBackingUp ? 'Uploading...' : '1-Click App Backup to Drive'}</span>
            </button>

            {/* Export Setups CSV to Drive */}
            <button
              onClick={handleExportSetupsReportToDrive}
              disabled={isBackingUp}
              className="px-3.5 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Save Setups CSV ({stocks.length})</span>
            </button>

            {/* Create Pre-Market Prep Plan */}
            <button
              onClick={handleCreatePreMarketDoc}
              disabled={isBackingUp}
              className="px-3.5 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-500 text-white flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>New Pre-Market Plan</span>
            </button>
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono">
            <button
              onClick={() => setInSepaFolderOnly(!inSepaFolderOnly)}
              className={`px-3 py-1.5 rounded border transition-colors cursor-pointer ${
                inSepaFolderOnly
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-slate-800/40 border-slate-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              📁 SEPA Vault Only
            </button>

            <button
              onClick={() => setViewTrash(!viewTrash)}
              className={`px-3 py-1.5 rounded border transition-colors cursor-pointer flex items-center space-x-1 ${
                viewTrash
                  ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                  : 'bg-slate-800/40 border-slate-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              <Trash2 className="w-3 h-3" />
              <span>Trash View</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Explorer & Activity Grid */}
      {!needsAuth ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Files Table (3 Cols) */}
          <div
            className={`lg:col-span-3 border rounded-lg shadow-sm p-5 space-y-4 ${
              isObsidian
                ? 'bg-[#161b22] border-[#30363d]'
                : 'bg-white border-[#e5e4e1]'
            }`}
          >
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search files in Google Drive..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs font-mono rounded bg-slate-900 border border-slate-700 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Type Category Filter Pills */}
              <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar w-full sm:w-auto text-[11px] font-mono">
                {(
                  [
                    { id: 'ALL', label: 'All Files' },
                    { id: 'JSON_BACKUP', label: 'Backups' },
                    { id: 'SPREADSHEET', label: 'Sheets/CSV' },
                    { id: 'DOC', label: 'Docs/MD' },
                    { id: 'FOLDER', label: 'Folders' }
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilter(tab.id)}
                    className={`px-2.5 py-1 rounded transition cursor-pointer ${
                      activeFilter === tab.id
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800/40 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}

                <button
                  onClick={() => setShowStarredOnly(!showStarredOnly)}
                  className={`p-1.5 rounded transition cursor-pointer ${
                    showStarredOnly
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800/40 text-gray-400 hover:text-amber-400'
                  }`}
                  title="Show starred only"
                >
                  <Star className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Files List */}
            {isLoading ? (
              <div className="py-16 text-center text-xs font-mono text-gray-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-500 mx-auto" />
                <p>Loading files from Google Drive...</p>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="py-16 text-center text-xs font-mono text-gray-500 space-y-3">
                <HardDrive className="w-10 h-10 text-gray-600 mx-auto" />
                <p>No files found matching your criteria.</p>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={handleCreateFullBackup}
                    className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    Create First Drive Backup
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400 uppercase text-[10px]">
                      <th className="pb-2 w-8"></th>
                      <th className="pb-2">Name</th>
                      <th className="pb-2 hidden sm:table-cell">Size</th>
                      <th className="pb-2 hidden md:table-cell">Modified</th>
                      <th className="pb-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredFiles.map((file) => {
                      const isBackup = file.name.endsWith('.json') && file.name.includes('Backup');
                      return (
                        <tr
                          key={file.id}
                          className="hover:bg-slate-800/30 transition-colors group"
                        >
                          {/* Icon & Star */}
                          <td className="py-3 pr-2">
                            <div className="flex items-center space-x-1.5">
                              <button
                                onClick={() => handleToggleStar(file)}
                                className="cursor-pointer"
                                title={file.starred ? 'Unstar file' : 'Star file'}
                              >
                                <Star
                                  className={`w-3.5 h-3.5 ${
                                    file.starred
                                      ? 'text-amber-400 fill-amber-400'
                                      : 'text-gray-600 hover:text-gray-400'
                                  }`}
                                />
                              </button>
                              {renderFileIcon(file)}
                            </div>
                          </td>

                          {/* File Name & Badges */}
                          <td className="py-3 pr-2">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-gray-200 truncate max-w-[200px] sm:max-w-xs md:max-w-sm">
                                {file.name}
                              </span>
                              {isBackup && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                                  SEPA BACKUP
                                </span>
                              )}
                            </div>
                            {file.description && (
                              <p className="text-[10px] text-gray-500 truncate max-w-sm">
                                {file.description}
                              </p>
                            )}
                          </td>

                          {/* Size */}
                          <td className="py-3 pr-2 hidden sm:table-cell text-gray-400 text-[11px]">
                            {file.mimeType.includes('folder') ? '—' : formatByteSize(file.size)}
                          </td>

                          {/* Modified Time */}
                          <td className="py-3 pr-2 hidden md:table-cell text-gray-400 text-[11px]">
                            {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : '—'}
                          </td>

                          {/* Actions */}
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {/* Restore from Backup (if json backup) */}
                              {isBackup && (
                                <button
                                  onClick={() => handleInitiateRestore(file)}
                                  className="px-2 py-1 rounded bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 border border-purple-700/50 text-[10px] font-bold uppercase flex items-center space-x-1 cursor-pointer"
                                  title="Restore watchlists, portfolio, and alerts from this backup"
                                >
                                  <ArchiveRestore className="w-3 h-3" />
                                  <span className="hidden sm:inline">Restore</span>
                                </button>
                              )}

                              {/* Open in Google Drive / Docs / Sheets */}
                              {file.webViewLink && (
                                <a
                                  href={file.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded hover:bg-slate-800 text-gray-400 hover:text-amber-400 transition"
                                  title="Open in Google Drive"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}

                              {/* Rename */}
                              {!file.trashed && (
                                <button
                                  onClick={() =>
                                    setRenameDialog({
                                      isOpen: true,
                                      fileId: file.id,
                                      currentName: file.name,
                                      newName: file.name
                                    })
                                  }
                                  className="p-1.5 rounded hover:bg-slate-800 text-gray-400 hover:text-blue-400 transition cursor-pointer"
                                  title="Rename file"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Trash / Delete with MANDATORY confirmation */}
                              {file.trashed ? (
                                <>
                                  <button
                                    onClick={async () => {
                                      await restoreDriveFile(file.id);
                                      showNotification('success', `Restored "${file.name}" from Trash`);
                                      loadDriveData();
                                    }}
                                    className="p-1.5 rounded hover:bg-slate-800 text-emerald-400 transition cursor-pointer"
                                    title="Restore file from Trash"
                                  >
                                    <ArchiveRestore className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleRequestPermanentDelete(file)}
                                    className="p-1.5 rounded hover:bg-rose-950/60 text-rose-400 transition cursor-pointer"
                                    title="Delete permanently"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleRequestTrash(file)}
                                  className="p-1.5 rounded hover:bg-rose-950/60 text-gray-500 hover:text-rose-400 transition cursor-pointer"
                                  title="Move to Google Drive Trash"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Activity Feed & Cloud Features Sidebar (1 Col) */}
          <div className="space-y-6">
            {/* Drive Activity Log */}
            <div
              className={`p-5 border rounded-lg shadow-sm space-y-3 ${
                isObsidian
                  ? 'bg-[#161b22] border-[#30363d]'
                  : 'bg-white border-[#e5e4e1]'
              }`}
            >
              <div className="flex items-center space-x-2 text-xs font-mono font-bold uppercase text-amber-400">
                <Activity className="w-4 h-4" />
                <span>Drive Activity Feed</span>
              </div>
              <p className="text-[11px] text-gray-400 font-mono">
                Recent changes and audited operations on your Google Drive trading files.
              </p>

              <div className="space-y-2.5 pt-2">
                {activities.length === 0 ? (
                  <p className="text-xs text-gray-500 font-mono italic">No recent activity detected.</p>
                ) : (
                  activities.slice(0, 6).map((act, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded bg-slate-900/60 border border-slate-800 text-[11px] font-mono space-y-1"
                    >
                      <div className="flex items-center justify-between text-gray-300">
                        <span className="font-bold text-amber-400">{act.action}</span>
                        <span className="text-[10px] text-gray-500">
                          {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-gray-300 truncate font-sans text-xs">
                        {act.targetFileName}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        By: {act.actor}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* SEPA Cloud Rules Checklist */}
            <div
              className={`p-5 border rounded-lg shadow-sm space-y-3 ${
                isObsidian
                  ? 'bg-[#161b22] border-[#30363d]'
                  : 'bg-white border-[#e5e4e1]'
              }`}
            >
              <div className="flex items-center space-x-2 text-xs font-mono font-bold uppercase text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Cloud Backup Guard</span>
              </div>
              <ul className="space-y-2 text-xs font-mono text-gray-300">
                <li className="flex items-start space-x-2">
                  <span className="text-amber-400">•</span>
                  <span><strong>Daily End-of-Day Backup</strong>: Save portfolio state to prevent browser cache eviction.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-amber-400">•</span>
                  <span><strong>Zero Risk Deletions</strong>: All trashed files are held in Drive for 30 days before purge.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-amber-400">•</span>
                  <span><strong>Multi-Device Sync</strong>: Restore watchlists and setups on any desktop or mobile device.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        /* Unauthenticated Landing State */
        <div
          className={`p-12 border rounded-lg text-center shadow-sm space-y-6 max-w-xl mx-auto ${
            isObsidian
              ? 'bg-[#161b22] border-[#30363d]'
              : 'bg-white border-[#e5e4e1]'
          }`}
        >
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            <HardDrive className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-serif font-black">Connect Your Google Drive</h2>
            <p className="text-xs text-gray-400 font-mono max-w-md mx-auto">
              With permission from your Google account, you can store SEPA watchlist backups, export trade plans, and synchronize portfolio files seamlessly.
            </p>
          </div>

          {/* Official Google Sign In Button */}
          <div className="flex justify-center pt-2">
            <button
              id="google-drive-unauth-sign-in"
              onClick={handleGoogleSignIn}
              disabled={isLoggingIn}
              className="gsi-material-button cursor-pointer transition-all hover:scale-102 active:scale-98 shadow-md"
            >
              <div className="gsi-material-button-state"></div>
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    style={{ display: 'block' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    ></path>
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    ></path>
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    ></path>
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    ></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {isLoggingIn ? 'Connecting...' : 'Sign in with Google'}
                </span>
                <span style={{ display: 'none' }}>Sign in with Google</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* MANDATORY User Confirmation Dialog for Destructive Operations */}
      <AnimatePresence>
        {confirmDialog && confirmDialog.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`max-w-md w-full p-6 rounded-lg border shadow-2xl space-y-4 ${
                isObsidian
                  ? 'bg-[#161b22] border-[#30363d] text-gray-100'
                  : 'bg-white border-[#e5e4e1] text-gray-900'
              }`}
            >
              <div className="flex items-center space-x-3 text-rose-400">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-lg font-serif font-black">{confirmDialog.title}</h3>
              </div>

              <div className="text-xs font-mono text-gray-300 whitespace-pre-line leading-relaxed bg-black/30 p-3 rounded border border-white/10">
                {confirmDialog.description}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-gray-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteConfirmedAction}
                  className={`px-4 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider text-white transition cursor-pointer ${
                    confirmDialog.actionType === 'permanent_delete'
                      ? 'bg-rose-600 hover:bg-rose-500'
                      : confirmDialog.actionType === 'trash'
                      ? 'bg-amber-600 hover:bg-amber-500'
                      : 'bg-purple-600 hover:bg-purple-500'
                  }`}
                >
                  {confirmDialog.confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rename Dialog */}
      <AnimatePresence>
        {renameDialog && renameDialog.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`max-w-md w-full p-6 rounded-lg border shadow-2xl space-y-4 ${
                isObsidian
                  ? 'bg-[#161b22] border-[#30363d] text-gray-100'
                  : 'bg-white border-[#e5e4e1] text-gray-900'
              }`}
            >
              <div className="flex items-center space-x-3 text-amber-400">
                <Edit2 className="w-5 h-5 shrink-0" />
                <h3 className="text-lg font-serif font-black">Rename Drive File</h3>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-gray-400">New File Name:</label>
                <input
                  type="text"
                  value={renameDialog.newName}
                  onChange={(e) =>
                    setRenameDialog({ ...renameDialog, newName: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-mono rounded bg-slate-900 border border-slate-700 text-gray-200 focus:outline-none focus:border-amber-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setRenameDialog(null)}
                  className="px-4 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-gray-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitRename}
                  disabled={!renameDialog.newName.trim()}
                  className="px-4 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer disabled:opacity-50"
                >
                  Save Name
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
