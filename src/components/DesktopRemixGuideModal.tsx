import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MinerviniTradeSetup } from '../types';
import {
  Download,
  Laptop,
  Smartphone,
  ExternalLink,
  Copy,
  Check,
  Share2,
  Bookmark,
  ShieldCheck,
  Zap,
  Globe,
  HardDrive,
  Cpu,
  Monitor,
  Code,
  Sparkles,
  RefreshCw,
  Sliders,
  CheckCircle2,
  ArrowRight,
  PlusCircle,
  HelpCircle,
  FileCode
} from 'lucide-react';

interface DesktopRemixGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  stocksCount: number;
}

export const DesktopRemixGuideModal: React.FC<DesktopRemixGuideModalProps> = ({
  isOpen,
  onClose,
  stocksCount
}) => {
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);
  const [selectedPlatform, setSelectedPlatform] = useState<'DESKTOP_APP' | 'CHROME_PWA' | 'REMIX_EXPORT' | 'TRADINGVIEW'>('DESKTOP_APP');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);

  // Capture PWA beforeinstallprompt if supported
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPWA = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const outcome = await installPrompt.userChoice;
      if (outcome.outcome === 'accepted') {
        setIsInstallable(false);
      }
    } else {
      // Fallback instruction
      alert('To install on Desktop:\n1. Click the Install / Computer icon in your browser URL bar\n2. Or click Chrome Menu (⋮) -> Cast, save, and share -> Install Growth Stock Alpha');
    }
  };

  const appUrl = window.location.origin || window.location.href;

  const handleCopyAppUrl = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const desktopShortcutScript = `# Run this in Terminal (macOS/Linux) or PowerShell to launch standalone browser window:
google-chrome --app="${appUrl}" --window-size=1440,900
# Or on macOS with Chrome:
/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --app="${appUrl}"`;

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(desktopShortcutScript);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white dark:bg-[#0f1218] border border-[#e5e4e1] dark:border-slate-800 w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-[#1a1a1a] text-white p-5 flex items-center justify-between border-b border-black">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-amber-500 rounded flex items-center justify-center text-slate-950">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400 font-bold">
                  Desktop & Remix Integration
                </span>
                <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500 text-slate-950 font-bold uppercase rounded-xs">
                  Connected
                </span>
              </div>
              <h3 className="font-serif font-black text-xl text-white tracking-tight">
                Connect & Remix Minervini SEPA Scanner on Desktop
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-sm transition-colors cursor-pointer text-lg font-mono"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#e5e4e1] dark:border-slate-800 bg-[#f9f8f5] dark:bg-[#151921] px-4 pt-2 gap-2 overflow-x-auto text-xs font-mono">
          {[
            { id: 'DESKTOP_APP' as const, label: '💻 Desktop PWA App', icon: Laptop },
            { id: 'REMIX_EXPORT' as const, label: '⚡ Remix & Fork Code', icon: Share2 },
            { id: 'CHROME_PWA' as const, label: '🚀 Standalone Window Mode', icon: Monitor },
            { id: 'TRADINGVIEW' as const, label: '📊 PineScript & Obsidian Sync', icon: FileCode }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedPlatform(tab.id)}
              className={`flex items-center space-x-1.5 px-3 py-2 border-b-2 font-bold uppercase tracking-wider cursor-pointer transition-all ${
                selectedPlatform === tab.id
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-[#0f1218]'
                  : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-gray-800 dark:text-gray-200">
          
          {selectedPlatform === 'DESKTOP_APP' && (
            <div className="space-y-5">
              <div className="bg-amber-500/10 border border-amber-500/30 p-4 space-y-2">
                <div className="flex items-center space-x-2 text-amber-700 dark:text-amber-400 font-bold font-mono text-xs uppercase">
                  <Zap className="w-4 h-4" />
                  <span>Instant Desktop Installation (1-Click PWA)</span>
                </div>
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-sans">
                  You can install this Minervini SEPA Trend & VCP Scanner directly as a native desktop application on <strong>Windows, macOS, or Linux</strong>. It runs in its own frameless window with zero browser URL bar distractions and ultra-low latency.
                </p>
                <div className="pt-2">
                  <button
                    onClick={handleInstallPWA}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 flex items-center space-x-2 shadow-md cursor-pointer transition-all"
                  >
                    <Download className="w-4 h-4 fill-current" />
                    <span>Install Desktop App Now</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3 font-sans">
                <h4 className="font-serif font-bold text-base text-[#1a1a1a] dark:text-white">
                  Manual Desktop Install Instructions (Chrome, Edge, Brave, Safari)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-3 bg-[#f9f8f5] dark:bg-[#151921] border border-[#e5e4e1] dark:border-slate-800 space-y-1">
                    <span className="font-bold text-amber-600 block">Step 1</span>
                    <p className="text-gray-600 dark:text-gray-400 font-sans text-xs">
                      Look at the right side of your browser address bar (URL bar).
                    </p>
                  </div>
                  <div className="p-3 bg-[#f9f8f5] dark:bg-[#151921] border border-[#e5e4e1] dark:border-slate-800 space-y-1">
                    <span className="font-bold text-amber-600 block">Step 2</span>
                    <p className="text-gray-600 dark:text-gray-400 font-sans text-xs">
                      Click the <strong>Install / Computer Monitor icon</strong> or Chrome menu (⋮) → "Cast, save, and share" → "Install app".
                    </p>
                  </div>
                  <div className="p-3 bg-[#f9f8f5] dark:bg-[#151921] border border-[#e5e4e1] dark:border-slate-800 space-y-1">
                    <span className="font-bold text-amber-600 block">Step 3</span>
                    <p className="text-gray-600 dark:text-gray-400 font-sans text-xs">
                      The Minervini Scanner will launch as a standalone desktop app on your Dock / Taskbar!
                    </p>
                  </div>
                </div>
              </div>

              {/* App URL Copy Box */}
              <div className="space-y-1.5 font-mono text-xs">
                <span className="text-[10px] text-gray-500 uppercase font-bold">App Live URL:</span>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={appUrl}
                    className="w-full bg-[#f9f8f5] dark:bg-[#151921] border border-[#d5d4d0] dark:border-slate-700 px-3 py-2 text-xs font-mono text-gray-800 dark:text-gray-200 select-all"
                  />
                  <button
                    onClick={handleCopyAppUrl}
                    className="bg-[#1a1a1a] hover:bg-black text-white px-3.5 py-2 font-mono text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 shrink-0 cursor-pointer"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedPlatform === 'REMIX_EXPORT' && (
            <div className="space-y-4 font-sans text-xs">
              <div className="bg-[#f9f8f5] dark:bg-[#151921] border border-[#e5e4e1] dark:border-slate-800 p-4 space-y-2">
                <div className="flex items-center space-x-2 font-bold font-mono text-xs text-emerald-700 dark:text-emerald-400">
                  <Share2 className="w-4 h-4" />
                  <span>How to Remix & Fork this Application</span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  You can duplicate, remix, or deploy this complete Mark Minervini SEPA & VCP scanner codebase with your custom rules and API keys:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 pt-1 text-gray-600 dark:text-gray-400 font-mono text-[11px]">
                  <li><strong>Remix / Fork:</strong> Click the <strong>Share</strong> or <strong>Fork / Remix</strong> button at the top-right of your AI Studio environment.</li>
                  <li><strong>Export Codebase:</strong> Open the Settings menu (⚙) at the top right to download the complete source code as a <strong>ZIP archive</strong> or push directly to <strong>GitHub</strong>.</li>
                  <li><strong>Run Locally on Desktop:</strong> Unzip the repository, run <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded">npm install</code>, then <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded">npm run dev</code> to run the full scanner at <code className="text-amber-600">http://localhost:3000</code>.</li>
                </ol>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3 bg-white dark:bg-[#0f1218] border border-[#e5e4e1] dark:border-slate-800 space-y-1">
                  <span className="font-bold text-[#1a1a1a] dark:text-white flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Watchlist Persistence</span>
                  </span>
                  <p className="text-gray-500 font-sans text-[11px]">
                    All custom tickers, price alerts, and daily ranked setups automatically persist in your desktop browser's localStorage.
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-[#0f1218] border border-[#e5e4e1] dark:border-slate-800 space-y-1">
                  <span className="font-bold text-[#1a1a1a] dark:text-white flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Dual Market Architecture</span>
                  </span>
                  <p className="text-gray-500 font-sans text-[11px]">
                    Built-in support for NSE, BSE, NASDAQ, and NYSE equities with custom currency formatting (₹ / $).
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedPlatform === 'CHROME_PWA' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-sans">
                Launch the Minervini SEPA Scanner as a dedicated desktop window directly from your terminal or desktop shortcut:
              </p>

              <div className="space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Terminal / Shell Command:</span>
                  <button
                    onClick={handleCopySnippet}
                    className="text-amber-600 hover:text-amber-500 text-[11px] font-bold uppercase flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedSnippet ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-500">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Script</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-[#1a1a1a] text-amber-300 p-3 rounded font-mono text-[11px] overflow-x-auto leading-relaxed border border-black">
                  {desktopShortcutScript}
                </pre>
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/40 text-emerald-950 dark:text-emerald-300 text-xs font-mono space-y-1">
                <span className="font-bold block">💡 Pro Trader Tip:</span>
                <p className="font-sans text-[11px] leading-normal">
                  Pin this window to your second monitor next to TradingView or Zerodha/Charles Schwab for live SEPA alerts while watching intraday volume dry-ups!
                </p>
              </div>
            </div>
          )}

          {selectedPlatform === 'TRADINGVIEW' && (
            <div className="space-y-4 font-sans text-xs">
              <div className="p-4 bg-[#f9f8f5] dark:bg-[#151921] border border-[#e5e4e1] dark:border-slate-800 space-y-2">
                <h4 className="font-serif font-bold text-sm text-[#1a1a1a] dark:text-white">
                  Sync with Desktop Trading Tools (TradingView, Obsidian & Excel)
                </h4>
                <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
                  Use the built-in <strong>Export Trade Data</strong> tab in the navigation bar to export:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 font-mono text-[11px]">
                  <li><strong>PineScript v6:</strong> Copy the pre-built PineScript indicator directly into TradingView Pine Editor on desktop.</li>
                  <li><strong>Obsidian Markdown:</strong> Export daily research notes directly into your local Obsidian trading vault.</li>
                  <li><strong>CSV / JSON:</strong> Export qualified setups for Google Sheets or Excel backtesting.</li>
                </ul>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-[#f9f8f5] dark:bg-[#151921] p-4 border-t border-[#e5e4e1] dark:border-slate-800 flex items-center justify-between text-xs font-mono">
          <span className="text-[10px] text-gray-500">
            Growth Stock Alpha &bull; {stocksCount} Monitored SEPA Setups
          </span>

          <button
            onClick={onClose}
            className="bg-[#1a1a1a] hover:bg-black text-white px-4 py-2 font-bold uppercase tracking-wider cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
