import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  Mail,
  User as UserIcon,
  Eye,
  EyeOff,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Activity,
  Layers,
  ChevronRight,
  ShieldAlert,
  Target,
  BarChart3,
  Bot,
} from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { loginWithPassword, registerWithPassword, loginDemo, signIn, error, clearError } = useAuth();

  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [identifier, setIdentifier] = useState<string>('trader@minervini.com');
  const [password, setPassword] = useState<string>('minervini123');
  const [displayName, setDisplayName] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [localMessage, setLocalMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLocalMessage(null);
    clearError();

    try {
      if (mode === 'LOGIN') {
        const success = await loginWithPassword(identifier, password, rememberMe);
        if (success && onLoginSuccess) {
          onLoginSuccess();
        }
      } else {
        const success = await registerWithPassword(identifier, password, displayName, rememberMe);
        if (success && onLoginSuccess) {
          onLoginSuccess();
        }
      }
    } catch (err: any) {
      setLocalMessage(err.message || 'Authentication error. Please check credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickPreset = (presetUser: string, presetPass: string) => {
    setIdentifier(presetUser);
    setPassword(presetPass);
    setMode('LOGIN');
    clearError();
    setLocalMessage(null);
  };

  const handleInstantDemo = (type: 'PRO' | 'INSTITUTIONAL') => {
    loginDemo(type);
    if (onLoginSuccess) onLoginSuccess();
  };

  const activeError = error || localMessage;

  return (
    <div className="min-h-screen w-full bg-[#07090e] text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-10 font-sans selection:bg-amber-500 selection:text-black relative overflow-hidden">
      
      {/* Background Ambience & Grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 20%, rgba(217, 119, 6, 0.22) 0%, transparent 60%),
                            linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)`,
          backgroundSize: '100% 100%, 48px 48px, 48px 48px'
        }}
      />

      {/* Outer Shell Card */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-5xl bg-[#0d121c]/95 border border-[#2b3547] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 backdrop-blur-xl"
      >
        
        {/* LEFT COLUMN: SEPA Branding, Proof Points & Feature Highlights */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#121927] via-[#0e1420] to-[#090d16] p-8 sm:p-10 border-b lg:border-b-0 lg:border-r border-[#263145] flex flex-col justify-between relative">
          
          {/* Subtle Golden Glow */}
          <div className="absolute top-0 left-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Brand Header */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 flex items-center justify-center font-serif font-black text-xl shadow-lg shadow-amber-500/20 border border-amber-300">
                M
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.25em] font-extrabold text-amber-400/90 block">
                  Specific Entry Point Analysis
                </span>
                <h1 className="text-xl font-serif font-black tracking-tight text-white flex items-center gap-1.5">
                  <span>MINERVINI SEPA®</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30">
                    PRO
                  </span>
                </h1>
              </div>
            </div>

            <p className="text-xs text-slate-300/90 leading-relaxed font-sans">
              Institutional-grade trading terminal engineered on U.S. Investing Champion Mark Minervini&apos;s Volatility Contraction Pattern (VCP) and 8-Rule Stage 2 Trend Template.
            </p>
          </div>

          {/* Center: Key Pillars of the Terminal */}
          <div className="my-8 space-y-3.5">
            <div className="flex items-start space-x-3 text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
              <Target className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-mono">Stage 2 Volatility Contraction</strong>
                <span className="text-slate-400 text-[11px]">Surveillance across contractions (T1–T4), pivot entries & volume dry-up.</span>
              </div>
            </div>

            <div className="flex items-start space-x-3 text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
              <BarChart3 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-mono">3:1 Asymmetric Risk Planner</strong>
                <span className="text-slate-400 text-[11px]">Precision position sizing, dynamic stop losses & RRR target alerts.</span>
              </div>
            </div>

            <div className="flex items-start space-x-3 text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
              <Bot className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-mono">Hermes AI Analyst & Bhavcopy</strong>
                <span className="text-slate-400 text-[11px]">Real-time Google Grounding, Indian NSE/BSE EOD scan & paper trading.</span>
              </div>
            </div>
          </div>

          {/* Bottom Security Assurance */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Bank-Grade 256-Bit SSL</span>
            </span>
            <span className="text-amber-400 font-bold">Cloud Synced</span>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Login & Password Portal */}
        <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-between bg-[#0e131d]">
          
          <div>
            {/* Top Mode Selector Tabs */}
            <div className="flex items-center justify-between border-b border-[#232d3f] pb-4 mb-6">
              <div>
                <h2 className="text-xl font-serif font-black text-white tracking-tight">
                  {mode === 'LOGIN' ? 'Sign In to Your Terminal' : 'Create SEPA Account'}
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {mode === 'LOGIN' ? 'Enter your login credentials to enter the main dashboard' : 'Register your trader profile for personalized watchlists & journals'}
                </p>
              </div>

              {/* Mode Toggle Switch */}
              <div className="flex items-center bg-[#151c29] p-1 rounded-lg border border-[#2b374a] text-xs font-mono">
                <button
                  type="button"
                  onClick={() => { setMode('LOGIN'); clearError(); }}
                  className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                    mode === 'LOGIN'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('REGISTER'); clearError(); }}
                  className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                    mode === 'REGISTER'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Register
                </button>
              </div>
            </div>

            {/* Error Display Banner */}
            <AnimatePresence>
              {activeError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-5 p-3 rounded-lg bg-rose-950/70 border border-rose-500/80 text-rose-200 text-xs font-mono flex items-start space-x-2.5 shadow-md"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <strong className="block text-rose-100 font-bold">Authentication Alert</strong>
                    <span className="text-[11px] leading-relaxed">{activeError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { clearError(); setLocalMessage(null); }}
                    className="text-rose-400 hover:text-white text-xs underline cursor-pointer"
                  >
                    Dismiss
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Credentials Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Optional Display Name on Registration */}
              {mode === 'REGISTER' && (
                <div>
                  <label className="block text-xs font-mono uppercase font-bold text-slate-300 mb-1.5">
                    Trader Full Name / Alias
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required={mode === 'REGISTER'}
                      placeholder="e.g. Mark Minervini"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-[#141b27] border border-[#2b374a] text-white pl-10 pr-3 py-2.5 rounded-lg text-xs font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>
              )}

              {/* Login / Email Identifier */}
              <div>
                <label className="block text-xs font-mono uppercase font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Login / Email Address</span>
                  <span className="text-[10px] text-slate-500 font-normal">Username or Email</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. trader@minervini.com or your_login"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full bg-[#141b27] border border-[#2b374a] text-white pl-10 pr-3 py-2.5 rounded-lg text-xs font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-xs font-mono uppercase font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Account Password</span>
                  <span className="text-[10px] text-slate-500 font-normal">Min. 4 characters</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter account password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#141b27] border border-[#2b374a] text-white pl-10 pr-10 py-2.5 rounded-lg text-xs font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Help */}
              <div className="flex items-center justify-between text-xs font-mono pt-1">
                <label className="flex items-center space-x-2 cursor-pointer select-none text-slate-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/40 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Stay logged in on this machine</span>
                </label>

                <button
                  type="button"
                  onClick={() => handleQuickPreset('trader@minervini.com', 'minervini123')}
                  className="text-amber-400 hover:underline cursor-pointer text-[11px]"
                >
                  Fill Pro Preset
                </button>
              </div>

              {/* Primary Action Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-3 py-3 px-4 rounded-lg bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-mono font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>{mode === 'LOGIN' ? 'Login & Open Main Dashboard' : 'Create Account & Enter'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Presets Chips */}
            <div className="mt-5 pt-4 border-t border-[#1f2838]">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 block mb-2">
                Quick-Select Trader Accounts:
              </span>
              <div className="flex flex-wrap gap-2 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => handleQuickPreset('trader@minervini.com', 'minervini123')}
                  className="px-2.5 py-1.5 rounded bg-[#172030] hover:bg-[#1f2c42] border border-[#2d3a52] text-amber-300 text-[11px] flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Mark Minervini (Pro)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('hedgefund@alpha.com', 'breakout2026')}
                  className="px-2.5 py-1.5 rounded bg-[#172030] hover:bg-[#1f2c42] border border-[#2d3a52] text-slate-300 text-[11px] flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  <span>Alpha Fund Institutional</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Fast Track: 1-Click Instant Demo Access & Google Sign-In */}
          <div className="mt-6 pt-5 border-t border-[#232d3f] space-y-2.5">
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              
              {/* 1-Click Demo Button */}
              <button
                type="button"
                onClick={() => handleInstantDemo('PRO')}
                className="w-full flex-1 py-2.5 px-3 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-600/50 text-emerald-300 font-mono text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs"
              >
                <Zap className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>1-Click Instant Demo Login</span>
              </button>

              {/* Google OAuth Alternative */}
              <button
                type="button"
                onClick={async () => {
                  await signIn();
                  if (onLoginSuccess) onLoginSuccess();
                }}
                className="w-full sm:w-auto py-2.5 px-4 rounded-lg bg-[#141b27] hover:bg-[#1a2333] border border-[#2d3a50] text-slate-200 font-mono text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer"
                title="Sign in with your Google Account"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Google</span>
              </button>
            </div>

            <p className="text-[10px] text-center font-mono text-slate-500">
              By logging in, you access real-time SEPA charts, Stage 2 Trend Template scanners, and trade risk calculations.
            </p>
          </div>

        </div>

      </motion.div>

      {/* Footer System Status Bar */}
      <div className="relative z-10 mt-6 flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-slate-500">
        <span className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Market Feed: Live</span>
        </span>
        <span>•</span>
        <span>SEPA® Execution Engine v3.8</span>
        <span>•</span>
        <span>NYSE • NASDAQ • NSE • BSE</span>
      </div>

    </div>
  );
};
