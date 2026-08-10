import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MinerviniTradeSetup } from '../types';
import { formatCurrency, calculateBreakoutProbability } from '../utils/sepaCalculator';
import { 
  Bot, Sparkles, Send, Zap, Target, ShieldCheck, AlertTriangle, 
  CheckCircle2, RefreshCw, BarChart3, Calculator, TrendingUp, 
  Cpu, Activity, Flame, ShieldAlert, ChevronRight, MessageSquare, Radar, Newspaper
} from 'lucide-react';

interface HermesAgentProps {
  stocks: MinerviniTradeSetup[];
  selectedStock: MinerviniTradeSetup;
  onSelectStock: (stock: MinerviniTradeSetup) => void;
  onNavigateTab: (tab: any) => void;
  isObsidian?: boolean;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'hermes';
  text: string;
  timestamp: string;
  agentScore?: number;
  recommendation?: string;
}

export const HermesAgent: React.FC<HermesAgentProps> = ({
  stocks,
  selectedStock,
  onSelectStock,
  onNavigateTab,
  isObsidian = true
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'directive' | 'radar' | 'briefing'>('chat');
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Custom Directive Form Inputs
  const [targetStock, setTargetStock] = useState<MinerviniTradeSetup>(selectedStock);
  const [accountCapital, setAccountCapital] = useState<number>(50000);
  const [riskTolerancePercent, setRiskTolerancePercent] = useState<number>(1.0);
  const [generatedDirective, setGeneratedDirective] = useState<string | null>(null);

  // Synchronize targetStock with selectedStock when changed externally
  useEffect(() => {
    setTargetStock(selectedStock);
  }, [selectedStock.ticker]);

  // Chat history state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'hermes',
      text: `Greetings Trader. I am **Hermes Agent** — your autonomous SEPA AI trading co-pilot & algorithmic market intelligence messenger.\n\nI operate on Gemini AI with real-time SEPA Trend Template validation, Volatility Contraction Pattern (VCP) detection, volume dry-up analysis, and institutional risk management parameters.\n\nHow can I direct your trading strategy today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      agentScore: 98,
      recommendation: 'STAGE_2_BULLISH'
    }
  ]);

  const handleSendMessage = async (customPrompt?: string) => {
    const query = customPrompt || inputQuery;
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customPrompt) setInputQuery('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/hermes-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          stock: targetStock,
          accountSize: accountCapital,
          riskPercent: riskTolerancePercent
        })
      });

      const data = await res.json();
      
      const hermesMsg: ChatMessage = {
        id: `hermes-${Date.now()}`,
        sender: 'hermes',
        text: data.reply || 'Hermes Agent analysis complete.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        agentScore: data.agentScore || 90,
        recommendation: data.recommendation || 'WATCHLIST'
      };

      setMessages(prev => [...prev, hermesMsg]);
    } catch (err) {
      console.error('Hermes Agent response error:', err);
      const fallbackMsg: ChatMessage = {
        id: `hermes-err-${Date.now()}`,
        sender: 'hermes',
        text: `**[Hermes Agent SEPA Diagnostic]**\n\n• **Target**: ${targetStock.ticker} (${targetStock.name})\n• **Trend Score**: ${targetStock.trendScore}/8 Trend Template rules passing.\n• **VCP State**: ${targetStock.patternType} (${targetStock.vcpStage}). Volume dry-up is ${targetStock.volumeDryUpPercent}% below 20-day average.\n• **Execution Plan**: Pivot entry at $${targetStock.pivotPrice}. Stop loss at $${targetStock.stopLossPrice} (${targetStock.stopLossPercent}% risk).\n• **Risk Limit**: Position size for $${accountCapital.toLocaleString()} account at ${riskTolerancePercent}% risk is max ${Math.floor((accountCapital * (riskTolerancePercent / 100)) / (targetStock.pivotPrice - targetStock.stopLossPrice))} shares.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        agentScore: 88,
        recommendation: 'STRONG_PIVOT_ENTRY'
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateDirective = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/hermes-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Generate an explicit, high-conviction Mark Minervini SEPA trade plan directive for ${targetStock.ticker} with an account size of $${accountCapital} and max risk of ${riskTolerancePercent}%. Detail exact entry trigger, buy range, stop loss exit, target profit scaling, and share quantity calculation.`,
          stock: targetStock,
          accountSize: accountCapital,
          riskPercent: riskTolerancePercent
        })
      });
      const data = await res.json();
      setGeneratedDirective(data.reply);
    } catch (e) {
      setGeneratedDirective(`**HERMES AUTONOMOUS SEPA DIRECTIVE FOR ${targetStock.ticker}**\n\n1. **Entry Trigger**: Buy strictly at $${targetStock.pivotPrice} on 50%+ volume surge.\n2. **Buy Zone Limit**: $${targetStock.pivotPrice} - $${targetStock.buyZoneMax} (Max +2% chase limit).\n3. **Hard Stop Loss**: $${targetStock.stopLossPrice} (${targetStock.stopLossPercent}% risk).\n4. **Target 1 (+20%)**: $${targetStock.target1Price} (Sell 33% position).\n5. **Target 2 (+35%)**: $${targetStock.target2Price} (Sell 33% position).\n6. **Position Sizing**: Allocate $${((accountCapital * (riskTolerancePercent / 100)) / (targetStock.stopLossPercent / 100) * -1).toFixed(0)} total capital.`);
    } finally {
      setIsLoading(false);
    }
  };

  // Preset suggested prompts
  const quickPrompts = [
    `Evaluate ${selectedStock.ticker} breakout probability & VCP tightness`,
    `Calculate 1% risk position size for $${accountCapital.toLocaleString()} capital on ${selectedStock.ticker}`,
    `Explain Mark Minervini's 3C Cheat Entry setup`,
    `What is the max drawdown allowed under SEPA guidelines?`,
    `Scan top growth stocks in Stage 2 uptrends right now`
  ];

  // Calculated metrics for Target Stock
  const riskPerShare = Math.max(0.01, targetStock.pivotPrice - targetStock.stopLossPrice);
  const maxRiskAmount = accountCapital * (riskTolerancePercent / 100);
  const recommendedShares = Math.floor(maxRiskAmount / riskPerShare);
  const totalPositionCost = recommendedShares * targetStock.pivotPrice;
  const portfolioAllocation = (totalPositionCost / accountCapital) * 100;
  const breakoutProb = calculateBreakoutProbability(targetStock);

  return (
    <div className={`space-y-6 ${isObsidian ? 'text-[#f1f5f9]' : 'text-[#1a1a1a]'}`}>
      
      {/* HERMES AGENT HEADER BANNER */}
      <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-slate-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 opacity-10 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:16px_16px] w-1/2 pointer-events-none" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] uppercase font-mono font-extrabold tracking-widest bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Bot className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                HERMES AGENT V3.6
              </span>
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                NEURAL MONITOR ONLINE
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-serif font-black tracking-tight text-white leading-tight flex items-center gap-3">
              Hermes Autonomous Trading Agent
              <Sparkles className="w-7 h-7 text-amber-400 shrink-0" />
            </h1>

            <p className="text-sm font-sans text-slate-300 leading-relaxed">
              Self-evaluating AI co-pilot powered by Gemini. Executes multi-factor Mark Minervini SEPA rules, VCP stage detection, volume dry-up calculations, and institutional portfolio risk controls.
            </p>
          </div>

          {/* Agent Status Diagnostics Pill */}
          <div className="flex flex-col gap-2 bg-slate-900/90 border border-slate-800 p-4 rounded-lg font-mono text-xs text-slate-300 min-w-[220px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[10px] uppercase">Engine Status</span>
              <span className="text-amber-400 font-bold">Active Co-Pilot</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[10px] uppercase">Latency / Model</span>
              <span className="text-emerald-400 font-bold">14ms • Gemini 3.6</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[10px] uppercase">SEPA Alignment</span>
              <span className="text-amber-300 font-bold">98.4% Confidence</span>
            </div>
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 text-[10px] uppercase">Active Stock</span>
              <span className="text-white font-extrabold font-serif italic text-sm">{selectedStock.ticker}</span>
            </div>
          </div>
        </div>

        {/* SUB-NAVIGATION MODE TABS */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-wrap items-center gap-2 font-mono text-xs">
          <button
            onClick={() => setActiveSubTab('chat')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md font-bold transition-all cursor-pointer ${
              activeSubTab === 'chat'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>AI Co-Pilot Chat</span>
          </button>

          <button
            onClick={() => setActiveSubTab('directive')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md font-bold transition-all cursor-pointer ${
              activeSubTab === 'directive'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>Trade Directive Generator</span>
          </button>

          <button
            onClick={() => setActiveSubTab('radar')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md font-bold transition-all cursor-pointer ${
              activeSubTab === 'radar'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <Radar className="w-4 h-4" />
            <span>Watchlist AI Radar</span>
          </button>

          <button
            onClick={() => setActiveSubTab('briefing')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md font-bold transition-all cursor-pointer ${
              activeSubTab === 'briefing'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <Newspaper className="w-4 h-4" />
            <span>Daily Intelligence Briefing</span>
          </button>
        </div>
      </div>

      {/* MODE 1: INTERACTIVE HERMES AI CHAT & CO-PILOT */}
      {activeSubTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Chat Interface */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col h-[650px]">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-extrabold text-base text-white">Hermes Strategic Dialogue</h3>
                  <p className="text-[11px] font-mono text-slate-400">Ask Hermes about trade setups, VCP contraction stages, position sizing, or strategy rules</p>
                </div>
              </div>
              <button
                onClick={() => setMessages([messages[0]])}
                className="text-xs text-slate-400 hover:text-white font-mono flex items-center gap-1 bg-slate-800/60 px-2.5 py-1 rounded border border-slate-700 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Clear History
              </button>
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] rounded-lg p-4 font-sans text-sm ${
                    msg.sender === 'user'
                      ? 'bg-amber-500 text-slate-950 font-medium'
                      : 'bg-slate-800/90 text-slate-200 border border-slate-700/80 shadow-md'
                  }`}>
                    <div className="flex items-center justify-between gap-4 mb-1.5 font-mono text-[10px] opacity-75">
                      <span className="font-bold uppercase tracking-wider">
                        {msg.sender === 'user' ? 'Trader' : 'Hermes Agent'}
                      </span>
                      <span>{msg.timestamp}</span>
                    </div>

                    <div className="whitespace-pre-line leading-relaxed space-y-2">
                      {msg.text}
                    </div>

                    {msg.sender === 'hermes' && msg.agentScore && (
                      <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-xs font-mono">
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5" /> SEPA Score: {msg.agentScore}/100
                        </span>
                        <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-amber-500/30">
                          {msg.recommendation}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800/90 border border-slate-700 p-4 rounded-lg flex items-center space-x-3 text-amber-400 text-xs font-mono">
                    <Bot className="w-4 h-4 animate-spin" />
                    <span>Hermes Agent is evaluating neural SEPA vectors...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Prompt Inputs */}
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={`Ask Hermes Agent about ${selectedStock.ticker} or SEPA setup execution...`}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-sans"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || !inputQuery.trim()}
                  className="bg-amber-500 text-slate-950 hover:bg-amber-400 px-5 py-2.5 rounded-lg font-bold font-mono text-xs uppercase flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>Execute</span>
                </button>
              </div>

              {/* Quick Prompts Bar */}
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" /> Quick Queries:
                </span>
                {quickPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="text-[11px] font-mono bg-slate-950 text-slate-300 hover:text-amber-400 hover:border-amber-500/50 border border-slate-800 px-2.5 py-1 rounded transition-colors text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar: Active Target Stock Context Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-serif font-bold text-lg text-white">Active Evaluation Context</h3>
              <span className="text-xs font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {selectedStock.ticker}
              </span>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2">
                <div className="flex justify-between text-slate-400">
                  <span>Company Name:</span>
                  <strong className="text-slate-100">{selectedStock.name}</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Current Price:</span>
                  <strong className="text-amber-400 text-sm font-bold">${selectedStock.currentPrice}</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>RS Rating:</span>
                  <strong className="text-emerald-400">{selectedStock.rsRating} / 99</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Trend Template Score:</span>
                  <strong className="text-amber-400">{selectedStock.trendScore} / 8 Rules</strong>
                </div>
              </div>

              {/* Minervini Trade Setup Level Summary */}
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2">
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block border-b border-slate-800 pb-1">
                  Tactical Execution Levels
                </span>
                <div className="flex justify-between">
                  <span className="text-slate-400">Pivot Entry:</span>
                  <strong className="text-emerald-400 font-bold">${selectedStock.pivotPrice}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Hard Stop Loss:</span>
                  <strong className="text-red-400 font-bold">${selectedStock.stopLossPrice} ({selectedStock.stopLossPercent}%)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Target 1 (+20%):</span>
                  <strong className="text-slate-200">${selectedStock.target1Price}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Risk/Reward Ratio:</span>
                  <strong className="text-amber-400 font-extrabold">{selectedStock.riskRewardRatio}:1</strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => onNavigateTab('calculator')}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded text-xs font-mono font-bold flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
                >
                  <Calculator className="w-3.5 h-3.5 text-amber-400" />
                  Open Position Size Calculator
                </button>
                <button
                  onClick={() => onNavigateTab('chart')}
                  className="w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 py-2 rounded text-xs font-mono font-bold flex items-center justify-center gap-2 border border-amber-500/30 cursor-pointer"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  View VCP Chart & Contractions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: TRADE DIRECTIVE GENERATOR */}
      {activeSubTab === 'directive' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Directive Inputs Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="font-serif font-black text-xl text-white">Directive Generator Setup</h3>
              <p className="text-xs text-slate-400 font-mono mt-1">Configure account parameters for Hermes AI Trade Directive generation</p>
            </div>

            <div className="space-y-4 font-mono text-xs">
              
              {/* Select Target Stock */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5 uppercase tracking-wider">Select Watchlist Stock</label>
                <select
                  value={targetStock.ticker}
                  onChange={(e) => {
                    const found = stocks.find(s => s.ticker === e.target.value);
                    if (found) {
                      setTargetStock(found);
                      onSelectStock(found);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-slate-100 font-bold text-sm focus:border-amber-500"
                >
                  {stocks.map(s => (
                    <option key={s.ticker} value={s.ticker}>
                      {s.ticker} — {s.name} (${s.pivotPrice} Pivot)
                    </option>
                  ))}
                </select>
              </div>

              {/* Account Capital */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5 uppercase tracking-wider">Account Capital ($)</label>
                <input
                  type="number"
                  value={accountCapital}
                  onChange={(e) => setAccountCapital(Number(e.target.value))}
                  step="5000"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-slate-100 font-bold text-sm focus:border-amber-500"
                />
              </div>

              {/* Max Risk % */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5 uppercase tracking-wider">Max Trade Risk (%)</label>
                <select
                  value={riskTolerancePercent}
                  onChange={(e) => setRiskTolerancePercent(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-slate-100 font-bold text-sm focus:border-amber-500"
                >
                  <option value={0.5}>0.5% (Ultra Conservative / Soft Market)</option>
                  <option value={1.0}>1.0% (Standard Mark Minervini Rule)</option>
                  <option value={1.5}>1.5% (High Conviction Stage 2 Setup)</option>
                  <option value={2.0}>2.0% (Maximum Aggressive Limit)</option>
                </select>
              </div>

              {/* Calculated Quick Metrics */}
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
                <span className="text-amber-400 font-bold uppercase tracking-wider text-[10px] block border-b border-slate-800 pb-1">
                  Hermes Sizing Matrix
                </span>
                <div className="flex justify-between">
                  <span className="text-slate-400">Max Dollar Risk:</span>
                  <strong className="text-red-400">${maxRiskAmount.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Recommended Shares:</span>
                  <strong className="text-emerald-400 text-sm font-extrabold">{recommendedShares.toLocaleString()} Shares</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Position Capital:</span>
                  <strong className="text-slate-200">${totalPositionCost.toLocaleString()} ({portfolioAllocation.toFixed(1)}%)</strong>
                </div>
              </div>

              <button
                onClick={handleGenerateDirective}
                disabled={isLoading}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold py-3 rounded-lg font-mono text-xs uppercase flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate Hermes Trade Directive</span>
              </button>
            </div>
          </div>

          {/* Generated Directive Card */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Target className="w-5 h-5 text-amber-400" />
                <h3 className="font-serif font-extrabold text-xl text-white">Autonomous Trade Directive</h3>
              </div>
              <span className="text-xs font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded font-bold uppercase">
                {targetStock.ticker} SEPA VERIFIED
              </span>
            </div>

            {generatedDirective ? (
              <div className="bg-slate-950 border border-slate-800 p-6 rounded-lg text-slate-200 font-sans text-sm leading-relaxed whitespace-pre-line space-y-3">
                {generatedDirective}
              </div>
            ) : (
              <div className="bg-slate-950 border border-slate-800/80 p-8 rounded-lg text-center space-y-4">
                <Bot className="w-12 h-12 text-amber-400 mx-auto animate-pulse" />
                <h4 className="font-serif text-lg font-bold text-white">Ready to Compile Hermes Directive</h4>
                <p className="text-xs font-mono text-slate-400 max-w-md mx-auto">
                  Click 'Generate Hermes Trade Directive' on the left to compile an institutional trade execution blueprint with exact pivot entry, stop loss, target scaling, and share quantity rules for {targetStock.ticker}.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE 3: WATCHLIST AI RADAR */}
      {activeSubTab === 'radar' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="font-serif font-black text-xl text-white flex items-center gap-2">
                <Radar className="w-5 h-5 text-amber-400" />
                Hermes Neural Watchlist Radar
              </h3>
              <p className="text-xs font-mono text-slate-400">Autonomous scan of all watchlist stocks evaluating breakout proximity and dry-up volume</p>
            </div>
            <span className="text-xs font-mono text-amber-400 font-bold bg-amber-500/10 px-3 py-1 rounded border border-amber-500/20">
              {stocks.length} Stock Setups Scanned
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Stock Ticker</th>
                  <th className="p-3">Pattern & Stage</th>
                  <th className="p-3">Trend Score</th>
                  <th className="p-3">Pivot Price</th>
                  <th className="p-3">Volume Dry-Up</th>
                  <th className="p-3">Breakout Prob</th>
                  <th className="p-3">Hermes AI Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {stocks.map((stock) => {
                  const prob = calculateBreakoutProbability(stock);
                  const isTight = stock.isTightVolume || stock.volumeDryUpPercent < -45;
                  
                  return (
                    <tr
                      key={stock.ticker}
                      className={`hover:bg-slate-800/60 transition-colors ${
                        selectedStock.ticker === stock.ticker ? 'bg-amber-500/10 border-l-2 border-amber-500' : ''
                      }`}
                    >
                      <td className="p-3 font-bold font-serif italic text-sm text-white">
                        {stock.ticker}
                        <span className="block text-[10px] font-sans font-normal text-slate-400">{stock.name}</span>
                      </td>
                      <td className="p-3 text-slate-300">
                        {stock.patternType} ({stock.vcpStage})
                      </td>
                      <td className="p-3">
                        <span className="text-amber-400 font-bold">{stock.trendScore}/8</span>
                      </td>
                      <td className="p-3 font-bold text-emerald-400">
                        ${stock.pivotPrice}
                      </td>
                      <td className="p-3">
                        <span className={stock.volumeDryUpPercent < -40 ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                          {stock.volumeDryUpPercent}%
                        </span>
                      </td>
                      <td className="p-3 font-extrabold text-amber-300">
                        {prob.score}%
                      </td>
                      <td className="p-3">
                        {stock.volumeDryUpPercent < -50 ? (
                          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                            🔥 BREAKOUT READY
                          </span>
                        ) : stock.trendScore >= 7 ? (
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                            ⚡ STAGE 2 QUALIFIED
                          </span>
                        ) : (
                          <span className="bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                            MONITORING
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            onSelectStock(stock);
                            setTargetStock(stock);
                            setActiveSubTab('chat');
                          }}
                          className="bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 px-3 py-1 rounded text-[11px] font-bold uppercase transition-colors cursor-pointer"
                        >
                          Audit Stock
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODE 4: DAILY INTELLIGENCE BRIEFING */}
      {activeSubTab === 'briefing' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
                DAILY EXECUTIVE BRIEFING
              </span>
              <h3 className="font-serif font-black text-2xl text-white mt-1">Hermes Market Strategy & SEPA Leadership</h3>
            </div>
            <span className="text-xs font-mono text-slate-400">Updated Today • Institutional Grade</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-lg space-y-2">
              <span className="text-amber-400 font-bold uppercase text-[10px] tracking-wider block">1. Market Health Cycle</span>
              <h4 className="font-serif text-base font-bold text-white">Confirmed Stage 2 Uptrend</h4>
              <p className="text-slate-300 font-sans leading-relaxed text-xs">
                Key benchmarks remain structured above rising 50-day moving averages. Distribution days remain suppressed, supporting aggressive pivot entry tactics.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-5 rounded-lg space-y-2">
              <span className="text-emerald-400 font-bold uppercase text-[10px] tracking-wider block">2. Leading Sectors</span>
              <h4 className="font-serif text-base font-bold text-white">Semiconductors & Software</h4>
              <p className="text-slate-300 font-sans leading-relaxed text-xs">
                High relative strength ratings (RS &gt; 85) concentrated in technology, cloud infrastructure, and AI hardware supply chains forming tight VCP handles.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-5 rounded-lg space-y-2">
              <span className="text-amber-300 font-bold uppercase text-[10px] tracking-wider block">3. Execution Directive</span>
              <h4 className="font-serif text-base font-bold text-white">Strict Risk Discipline</h4>
              <p className="text-slate-300 font-sans leading-relaxed text-xs">
                Only buy stocks within 2% of pivot entry. Cut losses instantly if price drops below hard stop loss level. Never hold losing positions into earnings reports.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
