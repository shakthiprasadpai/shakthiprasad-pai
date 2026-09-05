import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, LogOut, Cloud, ShieldCheck, UserCheck, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserAuthButtonProps {
  isObsidian?: boolean;
}

export const UserAuthButton: React.FC<UserAuthButtonProps> = ({ isObsidian = false }) => {
  const { user, loading, error, signIn, signOut, clearError } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded border border-white/10 bg-black/20 text-gray-400 text-xs font-mono animate-pulse">
        <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <span className="hidden sm:inline">Auth...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative">
        <button
          onClick={signIn}
          className="px-3 py-1.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 hover:brightness-110 active:scale-95 transition-all shadow-sm border border-amber-300 cursor-pointer"
          title="Sign in with Google to sync watchlists, portfolio, and trade journals to Firebase Firestore"
        >
          {/* Google "G" logo */}
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Sign In</span>
        </button>

        {error && (
          <div className="absolute right-0 top-full mt-2 w-64 p-2.5 rounded bg-rose-950 border border-rose-500 text-rose-200 text-xs font-mono shadow-xl z-50 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Auth Notification</p>
              <p className="text-[11px] text-rose-300 mt-0.5">{error}</p>
              <button
                onClick={clearError}
                className="text-[10px] underline text-rose-400 mt-1 hover:text-white"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // User is signed in
  const displayName = user.displayName || user.email?.split('@')[0] || 'SEPA Trader';

  return (
    <div className="relative font-mono" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className={`px-2.5 py-1.5 rounded flex items-center space-x-2 border transition-all cursor-pointer ${
          isObsidian
            ? 'bg-[#181f2c] hover:bg-[#20293a] border-amber-500/40 text-gray-200'
            : 'bg-white hover:bg-gray-50 border-gray-300 text-gray-800'
        }`}
        title="Firebase Account & Cloud Sync Settings"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={displayName}
            className="w-5 h-5 rounded-full border border-amber-400 object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">
            {displayName[0]?.toUpperCase() || 'U'}
          </div>
        )}
        <div className="flex flex-col text-left">
          <span className="text-[11px] font-bold leading-none max-w-[100px] truncate">
            {displayName}
          </span>
          <span className="text-[9px] text-emerald-400 flex items-center space-x-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Firestore Sync</span>
          </span>
        </div>
        <ChevronDown className="w-3 h-3 text-gray-400" />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {dropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className={`absolute right-0 top-full mt-2 w-72 p-4 rounded-xl border shadow-2xl z-50 ${
              isObsidian
                ? 'bg-[#101520] border-[#2c374d] text-gray-200'
                : 'bg-white border-gray-200 text-gray-800'
            }`}
          >
            {/* Header info */}
            <div className="flex items-center space-x-3 pb-3 border-b border-white/10">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={displayName}
                  className="w-10 h-10 rounded-full border-2 border-amber-400 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-amber-500 text-slate-950 font-black text-base flex items-center justify-center">
                  {displayName[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs truncate text-white">{displayName}</p>
                <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                <span className="inline-flex items-center space-x-1 text-[9px] font-bold text-emerald-400 mt-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Google Authenticated</span>
                </span>
              </div>
            </div>

            {/* Cloud Sync Status info */}
            <div className="py-3 border-b border-white/10 space-y-2 text-[11px]">
              <div className="flex justify-between items-center text-gray-400">
                <span className="flex items-center space-x-1.5">
                  <Cloud className="w-3.5 h-3.5 text-amber-400" />
                  <span>Cloud Database</span>
                </span>
                <span className="text-emerald-400 font-bold">Connected</span>
              </div>
              <div className="flex justify-between items-center text-gray-400">
                <span className="flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Security Rules</span>
                </span>
                <span className="text-gray-300">User Subcollections</span>
              </div>
              <div className="flex justify-between items-center text-gray-400">
                <span className="flex items-center space-x-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Watchlists & Portfolio</span>
                </span>
                <span className="text-amber-300 font-bold">Auto-Synced</span>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={() => {
                signOut();
                setDropdownOpen(false);
              }}
              className="mt-3 w-full py-2 px-3 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center justify-center space-x-2 cursor-pointer transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out of Account</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
