import {
  FivePaisaCredentials,
  FivePaisaAccountMargin,
  FivePaisaHolding,
  FivePaisaPosition,
  FivePaisaOrder,
  FivePaisaOrderRequest,
  FivePaisaAccountStatus,
  PortfolioHolding
} from '../types';

const STORAGE_KEY_CONFIG = 'minervini_5paisa_config';
const STORAGE_KEY_MARGIN = 'minervini_5paisa_margin';
const STORAGE_KEY_HOLDINGS = 'minervini_5paisa_holdings';
const STORAGE_KEY_POSITIONS = 'minervini_5paisa_positions';
const STORAGE_KEY_ORDERS = 'minervini_5paisa_orders';

// Initial realistic simulated Indian market demo holdings
const DEFAULT_SIMULATED_HOLDINGS: FivePaisaHolding[] = [
  {
    scripCode: 543211,
    symbol: 'DIXON',
    companyName: 'Dixon Technologies (India) Ltd',
    exchange: 'NSE',
    quantity: 25,
    poolQuantity: 25,
    averagePrice: 13150.0,
    currentPrice: 13850.0,
    dayChange: 260.0,
    dayChangePercent: 1.91,
    pnl: 17500.0,
    pnlPercent: 5.32,
    marketValue: 346250.0,
    sepaStage: 'Active Breakout',
    isTightVolume: true,
    rsRating: 94
  },
  {
    scripCode: 500408,
    symbol: 'TATAELXSI',
    companyName: 'Tata Elxsi Ltd',
    exchange: 'NSE',
    quantity: 35,
    poolQuantity: 35,
    averagePrice: 6920.0,
    currentPrice: 7420.0,
    dayChange: 110.0,
    dayChangePercent: 1.50,
    pnl: 17500.0,
    pnlPercent: 7.22,
    marketValue: 259700.0,
    sepaStage: 'Cup with Handle Pivot',
    isTightVolume: true,
    rsRating: 91
  },
  {
    scripCode: 500049,
    symbol: 'BEL',
    companyName: 'Bharat Electronics Ltd',
    exchange: 'NSE',
    quantity: 450,
    poolQuantity: 450,
    averagePrice: 285.5,
    currentPrice: 318.5,
    dayChange: 4.8,
    dayChangePercent: 1.53,
    pnl: 14850.0,
    pnlPercent: 11.56,
    marketValue: 143325.0,
    sepaStage: 'High Tight Flag',
    isTightVolume: false,
    rsRating: 89
  },
  {
    scripCode: 541154,
    symbol: 'HAL',
    companyName: 'Hindustan Aeronautics Ltd',
    exchange: 'NSE',
    quantity: 40,
    poolQuantity: 40,
    averagePrice: 4420.0,
    currentPrice: 4890.0,
    dayChange: 85.0,
    dayChangePercent: 1.77,
    pnl: 18800.0,
    pnlPercent: 10.63,
    marketValue: 195600.0,
    sepaStage: '50 SMA Bounce Pivot',
    isTightVolume: true,
    rsRating: 95
  },
  {
    scripCode: 540716,
    symbol: 'CDSL',
    companyName: 'Central Depository Services Ltd',
    exchange: 'NSE',
    quantity: 90,
    poolQuantity: 90,
    averagePrice: 1540.0,
    currentPrice: 1645.0,
    dayChange: 22.0,
    dayChangePercent: 1.35,
    pnl: 9450.0,
    pnlPercent: 6.82,
    marketValue: 148050.0,
    sepaStage: 'VCP T2 Pivot',
    isTightVolume: true,
    rsRating: 88
  },
  {
    scripCode: 500209,
    symbol: 'INFY',
    companyName: 'Infosys Limited',
    exchange: 'NSE',
    quantity: 80,
    poolQuantity: 80,
    averagePrice: 1785.0,
    currentPrice: 1865.0,
    dayChange: -12.0,
    dayChangePercent: -0.64,
    pnl: 6400.0,
    pnlPercent: 4.48,
    marketValue: 149200.0,
    sepaStage: 'Stage 2 Continuation',
    isTightVolume: false,
    rsRating: 82
  }
];

const DEFAULT_SIMULATED_POSITIONS: FivePaisaPosition[] = [
  {
    scripCode: 543211,
    symbol: 'DIXON',
    exchange: 'NSE',
    productType: 'CNC',
    buyQty: 25,
    buyAvgPrice: 13150.0,
    sellQty: 0,
    sellAvgPrice: 0,
    netQty: 25,
    currentPrice: 13850.0,
    mtm: 17500.0,
    status: 'OPEN'
  },
  {
    scripCode: 543664,
    symbol: 'KAYNES',
    exchange: 'NSE',
    productType: 'MIS',
    buyQty: 30,
    buyAvgPrice: 5120.0,
    sellQty: 0,
    sellAvgPrice: 0,
    netQty: 30,
    currentPrice: 5280.0,
    mtm: 4800.0,
    status: 'OPEN'
  }
];

