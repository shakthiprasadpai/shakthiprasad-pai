import { PortfolioHolding, MinerviniTradeSetup } from '../types';

/**
 * Escapes strings for CSV format to avoid broken formatting when values contain quotes, commas, or line breaks.
 */
const escapeCsvCell = (val: string | number | undefined | null): string => {
  if (val === undefined || val === null) return '""';
  const str = String(val);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
};

/**
 * Trigger file download in browser
 */
const downloadCsv = (filename: string, csvContent: string) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Exports current Portfolio Holdings to CSV
 */
export const exportPortfolioToCsv = (holdings: PortfolioHolding[]) => {
  const headers = [
    'Ticker',
    'Company Name',
    'Exchange',
    'Shares',
    'Entry Price',
    'Current Price',
    'Total Cost Value',
    'Current Market Value',
    'Unrealized Gain/Loss ($)',
    'Unrealized Gain/Loss (%)',
    'Stop Loss Price',
    'Max Risk Amount ($)',
    'Target Price',
    'Reward/Risk Ratio',
    'Buy Date',
    'VCP Stage',
    'Notes / Strategy Rationale'
  ];

  const rows = holdings.map((h) => {
    const costValue = h.shares * h.entryPrice;
    const currentVal = h.shares * h.currentPrice;
    const pnlDollar = currentVal - costValue;
    const pnlPercent = costValue > 0 ? (pnlDollar / costValue) * 100 : 0;
    const riskDollar = (h.entryPrice - h.stopLossPrice) * h.shares;
    const targetGainDollar = (h.pivotTargetPrice - h.entryPrice) * h.shares;
    const rrRatio = riskDollar > 0 ? (targetGainDollar / riskDollar).toFixed(2) : 'N/A';

    return [
      escapeCsvCell(h.ticker),
      escapeCsvCell(h.stockName),
      escapeCsvCell(h.exchange),
      escapeCsvCell(h.shares),
      escapeCsvCell((h.entryPrice ?? 0).toFixed(2)),
      escapeCsvCell((h.currentPrice ?? 0).toFixed(2)),
      escapeCsvCell(costValue.toFixed(2)),
      escapeCsvCell(currentVal.toFixed(2)),
      escapeCsvCell(pnlDollar.toFixed(2)),
      escapeCsvCell(`${pnlPercent.toFixed(2)}%`),
      escapeCsvCell((h.stopLossPrice ?? 0).toFixed(2)),
      escapeCsvCell(riskDollar > 0 ? riskDollar.toFixed(2) : '0.00'),
      escapeCsvCell((h.pivotTargetPrice ?? 0).toFixed(2)),
      escapeCsvCell(rrRatio),
      escapeCsvCell(h.buyDate),
      escapeCsvCell(h.vcpStage),
      escapeCsvCell(h.notes || '')
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const dateStr = new Date().toISOString().split('T')[0];
  downloadCsv(`SEPA_Portfolio_Holdings_${dateStr}.csv`, csvContent);
};

/**
 * Exports Trade Plans & SEPA Scanner Setups to CSV
 */
export const exportTradePlansToCsv = (stocks: MinerviniTradeSetup[]) => {
  const headers = [
    'Ticker',
    'Company Name',
    'Exchange',
    'Sector',
    'Pattern Type',
    'VCP Stage',
    'Trend Template Score (/8)',
    'Current Price',
    'Pivot Buy Price',
    'Stop Loss Price',
    'Stop Loss Risk (%)',
    'Target 1 Price',
    'Target 1 Gain (%)',
    'Reward/Risk Ratio',
    'Volume Dry-Up (%)',
    'Breakout Volume Target',
    '50 SMA',
    '150 SMA',
    '200 SMA',
    'Trader Notes (Saved Local)'
  ];

  const rows = stocks.map((s) => {
    // Read saved notes for ticker from localStorage if present
    let savedNote = '';
    try {
      savedNote = localStorage.getItem(`sepa_trade_notes_${s.ticker}`) || '';
    } catch (e) {
      // ignore
    }

    return [
      escapeCsvCell(s.ticker),
      escapeCsvCell(s.name),
      escapeCsvCell(s.exchange),
      escapeCsvCell(s.sector),
      escapeCsvCell(s.patternType),
      escapeCsvCell(s.vcpStage),
      escapeCsvCell(`${s.trendScore}/8`),
      escapeCsvCell((s.currentPrice ?? 0).toFixed(2)),
      escapeCsvCell((s.pivotPrice ?? 0).toFixed(2)),
      escapeCsvCell((s.stopLossPrice ?? 0).toFixed(2)),
      escapeCsvCell(`-${s.stopLossPercent}%`),
      escapeCsvCell((s.target1Price ?? 0).toFixed(2)),
      escapeCsvCell(`+${(s.target1Percent ?? 0).toFixed(1)}%`),
      escapeCsvCell(`${(s.riskRewardRatio ?? 0).toFixed(2)}:1`),
      escapeCsvCell(`${s.volumeDryUpPercent}%`),
      escapeCsvCell(s.pivotVolume ? Math.round(s.pivotVolume) : 'N/A'),
      escapeCsvCell((s.sma50 ?? 0).toFixed(2)),
      escapeCsvCell((s.sma150 ?? 0).toFixed(2)),
      escapeCsvCell((s.sma200 ?? 0).toFixed(2)),
      escapeCsvCell(savedNote)
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const dateStr = new Date().toISOString().split('T')[0];
  downloadCsv(`SEPA_Trade_Plans_${dateStr}.csv`, csvContent);
};

export interface DetailedTradeCsvParams {
  stock: MinerviniTradeSetup;
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  shares: number;
  totalPositionCost: number;
  riskPerShare: number;
  totalDollarRisk: number;
  rMultiple: number;
  target3RPrice: number;
  potentialTotalGain3R: number;
  isTrailingStopEnabled?: boolean;
  trailingStopPrice?: number;
  trailingStopParamStr?: string;
  notes?: string;
  entryDate?: string;
  daysInTrade?: number | null;
}

/**
 * Exports current active trade parameters (entry, stop loss, position size, R-Multiple, 3:1 R target, trailing stop) to CSV
 */
export const exportDetailedTradeParametersToCsv = (params: DetailedTradeCsvParams) => {
  const {
    stock,
    entryPrice,
    stopLossPrice,
    targetPrice,
    shares,
    totalPositionCost,
    riskPerShare,
    totalDollarRisk,
    rMultiple,
    target3RPrice,
    potentialTotalGain3R,
    isTrailingStopEnabled,
    trailingStopPrice,
    trailingStopParamStr,
    notes,
    entryDate,
    daysInTrade,
  } = params;

  const riskPercent = entryPrice > 0 ? ((entryPrice - stopLossPrice) / entryPrice) * 100 : 0;
  const rewardPerShare = Math.max(0, targetPrice - entryPrice);
  const totalDollarReward = shares * rewardPerShare;
  const target3RGainPercent = entryPrice > 0 ? ((target3RPrice - entryPrice) / entryPrice) * 100 : 0;

  const headers = [
    'Export Date',
    'Ticker',
    'Company Name',
    'Exchange',
    'Sector',
    'Pattern Type',
    'Current Price',
    'Entry Price',
    'Trade Entry Date',
    'Time in Trade (Days Held)',
    'Stop Loss Price',
    'Risk Per Share ($)',
    'Risk From Entry (%)',
    'Position Size (Shares)',
    'Total Position Cost ($)',
    'Total Dollar Risk ($)',
    'Calculated R-Multiple',
    'Target Price ($)',
    'Target Total Profit ($)',
    '3:1 R Target Price ($)',
    '3:1 R Target Return (%)',
    '3:1 R Total Gain ($)',
    'Trailing Stop Active',
    'Projected Trailing Stop Price ($)',
    'Trailing Stop Config',
    'Target 1 Price ($)',
    'Target 2 Price ($)',
    'Trader Notes'
  ];

  let savedNote = notes;
  if (!savedNote) {
    try {
      savedNote = localStorage.getItem(`sepa_trade_notes_${stock.ticker}`) || '';
    } catch (e) {
      // ignore
    }
  }

  const row = [
    escapeCsvCell(new Date().toISOString().split('T')[0]),
    escapeCsvCell(stock.ticker),
    escapeCsvCell(stock.name),
    escapeCsvCell(stock.exchange),
    escapeCsvCell(stock.sector),
    escapeCsvCell(stock.patternType),
    escapeCsvCell((stock.currentPrice ?? 0).toFixed(2)),
    escapeCsvCell(entryPrice.toFixed(2)),
    escapeCsvCell(entryDate || 'N/A'),
    escapeCsvCell(daysInTrade !== undefined && daysInTrade !== null ? `${daysInTrade} Days` : 'N/A'),
    escapeCsvCell(stopLossPrice.toFixed(2)),
    escapeCsvCell(riskPerShare.toFixed(2)),
    escapeCsvCell(`-${riskPercent.toFixed(2)}%`),
    escapeCsvCell(shares),
    escapeCsvCell(totalPositionCost.toFixed(2)),
    escapeCsvCell(totalDollarRisk.toFixed(2)),
    escapeCsvCell(`${rMultiple.toFixed(2)}:1`),
    escapeCsvCell(targetPrice.toFixed(2)),
    escapeCsvCell(totalDollarReward.toFixed(2)),
    escapeCsvCell(target3RPrice.toFixed(2)),
    escapeCsvCell(`+${target3RGainPercent.toFixed(2)}%`),
    escapeCsvCell(potentialTotalGain3R.toFixed(2)),
    escapeCsvCell(isTrailingStopEnabled ? 'YES' : 'NO'),
    escapeCsvCell(trailingStopPrice ? trailingStopPrice.toFixed(2) : 'N/A'),
    escapeCsvCell(trailingStopParamStr || 'N/A'),
    escapeCsvCell((stock.target1Price ?? 0).toFixed(2)),
    escapeCsvCell((stock.target2Price ?? 0).toFixed(2)),
    escapeCsvCell(savedNote || '')
  ].join(',');

  const csvContent = [headers.join(','), row].join('\n');
  const dateStr = new Date().toISOString().split('T')[0];
  downloadCsv(`SEPA_Trade_Parameters_${stock.ticker}_${dateStr}.csv`, csvContent);
};

/**
  * Exports Watchlist & Portfolio formatted for Indian Brokerage Import tools (Zerodha Kite, Groww, AngelOne)
  */
export const exportBrokerageWatchlistToCsv = (stocks: MinerviniTradeSetup[], brokerage: 'zerodha' | 'groww' | 'angelone' = 'zerodha') => {
  let headers: string[] = [];
  let rows: string[] = [];

  if (brokerage === 'zerodha') {
    headers = ['tradingsymbol', 'exchange', 'instrument_token', 'name'];
    rows = stocks.map((s) => [
      escapeCsvCell(s.ticker),
      escapeCsvCell(s.exchange || 'NSE'),
      escapeCsvCell(''),
      escapeCsvCell(s.name)
    ].join(','));
  } else if (brokerage === 'groww') {
    headers = ['Symbol', 'Exchange', 'Segment', 'Alert Price'];
    rows = stocks.map((s) => [
      escapeCsvCell(s.ticker),
      escapeCsvCell(s.exchange || 'NSE'),
      escapeCsvCell('EQUITY'),
      escapeCsvCell(s.pivotPrice.toFixed(2))
    ].join(','));
  } else {
    // AngelOne / general
    headers = ['Scriptname', 'Exchange', 'Token', 'BuyTriggerPrice', 'StopLossPrice'];
    rows = stocks.map((s) => [
      escapeCsvCell(s.ticker),
      escapeCsvCell(s.exchange || 'NSE'),
      escapeCsvCell(''),
      escapeCsvCell(s.pivotPrice.toFixed(2)),
      escapeCsvCell(s.stopLossPrice.toFixed(2))
    ].join(','));
  }

  const csvContent = [headers.join(','), ...rows].join('\n');
  const dateStr = new Date().toISOString().split('T')[0];
  downloadCsv(`SEPA_${brokerage.toUpperCase()}_Watchlist_${dateStr}.csv`, csvContent);
};

/**
 * Exports Bhavcopy daily records to CSV
 */
export const exportBhavcopyToCsv = (records: any[], exchangeName: string = 'NSE_BSE') => {
  const headers = [
    'Symbol',
    'Company Name',
    'Exchange',
    'Series',
    'Close Price',
    'Prev Close',
    'Change (%)',
    'Total Traded Qty',
    'Turnover (Cr)',
    '52W High',
    '52W Low',
    'RS Rating',
    'SEPA Stage',
    'Volume Surge Ratio',
    'Delivery (%)'
  ];

  const rows = records.map((r) => [
    escapeCsvCell(r.symbol),
    escapeCsvCell(r.name),
    escapeCsvCell(r.exchange),
    escapeCsvCell(r.series),
    escapeCsvCell(r.close?.toFixed(2)),
    escapeCsvCell(r.prevClose?.toFixed(2)),
    escapeCsvCell(r.changePercent?.toFixed(2) + '%'),
    escapeCsvCell(r.totalTradedQty),
    escapeCsvCell(r.turnoverCr?.toFixed(2)),
    escapeCsvCell(r.high52w?.toFixed(2)),
    escapeCsvCell(r.low52w?.toFixed(2)),
    escapeCsvCell(r.rsRating),
    escapeCsvCell(r.sepaStage),
    escapeCsvCell(r.volumeSurgeRatio?.toFixed(2) + 'x'),
    escapeCsvCell(r.deliveryPercent !== undefined ? r.deliveryPercent.toFixed(1) + '%' : 'N/A')
  ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\n');
  const dateStr = new Date().toISOString().split('T')[0];
  downloadCsv(`Bhavcopy_Settlement_${exchangeName}_${dateStr}.csv`, csvContent);
};

/**
 * Exports TradingView formatted watchlist (.txt)
 */
export const exportTradingViewWatchlistText = (stocks: MinerviniTradeSetup[]) => {
  const lines = stocks.map((s) => {
    const ex = s.exchange?.toUpperCase() || 'NSE';
    const ticker = s.ticker?.toUpperCase().trim();
    return `${ex}:${ticker}`;
  });
  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `TradingView_Watchlist_${new Date().toISOString().split('T')[0]}.txt`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

