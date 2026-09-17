import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MinerviniTradeSetup, FivePaisaAccountMargin, FivePaisaOrderRequest } from '../types';
import { fetchFivePaisaMargin, placeFivePaisaOrder } from '../utils/fivePaisaService';
import { playHighConvictionBreakoutChime } from '../utils/audioAlertEngine';
import {
  X,
  Zap,
  ShieldCheck,
  Target,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Wallet,
  Sparkles,
  Lock,
  RefreshCw,
  Clock
} from 'lucide-react';

interface FivePaisaOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock: MinerviniTradeSetup;
  onOrderSuccess?: (orderId: string) => void;
  isObsidian?: boolean;
}

export const FivePaisaOrderModal: React.FC<FivePaisaOrderModalProps> = ({
  isOpen,
  onClose,
  stock,
  onOrderSuccess,
  isObsidian = false,
}) => {
  const [marginData, setMarginData] = useState<FivePaisaAccountMargin | null>(null);
  const [loadingMargin, setLoadingMargin] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [orderStatusMessage, setOrderStatusMessage] = useState<string | null>(null);
  const [orderSuccessId, setOrderSuccessId] = useState<string | null>(null);

  // Order Parameters
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [productType, setProductType] = useState<'CNC' | 'MIS'>('CNC');
  const [transactionType, setTransactionType] = useState<'BUY' | 'SELL'>('BUY');
  const [limitPrice, setLimitPrice] = useState<number>(stock.pivotPrice || stock.currentPrice);
  const [quantity, setQuantity] = useState<number>(10);
  const [stopLoss, setStopLoss] = useState<number>(stock.stopLossPrice || Number((stock.currentPrice * 0.94).toFixed(2)));
  const [targetPrice, setTargetPrice] = useState<number>(stock.target1Price || Number((stock.currentPrice * 1.20).toFixed(2)));
  const [riskPercentChoice, setRiskPercentChoice] = useState<number>(1.0); // 1% or 2% risk sizing

  useEffect(() => {
    if (isOpen) {
      setLimitPrice(stock.pivotPrice || stock.currentPrice);
      setStopLoss(stock.stopLossPrice || Number((stock.currentPrice * 0.94).toFixed(2)));
      setTargetPrice(stock.target1Price || Number((stock.currentPrice * 1.20).toFixed(2)));
      setOrderStatusMessage(null);
      setOrderSuccessId(null);

      // Load margin
      setLoadingMargin(true);
      fetchFivePaisaMargin().then((data) => {
        setMarginData(data);
        setLoadingMargin(false);

        // Auto-calculate smart position size based on available margin & 1% risk rule
        if (data && data.availableCashMargin > 0) {
          const riskAmount = data.availableCashMargin * (riskPercentChoice / 100);
          const perShareRisk = Math.max(1, (stock.pivotPrice || stock.currentPrice) - (stock.stopLossPrice || stock.currentPrice * 0.94));
          const calculatedShares = Math.max(1, Math.floor(riskAmount / perShareRisk));
          const maxAffordable = Math.floor(data.availableCashMargin / (stock.pivotPrice || stock.currentPrice));
          setQuantity(Math.min(calculatedShares, Math.max(1, maxAffordable)));
        }
      });
    }
  }, [isOpen, stock]);

  const handleRiskPercentChange = (pct: number) => {
    setRiskPercentChoice(pct);
    if (marginData && marginData.availableCashMargin > 0) {
      const riskAmount = marginData.availableCashMargin * (pct / 100);
      const perShareRisk = Math.max(1, limitPrice - stopLoss);
      const calculatedShares = Math.max(1, Math.floor(riskAmount / perShareRisk));
      const maxAffordable = Math.floor(marginData.availableCashMargin / limitPrice);
      setQuantity(Math.min(calculatedShares, Math.max(1, maxAffordable)));
    }
  };

  const totalOrderValue = quantity * (orderType === 'MARKET' ? stock.currentPrice : limitPrice);
  const totalRiskAmount = quantity * Math.max(0, limitPrice - stopLoss);
  const riskRewardRatio = limitPrice > stopLoss && targetPrice > limitPrice
    ? ((targetPrice - limitPrice) / (limitPrice - stopLoss)).toFixed(2)
    : '3.00';

  const hasEnoughMargin = marginData ? totalOrderValue <= marginData.totalPurchasingPower : true;

  const handleSubmitOrder = async () => {
    if (!hasEnoughMargin) return;
    setIsSubmitting(true);
    setOrderStatusMessage(null);

    const orderReq: FivePaisaOrderRequest = {
      symbol: stock.ticker,
      exchange: (stock.exchange === 'BSE' ? 'BSE' : 'NSE'),
      transactionType,
      orderType,
      productType,
      quantity,
      price: orderType === 'MARKET' ? stock.currentPrice : limitPrice,
      stopLossPrice: stopLoss,
      targetPrice,
      minerviniSetupTag: `${stock.patternType} ${stock.vcpStage}`
    };

    const result = await placeFivePaisaOrder(orderReq);
    setIsSubmitting(false);

    if (result.success && result.order) {
      setOrderSuccessId(result.order.orderId);
      setOrderStatusMessage(result.message);
      try {
        playHighConvictionBreakoutChime();
      } catch (e) {
        // audio optional
      }
      if (onOrderSuccess) {
        onOrderSuccess(result.order.orderId);
      }
    } else {
      setOrderStatusMessage(result.message || 'Order execution failed. Please check margin or broker credentials.');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className={`w-full max-w-2xl rounded-none border shadow-2xl overflow-hidden my-6 ${
            isObsidian ? 'bg-[#10141d] border-[#262b36] text-[#f1f5f9]' : 'bg-white border-[#1a1a1a] text-[#1a1a1a]'
          }`}
        >
          {/* Header */}
          <div className="bg-[#10141d] text-white p-5 border-b border-[#232936] flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-amber-500 text-black flex items-center justify-center font-mono font-black text-sm">
                5P
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    5paisa Capital Open API
                  </span>
                  <span className="text-[10px] uppercase font-mono text-emerald-400 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping mr-1" />
                    LIVE TERMINAL
                  </span>
                </div>
                <h3 className="text-lg font-serif font-black flex items-center space-x-2 mt-0.5">
                  <span>Execute Order: {stock.ticker}</span>
                  <span className="text-xs font-sans text-gray-400 font-normal">
                    ({stock.exchange})
                  </span>
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Account Margin Banner */}
          <div className={`p-4 border-b text-xs flex flex-wrap items-center justify-between gap-3 ${
            isObsidian ? 'bg-[#141923] border-[#262b36]' : 'bg-amber-50/60 border-amber-200'
          }`}>
            <div className="flex items-center space-x-2">
              <Wallet className="w-4 h-4 text-amber-500" />
              <span className="font-mono font-bold">5paisa Margin Available:</span>
              {loadingMargin ? (
                <span className="font-mono animate-pulse">Loading funds...</span>
              ) : (
                <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                  ₹{marginData?.availableCashMargin.toLocaleString('en-IN') || '3,85,420'}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-3 text-[11px] font-mono text-gray-500">
              <span>Client: <strong className="text-gray-700 dark:text-gray-300">{marginData?.clientCode || '5P88421943'}</strong></span>
              <span>Account: <strong>Cash Equity</strong></span>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-5">
            {orderSuccessId ? (
              <div className="p-6 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-600/40 space-y-4 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-emerald-900 dark:text-emerald-200">
                    Order Submitted to 5paisa!
                  </h4>
                  <p className="text-xs font-mono text-emerald-700 dark:text-emerald-300 mt-1">
                    {orderStatusMessage}
                  </p>
                  <p className="text-[11px] font-mono text-gray-500 mt-2">
                    Order ID: <strong>{orderSuccessId}</strong> • Timestamp: {new Date().toLocaleTimeString()} IST
                  </p>
                </div>

                <div className="pt-2 flex justify-center space-x-3">
                  <button
                    onClick={onClose}
                    className="px-5 py-2.5 bg-[#1a1a1a] dark:bg-amber-500 text-white dark:text-black font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-all cursor-pointer"
                  >
                    Done & View Order Book
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Minervini Setup Details Card */}
                <div className={`p-4 border space-y-2 ${
                  isObsidian ? 'bg-[#181e2b] border-[#2a3243]' : 'bg-[#f9f8f5] border-[#e5e4e1]'
                }`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-gray-500">Mark Minervini Setup:</span>
                    <span className="px-2 py-0.5 bg-black text-white dark:bg-amber-400 dark:text-black font-mono font-bold text-[10px]">
                      {stock.patternType} ({stock.vcpStage})
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono text-xs">
                    <div className="p-2 bg-white/60 dark:bg-black/40 border border-gray-200 dark:border-gray-800">
                      <div className="text-[10px] text-gray-500">Current LTP</div>
                      <div className="font-bold">₹{stock.currentPrice.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="p-2 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                      <div className="text-[10px]">Minervini Pivot</div>
                      <div className="font-bold">₹{stock.pivotPrice.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="p-2 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
                      <div className="text-[10px]">Hard Stop Loss</div>
                      <div className="font-bold">₹{stock.stopLossPrice.toLocaleString('en-IN')} ({stock.stopLossPercent}%)</div>
                    </div>
                  </div>
                </div>

                {/* Order Type & Product Selectors */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase text-gray-500 mb-1">
                      Product Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setProductType('CNC')}
                        className={`py-2 px-3 text-xs font-mono font-bold border transition-all cursor-pointer ${
                          productType === 'CNC'
                            ? 'bg-amber-500 text-black border-amber-600'
                            : 'bg-white/50 dark:bg-black/30 border-gray-300 dark:border-gray-700 text-gray-500'
                        }`}
                      >
                        CNC (Delivery)
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductType('MIS')}
                        className={`py-2 px-3 text-xs font-mono font-bold border transition-all cursor-pointer ${
                          productType === 'MIS'
                            ? 'bg-amber-500 text-black border-amber-600'
                            : 'bg-white/50 dark:bg-black/30 border-gray-300 dark:border-gray-700 text-gray-500'
                        }`}
                      >
                        MIS (Intraday)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase text-gray-500 mb-1">
                      Order Execution Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setOrderType('LIMIT')}
                        className={`py-2 px-3 text-xs font-mono font-bold border transition-all cursor-pointer ${
                          orderType === 'LIMIT'
                            ? 'bg-black text-white dark:bg-white dark:text-black border-black'
                            : 'bg-white/50 dark:bg-black/30 border-gray-300 dark:border-gray-700 text-gray-500'
                        }`}
                      >
                        LIMIT (Pivot)
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderType('MARKET')}
                        className={`py-2 px-3 text-xs font-mono font-bold border transition-all cursor-pointer ${
                          orderType === 'MARKET'
                            ? 'bg-black text-white dark:bg-white dark:text-black border-black'
                            : 'bg-white/50 dark:bg-black/30 border-gray-300 dark:border-gray-700 text-gray-500'
                        }`}
                      >
                        MARKET (LTP)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sizing & Pricing Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-mono font-bold uppercase text-gray-500">
                        Order Limit Price (₹)
                      </label>
                      <span className="text-[10px] text-gray-400">
                        {orderType === 'MARKET' ? 'Market At Execution' : 'Limit Pivot'}
                      </span>
                    </div>
                    <input
                      type="number"
                      disabled={orderType === 'MARKET'}
                      value={orderType === 'MARKET' ? stock.currentPrice : limitPrice}
                      onChange={(e) => setLimitPrice(Number(e.target.value))}
                      step="0.05"
                      className="w-full p-2.5 font-mono text-sm font-bold border border-gray-300 dark:border-gray-700 bg-white dark:bg-black/40 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-mono font-bold uppercase text-gray-500">
                        Share Quantity
                      </label>
                      <div className="flex items-center space-x-1 text-[10px]">
                        <span className="text-gray-400">Risk Rule:</span>
                        <button
                          type="button"
                          onClick={() => handleRiskPercentChange(1.0)}
                          className={`px-1.5 py-0.5 font-mono font-bold cursor-pointer ${
                            riskPercentChoice === 1.0 ? 'bg-amber-500 text-black' : 'bg-gray-200 dark:bg-gray-800'
                          }`}
                        >
                          1%
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRiskPercentChange(2.0)}
                          className={`px-1.5 py-0.5 font-mono font-bold cursor-pointer ${
                            riskPercentChoice === 2.0 ? 'bg-amber-500 text-black' : 'bg-gray-200 dark:bg-gray-800'
                          }`}
                        >
                          2%
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full p-2.5 font-mono text-sm font-bold border border-gray-300 dark:border-gray-700 bg-white dark:bg-black/40 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Bracket Order Controls (Stop Loss & Target) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase text-rose-600 dark:text-rose-400 mb-1">
                      Stop Loss Price (₹)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(Number(e.target.value))}
                      className="w-full p-2.5 font-mono text-sm font-bold border border-rose-300 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/20 focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase text-emerald-600 dark:text-emerald-400 mb-1">
                      Profit Target 1 (₹)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(Number(e.target.value))}
                      className="w-full p-2.5 font-mono text-sm font-bold border border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Total Value & Margin Verification */}
                <div className={`p-4 border space-y-2 font-mono text-xs ${
                  !hasEnoughMargin
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200'
                    : isObsidian
                    ? 'bg-[#181e2b] border-[#2a3243]'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400">Total Capital Required:</span>
                    <span className="font-bold text-sm">₹{totalOrderValue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400">Max Risk at Stop Loss:</span>
                    <span className="text-rose-600 dark:text-rose-400 font-bold">
                      -₹{totalRiskAmount.toLocaleString('en-IN')} ({(((limitPrice - stopLoss) / limitPrice) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-2">
                    <span className="text-gray-500 dark:text-gray-400">Asymmetric Risk / Reward:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-black">
                      {riskRewardRatio} : 1 Target Edge
                    </span>
                  </div>

                  {!hasEnoughMargin && (
                    <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400 pt-1">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Order exceeds current available 5paisa buying power. Reduce quantity or add funds.</span>
                    </div>
                  )}
                </div>

                {orderStatusMessage && !orderSuccessId && (
                  <div className="p-3 bg-rose-100 dark:bg-rose-900/40 border border-rose-300 text-rose-900 dark:text-rose-200 text-xs font-mono">
                    {orderStatusMessage}
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 border border-gray-300 dark:border-gray-700 font-bold text-xs uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting || !hasEnoughMargin}
                    onClick={handleSubmitOrder}
                    className={`px-6 py-2.5 font-bold text-xs uppercase tracking-widest flex items-center space-x-2 transition-all cursor-pointer ${
                      !hasEnoughMargin
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        : isSubmitting
                        ? 'bg-amber-600 text-black animate-pulse cursor-wait'
                        : 'bg-amber-500 hover:bg-amber-400 text-black border border-amber-600 shadow-md active:scale-95'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Sending to 5paisa API...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        <span>Confirm & Place 5paisa Order</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