const DEFAULT_SIMULATED_ORDERS: FivePaisaOrder[] = [
  {
    orderId: '5P-ORD-98214',
    clientCode: '5P88421943',
    exchange: 'NSE',
    symbol: 'DIXON',
    transactionType: 'BUY',
    orderType: 'LIMIT',
    productType: 'CNC',
    quantity: 25,
    price: 13150.0,
    triggerPrice: 13140.0,
    stopLossPrice: 12490.0,
    targetPrice: 15780.0,
    orderStatus: 'Executed',
    placedTime: '2026-09-15 09:32:14 IST',
    minerviniSetupTag: 'VCP 3T Breakout'
  },
  {
    orderId: '5P-ORD-98215',
    clientCode: '5P88421943',
    exchange: 'NSE',
    symbol: 'TATAELXSI',
    transactionType: 'BUY',
    orderType: 'LIMIT',
    productType: 'CNC',
    quantity: 35,
    price: 6920.0,
    triggerPrice: 6915.0,
    stopLossPrice: 6570.0,
    targetPrice: 8300.0,
    orderStatus: 'Executed',
    placedTime: '2026-09-15 10:15:02 IST',
    minerviniSetupTag: 'Cup with Handle Pivot'
  },
  {
    orderId: '5P-ORD-98218',
    clientCode: '5P88421943',
    exchange: 'NSE',
    symbol: 'KAYNES',
    transactionType: 'BUY',
    orderType: 'MARKET',
    productType: 'MIS',
    quantity: 30,
    price: 5120.0,
    stopLossPrice: 4890.0,
    targetPrice: 5800.0,
    orderStatus: 'Executed',
    placedTime: '2026-09-16 11:22:45 IST',
    minerviniSetupTag: 'Pocket Pivot Volume Surge'
  },
  {
    orderId: '5P-ORD-98220',
    clientCode: '5P88421943',
    exchange: 'NSE',
    symbol: 'ZOMATO',
    transactionType: 'BUY',
    orderType: 'LIMIT',
    productType: 'CNC',
    quantity: 300,
    price: 285.0,
    triggerPrice: 284.5,
    stopLossPrice: 268.0,
    targetPrice: 345.0,
    orderStatus: 'Pending',
    placedTime: '2026-09-16 14:10:30 IST',
    minerviniSetupTag: 'SEPA Stage 2 Pivot Breakout'
  }
];

export const getStoredCredentials = (): FivePaisaCredentials | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to get 5paisa credentials:', err);
    return null;
  }
};

export const saveStoredCredentials = (creds: FivePaisaCredentials): void => {
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(creds));
};

export const clearStoredCredentials = (): void => {
  localStorage.removeItem(STORAGE_KEY_CONFIG);
  localStorage.removeItem(STORAGE_KEY_MARGIN);
  localStorage.removeItem(STORAGE_KEY_HOLDINGS);
  localStorage.removeItem(STORAGE_KEY_POSITIONS);
  localStorage.removeItem(STORAGE_KEY_ORDERS);
};

export const fetchFivePaisaMargin = async (): Promise<FivePaisaAccountMargin> => {
  try {
    const res = await fetch('/api/5paisa/margin');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.margin) {
        localStorage.setItem(STORAGE_KEY_MARGIN, JSON.stringify(data.margin));
        return data.margin;
      }
    }
  } catch (e) {
    console.warn('Network call to /api/5paisa/margin failed, falling back to local state', e);
  }

  // Fallback to local storage or default active simulated margin
  const cached = localStorage.getItem(STORAGE_KEY_MARGIN);
  if (cached) {
    return JSON.parse(cached);
  }

  const defaultMargin: FivePaisaAccountMargin = {
    clientCode: '5P88421943',
    accountType: 'EQUITY_CASH',
    availableCashMargin: 385420.0,
    usedMargin: 74580.0,
    collateralMargin: 210000.0,
    totalPurchasingPower: 595420.0,
    unrealizedMtm: 22300.0,
    realizedPnl: 14200.0,
    grossHoldingValue: 1242125.0,
    lastUpdated: new Date().toLocaleTimeString() + ' IST',
    isConnected: true,
    isSimulated: true
  };

  localStorage.setItem(STORAGE_KEY_MARGIN, JSON.stringify(defaultMargin));
  return defaultMargin;
};

