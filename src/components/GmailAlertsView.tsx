import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  Inbox,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Trash2,
  FileText,
  Clock,
  User as UserIcon,
  LogIn,
  ExternalLink,
  ShieldCheck,
  Eye,
  SlidersHorizontal,
  Flame,
  Zap,
  Tag
} from 'lucide-react';
import { MinerviniTradeSetup } from '../types';
import {
  getGmailProfile,
  sendGmailMessage,
  createGmailDraft,
  listGmailMessages,
  getFullGmailMessage,
  trashGmailMessage,
  generateSepaAlertHtml,
  generateDailyBriefingHtml,
  GmailProfile,
  GmailMessageSummary,
  GmailMessageFull
} from '../utils/gmailService';
import { googleSignIn, getCurrentUser } from '../utils/googleAuth';
import { User } from 'firebase/auth';

interface GmailAlertsViewProps {
  stocks: MinerviniTradeSetup[];
  isObsidian?: boolean;
}

export const GmailAlertsView: React.FC<GmailAlertsViewProps> = ({ stocks, isObsidian = false }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(getCurrentUser());
  const [profile, setProfile] = useState<GmailProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);

  // Active view mode: 'compose' | 'inbox' | 'daily_digest'
  const [activeSubTab, setActiveSubTab] = useState<'compose' | 'daily_digest' | 'inbox'>('compose');

  // Compose State
  const [selectedStockTicker, setSelectedStockTicker] = useState<string>(stocks[0]?.ticker || '');
  const [alertTriggerType, setAlertTriggerType] = useState<string>('PIVOT_BREAKOUT');
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [customSubject, setCustomSubject] = useState<string>('');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);

  // Confirmation Modal State (MANDATORY per Workspace guidelines)
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'SEND_ALERT' | 'SEND_DIGEST' | 'TRASH_MESSAGE';
    payload: any;
    description: string;
  } | null>(null);

  // Status banners
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Inbox & Search State
  const [searchQuery, setSearchQuery] = useState<string>('trade OR order OR 5paisa OR alert OR stock');
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageFull | null>(null);
  const [isLoadingSingleMessage, setIsLoadingSingleMessage] = useState<boolean>(false);

  // Update recipient email when profile loads
  useEffect(() => {
    if (profile?.emailAddress && !recipientEmail) {
      setRecipientEmail(profile.emailAddress);
    }
  }, [profile]);

  const loadProfileAndInbox = async () => {
    setIsLoadingProfile(true);
    setStatusError(null);
    try {
      const prof = await getGmailProfile();
      setProfile(prof);
      if (!recipientEmail) {
        setRecipientEmail(prof.emailAddress);
      }
      await loadInboxMessages(searchQuery);
    } catch (err: any) {
      setStatusError(err.message || 'Failed to connect to Gmail API.');
    } finally {
      setIsLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadProfileAndInbox();
    }
  }, [currentUser]);

  const handleSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res?.user) {
        setCurrentUser(res.user);
      }
    } catch (err: any) {
      setStatusError(err.message || 'Google Sign-In failed.');
    }
  };

  const loadInboxMessages = async (query: string) => {
    setIsLoadingMessages(true);
    try {
      const res = await listGmailMessages(query, 15);
      setMessages(res.messages);
    } catch (err: any) {
      setStatusError(err.message || 'Failed to search messages.');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSelectMessage = async (msgId: string) => {
    setIsLoadingSingleMessage(true);
    try {
      const fullMsg = await getFullGmailMessage(msgId);
      setSelectedMessage(fullMsg);
    } catch (err: any) {
      setStatusError(err.message || 'Failed to load full message.');
    } finally {
      setIsLoadingSingleMessage(false);
    }
  };

  const currentSelectedStock = stocks.find((s) => s.ticker === selectedStockTicker) || stocks[0];

  // Prepare Compose Alert
  const handleInitiateSendAlert = () => {
    if (!recipientEmail.trim()) {
      setStatusError('Please enter a recipient email address.');
      return;
    }
    const subject = customSubject || `🚨 Minervini SEPA Alert: ${currentSelectedStock?.ticker} (${alertTriggerType})`;
    setPendingAction({
      type: 'SEND_ALERT',
      payload: {
        to: recipientEmail.trim(),
        subject,
        stock: currentSelectedStock,
        triggerType: alertTriggerType,
      },
      description: `Send Minervini SEPA Trade Alert for ${currentSelectedStock?.ticker} to ${recipientEmail.trim()} via your Gmail account.`,
    });
    setShowConfirmModal(true);
  };

  // Prepare Daily Digest
  const handleInitiateSendDigest = () => {
    if (!recipientEmail.trim()) {
      setStatusError('Please enter a recipient email address.');
      return;
    }
    const subject = `Minervini SEPA Daily Digest - ${new Date().toLocaleDateString()}`;
    setPendingAction({
      type: 'SEND_DIGEST',
      payload: {
        to: recipientEmail.trim(),
        subject,
        stocks,
      },
      description: `Send the Daily SEPA Watchlist Digest (top Stage 2 breakout candidates) to ${recipientEmail.trim()} via your Gmail account.`,
    });
    setShowConfirmModal(true);
  };

  // Prepare Trash Message
  const handleInitiateTrashMessage = (msg: GmailMessageSummary | GmailMessageFull) => {
    setPendingAction({
      type: 'TRASH_MESSAGE',
      payload: { id: msg.id, subject: msg.subject },
      description: `Move email "${msg.subject}" to Trash in your Gmail account. This action modifies your mailbox.`,
    });
    setShowConfirmModal(true);
  };

  // Save as Draft (Non-destructive, quick save)
  const handleSaveDraft = async () => {
    if (!recipientEmail.trim() || !currentSelectedStock) return;
    setIsSavingDraft(true);
    setStatusSuccess(null);
    setStatusError(null);
    try {
      const subject = customSubject || `[DRAFT] Minervini SEPA Alert: ${currentSelectedStock.ticker}`;
      const html = generateSepaAlertHtml(currentSelectedStock, alertTriggerType);
      await createGmailDraft({
        to: recipientEmail.trim(),
        subject,
        bodyHtml: html,
      });
      setStatusSuccess(`Saved draft for "${subject}" in your Gmail account.`);
    } catch (err: any) {
      setStatusError(err.message || 'Failed to save draft in Gmail.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Execute Confirmed Action
  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    setShowConfirmModal(false);
    setStatusSuccess(null);
    setStatusError(null);

    try {
      if (pendingAction.type === 'SEND_ALERT') {
        setIsSending(true);
        const { to, subject, stock, triggerType } = pendingAction.payload;
        const html = generateSepaAlertHtml(stock, triggerType);
        const res = await sendGmailMessage({
          to,
          subject,
          bodyHtml: html,
        });
        setStatusSuccess(`Trade Alert successfully sent via Gmail! Message ID: ${res.id}`);
      } else if (pendingAction.type === 'SEND_DIGEST') {
        setIsSending(true);
        const { to, subject, stocks: digestStocks } = pendingAction.payload;
        const html = generateDailyBriefingHtml(digestStocks, to);
        const res = await sendGmailMessage({
          to,
          subject,
          bodyHtml: html,
        });
        setStatusSuccess(`Daily SEPA Digest sent to ${to}! Message ID: ${res.id}`);
      } else if (pendingAction.type === 'TRASH_MESSAGE') {
        const { id, subject } = pendingAction.payload;
        await trashGmailMessage(id);
        setStatusSuccess(`Moved "${subject}" to Trash.`);
        if (selectedMessage?.id === id) {
          setSelectedMessage(null);
        }
        await loadInboxMessages(searchQuery);
      }
    } catch (err: any) {
      setStatusError(err.message || 'Operation failed in Gmail.');
    } finally {
      setIsSending(false);
      setPendingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950/30 to-slate-900 border border-rose-500/30 rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-rose-500/20 text-rose-400 rounded-md border border-rose-500/30">
                <Mail className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-black tracking-wider text-slate-100 uppercase font-mono">
                Gmail Trading Alerts &amp; Dispatcher
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                WORKSPACE API
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Dispatch high-priority Minervini SEPA breakout alerts, daily watchlist digests, and monitor trading notifications directly through your authenticated Gmail account.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {currentUser && profile ? (
              <div className="flex items-center space-x-3 bg-slate-950/80 border border-rose-500/40 rounded-lg px-3 py-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <div className="text-left">
                  <div className="text-[11px] font-mono font-bold text-slate-200">
                    {profile.emailAddress}
                  </div>
                  <div className="text-[9px] font-mono text-slate-400">
                    {profile.messagesTotal.toLocaleString()} total emails
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-black uppercase tracking-wider py-2 px-4 rounded-md shadow-md flex items-center space-x-2 cursor-pointer transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign in with Google</span>
              </button>
            )}

            <button
              onClick={loadProfileAndInbox}
              disabled={isLoadingProfile || !currentUser}
              className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
              title="Refresh Gmail"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingProfile ? 'animate-spin text-rose-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Status Notification Alerts */}
        {statusSuccess && (
          <div className="mt-3 p-2.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-mono rounded flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusSuccess}</span>
            </div>
            <button
              onClick={() => setStatusSuccess(null)}
              className="text-emerald-400 hover:text-emerald-200 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {statusError && (
          <div className="mt-3 p-2.5 bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-mono rounded flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{statusError}</span>
            </div>
            <button
              onClick={() => setStatusError(null)}
              className="text-rose-400 hover:text-rose-200 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {!currentUser ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
            <Mail className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-200 font-mono">Sign In to Enable Gmail Alerts</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Authorize Google Workspace to send automated Minervini trade alerts and search your trading inbox directly from the dashboard.
          </p>
          <button
            onClick={handleSignIn}
            className="bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-black uppercase tracking-wider py-2.5 px-6 rounded-md shadow-lg inline-flex items-center space-x-2 cursor-pointer transition-all"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign in with Google</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Sub Navigation */}
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setActiveSubTab('compose')}
              className={`flex items-center space-x-2 py-2 px-3.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                activeSubTab === 'compose'
                  ? 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Send className="w-3.5 h-3.5 text-rose-400" />
              <span>Send SEPA Breakout Alert</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('daily_digest')}
              className={`flex items-center space-x-2 py-2 px-3.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                activeSubTab === 'daily_digest'
                  ? 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Daily SEPA Briefing Digest</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('inbox')}
              className={`flex items-center space-x-2 py-2 px-3.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                activeSubTab === 'inbox'
                  ? 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Inbox className="w-3.5 h-3.5 text-blue-400" />
              <span>Trading Inbox &amp; Confirmations</span>
            </button>
          </div>

          {/* TAB 1: COMPOSE SEPA TRADE ALERT */}
          {activeSubTab === 'compose' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Form Controls */}
              <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>Configure Trade Alert</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Minervini Template
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                      Candidate Stock *
                    </label>
                    <select
                      value={selectedStockTicker}
                      onChange={(e) => setSelectedStockTicker(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono rounded p-2 focus:border-rose-500 focus:outline-none"
                    >
                      {stocks.map((stock) => (
                        <option key={stock.ticker} value={stock.ticker}>
                          {stock.ticker} - {stock.name} (${stock.currentPrice.toFixed(2)}) • {stock.vcpStage}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                        Trigger Condition
                      </label>
                      <select
                        value={alertTriggerType}
                        onChange={(e) => setAlertTriggerType(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono rounded p-2 focus:border-rose-500 focus:outline-none"
                      >
                        <option value="PIVOT_BREAKOUT">🚨 Pivot Breakout Active</option>
                        <option value="VCP_TIGHTENING">⚡ VCP Contraction Tightening</option>
                        <option value="RS_HIGH">📈 RS Rating New High (90+)</option>
                        <option value="STOP_LOSS_WARNING">⚠️ Stop-Loss Risk Warning</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                        Recipient Email *
                      </label>
                      <input
                        type="email"
                        placeholder="your-email@gmail.com"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono rounded p-2 focus:border-rose-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                      Custom Email Subject (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder={`🚨 SEPA Alert: ${currentSelectedStock?.ticker} Pivot Entry`}
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono rounded p-2 focus:border-rose-500 focus:outline-none"
                    />
                  </div>

                  {currentSelectedStock && (
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-xs font-mono">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">
                        Target Candidate Specs:
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-500">Pivot:</span>{' '}
                          <span className="text-emerald-400 font-bold">
                            ${currentSelectedStock.pivotPrice.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Stop:</span>{' '}
                          <span className="text-rose-400 font-bold">
                            ${currentSelectedStock.stopLossPrice.toFixed(2)} ({currentSelectedStock.stopLossPercent}%)
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">RS:</span>{' '}
                          <span className="text-amber-400 font-bold">
                            {currentSelectedStock.rsRating}/99
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={handleInitiateSendAlert}
                      disabled={isSending}
                      className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-black uppercase tracking-wider py-2.5 px-4 rounded-md shadow-md flex items-center justify-center space-x-2 cursor-pointer transition-all disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      <span>{isSending ? 'Sending...' : 'Send Alert via Gmail'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={isSavingDraft}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-bold py-2.5 px-4 rounded-md border border-slate-700 cursor-pointer transition-all disabled:opacity-50"
                    >
                      {isSavingDraft ? 'Saving...' : 'Save Draft'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Live HTML Email Preview */}
              <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Eye className="w-4 h-4 text-emerald-400" />
                    <span>Live Gmail Render Preview</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    HTML Multipart
                  </span>
                </div>

                {currentSelectedStock ? (
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 max-h-[460px] overflow-y-auto">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: generateSepaAlertHtml(currentSelectedStock, alertTriggerType),
                      }}
                    />
                  </div>
                ) : (
                  <div className="py-20 text-center text-xs font-mono text-slate-500">
                    No stock selected for preview.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DAILY SEPA BRIEFING DIGEST */}
          {activeSubTab === 'daily_digest' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold font-mono text-slate-100 uppercase tracking-wider">
                    Daily SEPA Watchlist Digest
                  </h3>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Sends an automated morning briefing to your Gmail inbox listing the top 5 Stage 2 breakout candidates with their Pivot levels, Relative Strength ratings, and stop-loss rules.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                      Recipient Email *
                    </label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono rounded p-2 focus:border-rose-500 focus:outline-none"
                    />
                  </div>

                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5 text-xs font-mono">
                    <div className="text-slate-400 font-bold uppercase text-[10px]">
                      Candidates included:
                    </div>
                    {stocks.slice(0, 5).map((s) => (
                      <div key={s.ticker} className="flex items-center justify-between text-[11px]">
                        <span className="text-amber-400 font-bold">{s.ticker}</span>
                        <span className="text-slate-400">{s.patternType}</span>
                        <span className="text-emerald-400">${s.pivotPrice.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleInitiateSendDigest}
                    disabled={isSending}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-slate-950 font-mono text-xs font-black uppercase tracking-wider py-2.5 px-4 rounded-md shadow-md flex items-center justify-center space-x-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSending ? 'Sending...' : 'Dispatch Daily Briefing'}</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
                <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <Eye className="w-4 h-4 text-amber-400" />
                  <span>Digest Preview</span>
                </span>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 max-h-[460px] overflow-y-auto">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: generateDailyBriefingHtml(stocks, recipientEmail || 'trader@gmail.com'),
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INBOX & TRADING CONFIRMATIONS */}
          {activeSubTab === 'inbox' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Message List */}
              <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Inbox className="w-4 h-4 text-blue-400" />
                    <span>Trading Mailbox</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {messages.length} messages
                  </span>
                </div>

                {/* Search query box */}
                <div className="flex items-center space-x-1.5">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadInboxMessages(searchQuery)}
                    placeholder="Search Gmail query..."
                    className="flex-1 bg-slate-950 border border-slate-700 text-slate-200 text-[11px] font-mono rounded px-2.5 py-1.5 focus:border-rose-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => loadInboxMessages(searchQuery)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-1.5 rounded border border-slate-700 cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
                  {isLoadingMessages ? (
                    <div className="py-12 text-center text-xs font-mono text-slate-500 flex items-center justify-center space-x-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
                      <span>Searching mailbox...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="py-12 text-center text-xs font-mono text-slate-500 border border-dashed border-slate-800 rounded-lg p-4">
                      No messages matching query found. Try searching for &quot;trade&quot; or &quot;alert&quot;.
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isSelected = selectedMessage?.id === msg.id;
                      return (
                        <div
                          key={msg.id}
                          onClick={() => handleSelectMessage(msg.id)}
                          className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer flex items-start justify-between group ${
                            isSelected
                              ? 'bg-rose-950/30 border-rose-500/50'
                              : 'bg-slate-950/50 border-slate-800/80 hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center space-x-1.5">
                              {msg.isUnread && (
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                              )}
                              <span className="text-[11px] font-mono font-bold text-slate-300 truncate">
                                {msg.from.split('<')[0] || msg.from}
                              </span>
                            </div>
                            <div className="text-xs font-mono font-semibold text-slate-100 truncate mt-0.5">
                              {msg.subject}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 truncate mt-0.5">
                              {msg.snippet}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInitiateTrashMessage(msg);
                            }}
                            className="text-slate-600 hover:text-rose-400 p-1 rounded transition-colors shrink-0"
                            title="Move message to Trash"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Message Viewer */}
              <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
                {isLoadingSingleMessage ? (
                  <div className="py-24 text-center text-xs font-mono text-slate-500 flex items-center justify-center space-x-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
                    <span>Loading message contents...</span>
                  </div>
                ) : selectedMessage ? (
                  <div className="space-y-4">
                    <div className="border-b border-slate-800 pb-3 flex items-start justify-between">
                      <div className="min-w-0 pr-3">
                        <h4 className="text-base font-bold font-mono text-slate-100">
                          {selectedMessage.subject}
                        </h4>
                        <div className="text-xs font-mono text-slate-400 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                          <span>From: {selectedMessage.from}</span>
                          <span>Date: {selectedMessage.date}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleInitiateTrashMessage(selectedMessage)}
                        className="bg-slate-800 hover:bg-rose-950 text-rose-400 border border-rose-500/30 font-mono text-xs font-bold py-1.5 px-3 rounded flex items-center space-x-1.5 transition-all cursor-pointer"
                        title="Trash this message"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Trash</span>
                      </button>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                      {selectedMessage.bodyHtml ? (
                        <div
                          className="prose prose-invert max-w-none text-xs text-slate-200"
                          dangerouslySetInnerHTML={{ __html: selectedMessage.bodyHtml }}
                        />
                      ) : (
                        <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">
                          {selectedMessage.bodyText}
                        </pre>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-24 text-center text-xs font-mono text-slate-500 border border-dashed border-slate-800 rounded-lg p-6">
                    Select an email from the list on the left to read its full message content.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MANDATORY User Confirmation Dialog for Mutating Operations */}
      {showConfirmModal && pendingAction && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2 text-rose-400 border-b border-slate-800 pb-3">
              <ShieldCheck className="w-5 h-5" />
              <h3 className="text-sm font-bold font-mono text-slate-100 uppercase tracking-wider">
                Confirm Gmail Operation
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {pendingAction.description}
            </p>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-400 space-y-1">
              <div>
                <strong>Action:</strong> {pendingAction.type}
              </div>
              <div>
                <strong>Authorized Account:</strong> {profile?.emailAddress || currentUser?.email}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingAction(null);
                }}
                className="px-3 py-1.5 rounded text-xs font-mono text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold rounded flex items-center space-x-1.5 transition-all cursor-pointer shadow-md"
              >
                <span>Confirm &amp; Proceed</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