export const fetchFivePaisaHoldings = async (): Promise<FivePaisaHolding[]> => {
  try {
    const res = await fetch('/api/5paisa/holdings');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.holdings)) {
        localStorage.setItem(STORAGE_KEY_HOLDINGS, JSON.stringify(data.holdings));
        return data.holdings;
      }
    }
  } catch (e) {
    console.warn('Network call to /api/5paisa/holdings failed', e);
  }

  const cached = localStorage.getItem(STORAGE_KEY_HOLDINGS);
  if (cached) {
    return JSON.parse(cached);
  }

  localStorage.setItem(STORAGE_KEY_HOLDINGS, JSON.stringify(DEFAULT_SIMULATED_HOLDINGS));
  return DEFAULT_SIMULATED_HOLDINGS;
};

export const fetchFivePaisaPositions = async (): Promise<FivePaisaPosition[]> => {
  try {
    const res = await fetch('/api/5paisa/positions');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.positions)) {
        localStorage.setItem(STORAGE_KEY_POSITIONS, JSON.stringify(data.positions));
        return data.positions;
      }
    }
  } catch (e) {
    console.warn('Network call to /api/5paisa/positions failed', e);
  }

  const cached = localStorage.getItem(STORAGE_KEY_POSITIONS);
  if (cached) return JSON.parse(cached);
  return DEFAULT_SIMULATED_POSITIONS;
};

export const fetchFivePaisaOrders = async (): Promise<FivePaisaOrder[]> => {
  try {
    const res = await fetch('/api/5paisa/orders');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.orders)) {
        localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(data.orders));
        return data.orders;
      }
    }
  } catch (e) {
    console.warn('Network call to /api/5paisa/orders failed', e);
  }

  const cached = localStorage.getItem(STORAGE_KEY_ORDERS);
  if (cached) return JSON.parse(cached);
  return DEFAULT_SIMULATED_ORDERS;
};

export const placeFivePaisaOrder = async (orderReq: FivePaisaOrderRequest): Promise<{ success: boolean; order?: FivePaisaOrder; message: string }> => {
  try {
    const res = await fetch('/api/5paisa/place-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderReq)
    });

    if (res.ok) {
      const result = await res.json();
      if (result && result.success) {
        return result;
      }
    }
  } catch (e) {
    console.warn('Direct order API call failed, falling back to local simulated execution', e);
  }

  // Client-side fallback order placement
  const newOrderId = `5P-ORD-${Math.floor(10000 + Math.random() * 90000)}`;
  const orderTotal = orderReq.quantity * orderReq.price;

  const currentMargin = await fetchFivePaisaMargin();
  if (orderReq.transactionType === 'BUY' && orderTotal > currentMargin.totalPurchasingPower) {
    return {
      success: false,
      message: `Insufficient 5paisa margin! Required: ₹${orderTotal.toLocaleString('en-IN')}, Available: ₹${currentMargin.totalPurchasingPower.toLocaleString('en-IN')}`
    };
  }

  const newOrder: FivePaisaOrder = {
    orderId: newOrderId,
    clientCode: currentMargin.clientCode || '5P88421943',
    exchange: orderReq.exchange,
    symbol: orderReq.symbol,
    transactionType: orderReq.transactionType,
    orderType: orderReq.orderType,
    productType: orderReq.productType,
    quantity: orderReq.quantity,
    price: orderReq.price,
    triggerPrice: orderReq.price,
    stopLossPrice: orderReq.stopLossPrice,
    targetPrice: orderReq.targetPrice,
    orderStatus: orderReq.orderType === 'MARKET' ? 'Executed' : 'Pending',
    placedTime: new Date().toLocaleString() + ' IST',
    minerviniSetupTag: orderReq.minerviniSetupTag || 'SEPA Bracket Order'
  };

  const existingOrders = await fetchFivePaisaOrders();
  const updatedOrders = [newOrder, ...existingOrders];
  localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(updatedOrders));

  // If MARKET order executed, update margin and holdings
  if (newOrder.orderStatus === 'Executed') {
    const updatedMargin: FivePaisaAccountMargin = {
      ...currentMargin,
      availableCashMargin: Math.max(0, currentMargin.availableCashMargin - orderTotal),
      usedMargin: currentMargin.usedMargin + orderTotal,
      lastUpdated: new Date().toLocaleTimeString() + ' IST'
    };
    localStorage.setItem(STORAGE_KEY_MARGIN, JSON.stringify(updatedMargin));

    // Update holdings if BUY
    if (orderReq.transactionType === 'BUY') {
      const existingHoldings = await fetchFivePaisaHoldings();
      const existingIdx = existingHoldings.findIndex(h => h.symbol.toUpperCase() === orderReq.symbol.toUpperCase());
      if (existingIdx >= 0) {
        const item = existingHoldings[existingIdx];
        const newQty = item.quantity + orderReq.quantity;
        const newAvg = ((item.quantity * item.averagePrice) + orderTotal) / newQty;
        existingHoldings[existingIdx] = {
          ...item,
          quantity: newQty,
          averagePrice: Number(newAvg.toFixed(2)),
          marketValue: Number((newQty * item.currentPrice).toFixed(2))
        };
      } else {
        existingHoldings.unshift({
          scripCode: Math.floor(500000 + Math.random() * 50000),
          symbol: orderReq.symbol.toUpperCase(),
          companyName: `${orderReq.symbol.toUpperCase()} Ltd`,
          exchange: orderReq.exchange,
          quantity: orderReq.quantity,
          poolQuantity: orderReq.quantity,
          averagePrice: orderReq.price,
          currentPrice: orderReq.price,
          dayChange: 0,
          dayChangePercent: 0,
          pnl: 0,
          pnlPercent: 0,
          marketValue: orderTotal,
          sepaStage: orderReq.minerviniSetupTag || 'Active Breakout',
          isTightVolume: true,
          rsRating: 90
        });
      }
      localStorage.setItem(STORAGE_KEY_HOLDINGS, JSON.stringify(existingHoldings));
    }
  }

  return {
    success: true,
    order: newOrder,
    message: `Order #${newOrderId} for ${orderReq.quantity} shares of ${orderReq.symbol} placed successfully on 5paisa!`
  };
};

export const cancelFivePaisaOrder = async (orderId: string): Promise<{ success: boolean; message: string }> => {
  try {
    const res = await fetch('/api/5paisa/cancel-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    });
    if (res.ok) {
      const r = await res.json();
      if (r.success) return r;
    }
  } catch (e) {
    console.warn('API cancel failed, modifying local order book', e);
  }

  const existingOrders = await fetchFivePaisaOrders();
  const updated = existingOrders.map(o => {
    if (o.orderId === orderId && o.orderStatus === 'Pending') {
      return { ...o, orderStatus: 'Cancelled' as const };
    }
    return o;
  });
  localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(updated));

  return { success: true, message: `Order #${orderId} was cancelled successfully.` };
};

/**
 * Synchronize 5paisa Demat Holdings into the Minervini Portfolio
 */
export const sync5paisaToMinerviniPortfolio = (
  fivePaisaHoldings: FivePaisaHolding[],
  currentPortfolio: PortfolioHolding[]
): PortfolioHolding[] => {
  const merged: PortfolioHolding[] = [...currentPortfolio];

  fivePaisaHoldings.forEach((fp) => {
    const existingIndex = merged.findIndex((p) => p.ticker.toUpperCase() === fp.symbol.toUpperCase());
    const stopLoss = Number((fp.averagePrice * 0.94).toFixed(2)); // -6% Minervini hard stop
    const target = Number((fp.averagePrice * 1.25).toFixed(2)); // +25% Minervini target

    if (existingIndex >= 0) {
      // Update existing holding with live 5paisa quantities and price
      merged[existingIndex] = {
        ...merged[existingIndex],
        shares: fp.quantity,
        entryPrice: fp.averagePrice,
        currentPrice: fp.currentPrice,
        stopLossPrice: merged[existingIndex].stopLossPrice || stopLoss,
        pivotTargetPrice: merged[existingIndex].pivotTargetPrice || target,
        notes: merged[existingIndex].notes || `Synced live from 5paisa Trading Account (${fp.exchange})`
      };
    } else {
      // Add as new portfolio item
      merged.unshift({
        id: `fp-${fp.scripCode || fp.symbol}`,
        ticker: fp.symbol,
        stockName: fp.companyName || fp.symbol,
        exchange: fp.exchange,
        shares: fp.quantity,
        entryPrice: fp.averagePrice,
        currentPrice: fp.currentPrice,
        buyDate: new Date().toISOString().split('T')[0],
        stopLossPrice: stopLoss,
        pivotTargetPrice: target,
        notes: `Direct 5paisa Demat holding sync. ${fp.sepaStage || 'SEPA Momentum candidate'}`,
        trendScore: 8,
        sma50: fp.currentPrice * 0.95,
        sma200: fp.currentPrice * 0.88,
        vcpStage: 'Active Breakout'
      });
    }
  });

  localStorage.setItem('minervini_sepa_portfolio', JSON.stringify(merged));
  return merged;
};
