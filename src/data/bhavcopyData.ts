import { BhavcopyRecord, BhavcopyMarketSummary, BhavcopyExchange } from '../types';

export const LATEST_TRADING_DATE = '2026-09-02';
export const PREVIOUS_TRADING_DATE = '2026-09-01';

// Comprehensive default NSE Bhavcopy Dataset (National Stock Exchange of India)
export const DEFAULT_NSE_BHAVCOPY: BhavcopyRecord[] = [
  {
    symbol: 'TRENT',
    name: 'Trent Limited',
    exchange: 'NSE',
    series: 'EQ',
    isin: 'INE849A01020',
    open: 6620.00,
    high: 6890.00,
    low: 6605.00,
    close: 6840.50,
    lastPrice: 6845.00,
    prevClose: 6586.90,
    change: 253.60,
    changePercent: 3.85,
    totalTradedQty: 1845200,
    totalTradedVal: 12513456000, // ~1251 Cr
    totalTrades: 142850,
    deliveryQty: 1180900,
    deliveryPercent: 64.00,
    high52w: 6950.00,
    low52w: 2400.00,
    distanceFrom52wHighPercent: -1.58,
    avgVolume20d: 1200000,
    volumeSurgeRatio: 1.54,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 10.0,
    sepaStage: 'Stage 2 (Breakout)',
    rsRating: 99,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Consumer Cyclical',
    industry: 'Apparel Retail'
  },
  {
    symbol: 'SUVEN',
    name: 'Suven Life Sciences Ltd',
    exchange: 'NSE',
    series: 'EQ',
    isin: 'INE495B01038',
    open: 298.50,
    high: 327.60,
    low: 297.00,
    close: 327.60,
    lastPrice: 327.60,
    prevClose: 297.95,
    change: 29.65,
    changePercent: 9.95,
    totalTradedQty: 10664300,
    totalTradedVal: 3358580000,
    totalTrades: 89400,
    deliveryQty: 6291900,
    deliveryPercent: 59.00,
    high52w: 335.00,
    low52w: 112.00,
    distanceFrom52wHighPercent: -2.21,
    avgVolume20d: 3800000,
    volumeSurgeRatio: 2.81,
    isCircuitHit: 'UPPER',
    circuitLimitPercent: 10.0,
    sepaStage: 'Stage 2 (Breakout)',
    rsRating: 94,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Healthcare',
    industry: 'Pharmaceuticals'
  },
  {
    symbol: 'MOSCHIP',
    name: 'Moschip Technologies Ltd',
    exchange: 'NSE',
    series: 'EQ',
    isin: 'INE935B01019',
    open: 210.00,
    high: 226.50,
    low: 208.50,
    close: 223.55,
    lastPrice: 223.80,
    prevClose: 208.50,
    change: 15.05,
    changePercent: 7.21,
    totalTradedQty: 4890200,
    totalTradedVal: 1075840000,
    totalTrades: 48300,
    deliveryQty: 3031900,
    deliveryPercent: 62.00,
    high52w: 232.00,
    low52w: 82.00,
    distanceFrom52wHighPercent: -3.64,
    avgVolume20d: 5200000,
    volumeSurgeRatio: 0.94,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 20.0,
    sepaStage: 'Stage 2 (Contraction)',
    rsRating: 91,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Technology',
    industry: 'Semiconductor Design'
  },
  {
    symbol: 'GOLDIAM',
    name: 'Goldiam International Ltd',
    exchange: 'NSE',
    series: 'EQ',
    isin: 'INE025B01017',
    open: 452.00,
    high: 485.00,
    low: 450.10,
    close: 480.40,
    lastPrice: 481.00,
    prevClose: 449.95,
    change: 30.45,
    changePercent: 6.77,
    totalTradedQty: 1890000,
    totalTradedVal: 893970000,
    totalTrades: 26400,
    deliveryQty: 1077300,
    deliveryPercent: 57.00,
    high52w: 488.00,
    low52w: 165.00,
    distanceFrom52wHighPercent: -1.56,
    avgVolume20d: 1100000,
    volumeSurgeRatio: 1.72,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 20.0,
    sepaStage: 'Stage 2 (Breakout)',
    rsRating: 92,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Consumer Cyclical',
    industry: 'Luxury Goods'
  },
  {
    symbol: 'DIXON',
    name: 'Dixon Technologies (India) Ltd',
    exchange: 'NSE',
    series: 'EQ',
    isin: 'INE935N01020',
    open: 11400.00,
    high: 11980.00,
    low: 11380.00,
    close: 11840.00,
    lastPrice: 11850.00,
    prevClose: 11340.00,
    change: 500.00,
    changePercent: 4.41,
    totalTradedQty: 840500,
    totalTradedVal: 9875000000,
    totalTrades: 76500,
    deliveryQty: 521100,
    deliveryPercent: 62.00,
    high52w: 12100.00,
    low52w: 4850.00,
    distanceFrom52wHighPercent: -2.15,
    avgVolume20d: 580000,
    volumeSurgeRatio: 1.45,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 10.0,
    sepaStage: 'Stage 2 (Breakout)',
    rsRating: 96,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Technology',
    industry: 'EMS & Electronics'
  },
  {
    symbol: 'BEL',
    name: 'Bharat Electronics Ltd',
    exchange: 'NSE',
    series: 'EQ',
    isin: 'INE263A01024',
    open: 295.00,
    high: 308.90,
    low: 294.20,
    close: 305.40,
    lastPrice: 305.60,
    prevClose: 294.80,
    change: 10.60,
    changePercent: 3.60,
    totalTradedQty: 24500000,
    totalTradedVal: 7420000000,
    totalTrades: 198000,
    deliveryQty: 13965000,
    deliveryPercent: 57.00,
    high52w: 323.00,
    low52w: 128.00,
    distanceFrom52wHighPercent: -5.45,
    avgVolume20d: 19500000,
    volumeSurgeRatio: 1.26,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 10.0,
    sepaStage: 'Stage 2 (Contraction)',
    rsRating: 90,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Industrials',
    industry: 'Defense & Aerospace'
  },
  {
    symbol: 'HAL',
    name: 'Hindustan Aeronautics Ltd',
    exchange: 'NSE',
    series: 'EQ',
    isin: 'INE066F01020',
    open: 4780.00,
    high: 4995.00,
    low: 4760.00,
    close: 4945.00,
    lastPrice: 4950.00,
    prevClose: 4755.00,
    change: 190.00,
    changePercent: 4.00,
    totalTradedQty: 3200000,
    totalTradedVal: 15680000000,
    totalTrades: 145000,
    deliveryQty: 1760000,
    deliveryPercent: 55.00,
    high52w: 5675.00,
    low52w: 1880.00,
    distanceFrom52wHighPercent: -12.86,
    avgVolume20d: 2600000,
    volumeSurgeRatio: 1.23,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 10.0,
    sepaStage: 'Stage 2 (Contraction)',
    rsRating: 89,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Industrials',
    industry: 'Defense & Aerospace'
  },
  {
    symbol: 'KAYNES',
    name: 'Kaynes Technology India Ltd',
    exchange: 'NSE',
    series: 'EQ',
    isin: 'INE918Z01012',
    open: 4250.00,
    high: 4580.00,
    low: 4230.00,
    close: 4520.00,
    lastPrice: 4525.00,
    prevClose: 4220.00,
    change: 300.00,
    changePercent: 7.11,
    totalTradedQty: 1420000,
    totalTradedVal: 6319000000,
    totalTrades: 64200,
    deliveryQty: 866200,
    deliveryPercent: 61.00,
    high52w: 4620.00,
    low52w: 1750.00,
    distanceFrom52wHighPercent: -2.16,
    avgVolume20d: 780000,
    volumeSurgeRatio: 1.82,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 20.0,
    sepaStage: 'Stage 2 (Breakout)',
    rsRating: 97,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Technology',
    industry: 'Electronic Components'
  },
  {
    symbol: 'POLYCAB',
    name: 'Polycab India Ltd',
    exchange: 'NSE',
    series: 'EQ',
    isin: 'INE455K01017',
    open: 6850.00,
    high: 7120.00,
    low: 6840.00,
    close: 7065.00,
    lastPrice: 7070.00,
    prevClose: 6810.00,
    change: 255.00,
    changePercent: 3.74,
    totalTradedQty: 790000,
    totalTradedVal: 5520000000,
    totalTrades: 43200,
    deliveryQty: 489800,
    deliveryPercent: 62.00,
    high52w: 7280.00,
    low52w: 3820.00,
    distanceFrom52wHighPercent: -2.95,
    avgVolume20d: 610000,
    volumeSurgeRatio: 1.30,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 10.0,
    sepaStage: 'Stage 2 (Contraction)',
    rsRating: 93,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Industrials',
    industry: 'Electrical Equipment'
  },
  {
    symbol: 'SOLARINDS',
    name: 'Solar Industries India Ltd',
    exchange: 'NSE',
    series: 'EQ',
    isin: 'INE343H01029',
    open: 10800.00,
    high: 11450.00,
    low: 10750.00,
    close: 11320.00,
    lastPrice: 11330.00,
    prevClose: 10720.00,
    change: 600.00,
    changePercent: 5.60,
    totalTradedQty: 295000,
    totalTradedVal: 3290000000,
    totalTrades: 28900,
    deliveryQty: 182900,
    deliveryPercent: 62.00,
    high52w: 11600.00,
    low52w: 3950.00,
    distanceFrom52wHighPercent: -2.41,
    avgVolume20d: 185000,
    volumeSurgeRatio: 1.59,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 10.0,
    sepaStage: 'Stage 2 (Breakout)',
    rsRating: 95,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Materials',
    industry: 'Explosives & Chemicals'
  },
  {
    symbol: 'CDSL',
    name: 'Central Depository Services (India) Ltd',
    exchange: 'NSE',
    series: 'EQ',
    isin: 'INE736A01011',
    open: 1480.00,
    high: 1560.00,
    low: 1475.00,
    close: 1545.00,
    lastPrice: 1548.00,
    prevClose: 1470.00,
    change: 75.00,
    changePercent: 5.10,
    totalTradedQty: 4850000,
    totalTradedVal: 7420000000,
    totalTrades: 112000,
    deliveryQty: 2958500,
    deliveryPercent: 61.00,
    high52w: 1620.00,
    low52w: 680.00,
    distanceFrom52wHighPercent: -4.63,
    avgVolume20d: 3100000,
    volumeSurgeRatio: 1.56,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 20.0,
    sepaStage: 'Stage 2 (Breakout)',
    rsRating: 94,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Financial Services',
    industry: 'Capital Markets'
  },
  {
    symbol: 'ANGELONE',
    name: 'Angel One Ltd',
    exchange: 'NSE',
    series: 'EQ',
    isin: 'INE732I01013',
    open: 2680.00,
    high: 2840.00,
    low: 2670.00,
    close: 2815.00,
    lastPrice: 2818.00,
    prevClose: 2665.00,
    change: 150.00,
    changePercent: 5.63,
    totalTradedQty: 2200000,
    totalTradedVal: 6100000000,
    totalTrades: 58000,
    deliveryQty: 1254000,
    deliveryPercent: 57.00,
    high52w: 3900.00,
    low52w: 1520.00,
    distanceFrom52wHighPercent: -27.82,
    avgVolume20d: 1450000,
    volumeSurgeRatio: 1.52,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 20.0,
    sepaStage: 'Stage 1 (Base)',
    rsRating: 82,
    isMinerviniCandidate: false,
    date: LATEST_TRADING_DATE,
    sector: 'Financial Services',
    industry: 'Fintech Brokerage'
  },
  {
    symbol: 'BSE',
    name: 'BSE Limited',
    exchange: 'NSE',
    series: 'EQ',
    isin: 'INE118H01025',
    open: 2780.00,
    high: 2990.00,
    low: 2765.00,
    close: 2950.00,
    lastPrice: 2955.00,
    prevClose: 2750.00,
    change: 200.00,
    changePercent: 7.27,
    totalTradedQty: 5400000,
    totalTradedVal: 15600000000,
    totalTrades: 135000,
    deliveryQty: 3132000,
    deliveryPercent: 58.00,
    high52w: 3260.00,
    low52w: 690.00,
    distanceFrom52wHighPercent: -9.51,
    avgVolume20d: 3600000,
    volumeSurgeRatio: 1.50,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 20.0,
    sepaStage: 'Stage 2 (Breakout)',
    rsRating: 98,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Financial Services',
    industry: 'Stock Exchange'
  },
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd',
    exchange: 'NSE',
    series: 'EQ',
    isin: 'INE002A01018',
    open: 2980.00,
    high: 3045.00,
    low: 2975.00,
    close: 3028.00,
    lastPrice: 3030.00,
    prevClose: 2972.50,
    change: 55.50,
    changePercent: 1.87,
    totalTradedQty: 6850000,
    totalTradedVal: 20680000000,
    totalTrades: 215000,
    deliveryQty: 4178500,
    deliveryPercent: 61.00,
    high52w: 3217.00,
    low52w: 2220.00,
    distanceFrom52wHighPercent: -5.87,
    avgVolume20d: 6200000,
    volumeSurgeRatio: 1.10,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 10.0,
    sepaStage: 'Stage 2 (Contraction)',
    rsRating: 85,
    isMinerviniCandidate: false,
    date: LATEST_TRADING_DATE,
    sector: 'Energy',
    industry: 'Oil & Gas / Conglomerate'
  },
  {
    symbol: 'TCS',
    name: 'Tata Consultancy Services Ltd',
    exchange: 'NSE',
    series: 'EQ',
    isin: 'INE467B01029',
    open: 4250.00,
    high: 4340.00,
    low: 4240.00,
    close: 4310.00,
    lastPrice: 4312.00,
    prevClose: 4235.00,
    change: 75.00,
    changePercent: 1.77,
    totalTradedQty: 1850000,
    totalTradedVal: 7950000000,
    totalTrades: 92000,
    deliveryQty: 1221000,
    deliveryPercent: 66.00,
    high52w: 4590.00,
    low52w: 3310.00,
    distanceFrom52wHighPercent: -6.10,
    avgVolume20d: 1950000,
    volumeSurgeRatio: 0.95,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 10.0,
    sepaStage: 'Stage 2 (Contraction)',
    rsRating: 84,
    isMinerviniCandidate: false,
    date: LATEST_TRADING_DATE,
    sector: 'Technology',
    industry: 'IT Services'
  },
  {
    symbol: 'INFY',
    name: 'Infosys Limited',
    exchange: 'NSE',
    series: 'EQ',
    isin: 'INE009A01021',
    open: 1820.00,
    high: 1865.00,
    low: 1815.00,
    close: 1852.00,
    lastPrice: 1854.00,
    prevClose: 1818.00,
    change: 34.00,
    changePercent: 1.87,
    totalTradedQty: 5400000,
    totalTradedVal: 9940000000,
    totalTrades: 128000,
    deliveryQty: 3564000,
    deliveryPercent: 66.00,
    high52w: 1950.00,
    low52w: 1355.00,
    distanceFrom52wHighPercent: -5.03,
    avgVolume20d: 6100000,
    volumeSurgeRatio: 0.89,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 10.0,
    sepaStage: 'Stage 2 (Contraction)',
    rsRating: 83,
    isMinerviniCandidate: false,
    date: LATEST_TRADING_DATE,
    sector: 'Technology',
    industry: 'IT Services'
  },
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd',
    exchange: 'NSE',
    series: 'EQ',
    isin: 'INE040A01034',
    open: 1640.00,
    high: 1675.00,
    low: 1638.00,
    close: 1668.00,
    lastPrice: 1670.00,
    prevClose: 1635.00,
    change: 33.00,
    changePercent: 2.02,
    totalTradedQty: 14500000,
    totalTradedVal: 24100000000,
    totalTrades: 245000,
    deliveryQty: 9715000,
    deliveryPercent: 67.00,
    high52w: 1790.00,
    low52w: 1363.00,
    distanceFrom52wHighPercent: -6.82,
    avgVolume20d: 16200000,
    volumeSurgeRatio: 0.90,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 10.0,
    sepaStage: 'Stage 1 (Base)',
    rsRating: 78,
    isMinerviniCandidate: false,
    date: LATEST_TRADING_DATE,
    sector: 'Financial Services',
    industry: 'Private Banks'
  },
  {
    symbol: 'MAZDOCK',
    name: 'Mazagon Dock Shipbuilders Ltd',
    exchange: 'NSE',
    series: 'EQ',
    isin: 'INE249Z01012',
    open: 4850.00,
    high: 5240.00,
    low: 4820.00,
    close: 5180.00,
    lastPrice: 5190.00,
    prevClose: 4810.00,
    change: 370.00,
    changePercent: 7.69,
    totalTradedQty: 3850000,
    totalTradedVal: 19635000000,
    totalTrades: 172000,
    deliveryQty: 2233000,
    deliveryPercent: 58.00,
    high52w: 5860.00,
    low52w: 1750.00,
    distanceFrom52wHighPercent: -11.60,
    avgVolume20d: 2900000,
    volumeSurgeRatio: 1.33,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 20.0,
    sepaStage: 'Stage 2 (Breakout)',
    rsRating: 98,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Industrials',
    industry: 'Shipbuilding & Defense'
  }
];

// Comprehensive default BSE Bhavcopy Dataset (Bombay Stock Exchange)
export const DEFAULT_BSE_BHAVCOPY: BhavcopyRecord[] = [
  {
    symbol: 'TRENT',
    scripCode: '500251',
    name: 'Trent Limited',
    exchange: 'BSE',
    series: 'A', // BSE Group A
    isin: 'INE849A01020',
    open: 6625.00,
    high: 6890.00,
    low: 6610.00,
    close: 6840.50,
    lastPrice: 6842.00,
    prevClose: 6586.90,
    change: 253.60,
    changePercent: 3.85,
    totalTradedQty: 245000,
    totalTradedVal: 1656000000,
    totalTrades: 28400,
    deliveryQty: 164150,
    deliveryPercent: 67.00,
    high52w: 6950.00,
    low52w: 2400.00,
    distanceFrom52wHighPercent: -1.58,
    avgVolume20d: 195000,
    volumeSurgeRatio: 1.26,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 10.0,
    sepaStage: 'Stage 2 (Breakout)',
    rsRating: 99,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Consumer Cyclical',
    industry: 'Apparel Retail'
  },
  {
    symbol: 'SUVEN',
    scripCode: '532828',
    name: 'Suven Life Sciences Ltd',
    exchange: 'BSE',
    series: 'B', // BSE Group B
    isin: 'INE495B01038',
    open: 299.00,
    high: 327.60,
    low: 298.00,
    close: 327.60,
    lastPrice: 327.60,
    prevClose: 297.95,
    change: 29.65,
    changePercent: 9.95,
    totalTradedQty: 1850000,
    totalTradedVal: 586450000,
    totalTrades: 19200,
    deliveryQty: 1147000,
    deliveryPercent: 62.00,
    high52w: 335.00,
    low52w: 112.00,
    distanceFrom52wHighPercent: -2.21,
    avgVolume20d: 650000,
    volumeSurgeRatio: 2.85,
    isCircuitHit: 'UPPER',
    circuitLimitPercent: 10.0,
    sepaStage: 'Stage 2 (Breakout)',
    rsRating: 94,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Healthcare',
    industry: 'Pharmaceuticals'
  },
  {
    symbol: 'MOSCHIP',
    scripCode: '532407',
    name: 'Moschip Technologies Ltd',
    exchange: 'BSE',
    series: 'B',
    isin: 'INE935B01019',
    open: 211.00,
    high: 226.40,
    low: 209.00,
    close: 223.55,
    lastPrice: 223.55,
    prevClose: 208.50,
    change: 15.05,
    changePercent: 7.21,
    totalTradedQty: 920000,
    totalTradedVal: 202400000,
    totalTrades: 12400,
    deliveryQty: 598000,
    deliveryPercent: 65.00,
    high52w: 232.00,
    low52w: 82.00,
    distanceFrom52wHighPercent: -3.64,
    avgVolume20d: 890000,
    volumeSurgeRatio: 1.03,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 20.0,
    sepaStage: 'Stage 2 (Contraction)',
    rsRating: 91,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Technology',
    industry: 'Semiconductor Design'
  },
  {
    symbol: 'GOLDIAM',
    scripCode: '526729',
    name: 'Goldiam International Ltd',
    exchange: 'BSE',
    series: 'B',
    isin: 'INE025B01017',
    open: 455.00,
    high: 484.50,
    low: 451.00,
    close: 480.40,
    lastPrice: 480.50,
    prevClose: 449.95,
    change: 30.45,
    changePercent: 6.77,
    totalTradedQty: 340000,
    totalTradedVal: 160480000,
    totalTrades: 5800,
    deliveryQty: 210800,
    deliveryPercent: 62.00,
    high52w: 488.00,
    low52w: 165.00,
    distanceFrom52wHighPercent: -1.56,
    avgVolume20d: 210000,
    volumeSurgeRatio: 1.62,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 20.0,
    sepaStage: 'Stage 2 (Breakout)',
    rsRating: 92,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Consumer Cyclical',
    industry: 'Luxury Goods'
  },
  {
    symbol: 'DIXON',
    scripCode: '540699',
    name: 'Dixon Technologies (India) Ltd',
    exchange: 'BSE',
    series: 'A',
    isin: 'INE935N01020',
    open: 11420.00,
    high: 11975.00,
    low: 11390.00,
    close: 11840.00,
    lastPrice: 11845.00,
    prevClose: 11340.00,
    change: 500.00,
    changePercent: 4.41,
    totalTradedQty: 125000,
    totalTradedVal: 1468750000,
    totalTrades: 16400,
    deliveryQty: 81250,
    deliveryPercent: 65.00,
    high52w: 12100.00,
    low52w: 4850.00,
    distanceFrom52wHighPercent: -2.15,
    avgVolume20d: 95000,
    volumeSurgeRatio: 1.32,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 10.0,
    sepaStage: 'Stage 2 (Breakout)',
    rsRating: 96,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Technology',
    industry: 'EMS & Electronics'
  },
  {
    symbol: 'BEL',
    scripCode: '500049',
    name: 'Bharat Electronics Ltd',
    exchange: 'BSE',
    series: 'A',
    isin: 'INE263A01024',
    open: 295.50,
    high: 308.80,
    low: 294.50,
    close: 305.40,
    lastPrice: 305.50,
    prevClose: 294.80,
    change: 10.60,
    changePercent: 3.60,
    totalTradedQty: 3200000,
    totalTradedVal: 969600000,
    totalTrades: 34500,
    deliveryQty: 1984000,
    deliveryPercent: 62.00,
    high52w: 323.00,
    low52w: 128.00,
    distanceFrom52wHighPercent: -5.45,
    avgVolume20d: 2800000,
    volumeSurgeRatio: 1.14,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 10.0,
    sepaStage: 'Stage 2 (Contraction)',
    rsRating: 90,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Industrials',
    industry: 'Defense & Aerospace'
  },
  {
    symbol: 'HAL',
    scripCode: '541154',
    name: 'Hindustan Aeronautics Ltd',
    exchange: 'BSE',
    series: 'A',
    isin: 'INE066F01020',
    open: 4785.00,
    high: 4990.00,
    low: 4765.00,
    close: 4945.00,
    lastPrice: 4948.00,
    prevClose: 4755.00,
    change: 190.00,
    changePercent: 4.00,
    totalTradedQty: 480000,
    totalTradedVal: 2352000000,
    totalTrades: 26800,
    deliveryQty: 283200,
    deliveryPercent: 59.00,
    high52w: 5675.00,
    low52w: 1880.00,
    distanceFrom52wHighPercent: -12.86,
    avgVolume20d: 410000,
    volumeSurgeRatio: 1.17,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 10.0,
    sepaStage: 'Stage 2 (Contraction)',
    rsRating: 89,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Industrials',
    industry: 'Defense & Aerospace'
  },
  {
    symbol: 'KAYNES',
    scripCode: '543664',
    name: 'Kaynes Technology India Ltd',
    exchange: 'BSE',
    series: 'B',
    isin: 'INE918Z01012',
    open: 4255.00,
    high: 4580.00,
    low: 4235.00,
    close: 4520.00,
    lastPrice: 4522.00,
    prevClose: 4220.00,
    change: 300.00,
    changePercent: 7.11,
    totalTradedQty: 215000,
    totalTradedVal: 956750000,
    totalTrades: 12100,
    deliveryQty: 139750,
    deliveryPercent: 65.00,
    high52w: 4620.00,
    low52w: 1750.00,
    distanceFrom52wHighPercent: -2.16,
    avgVolume20d: 130000,
    volumeSurgeRatio: 1.65,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 20.0,
    sepaStage: 'Stage 2 (Breakout)',
    rsRating: 97,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Technology',
    industry: 'Electronic Components'
  },
  {
    symbol: 'BSE',
    scripCode: '540743',
    name: 'BSE Limited (Parent Scrip)',
    exchange: 'BSE',
    series: 'A',
    isin: 'INE118H01025',
    open: 2785.00,
    high: 2990.00,
    low: 2770.00,
    close: 2950.00,
    lastPrice: 2952.00,
    prevClose: 2750.00,
    change: 200.00,
    changePercent: 7.27,
    totalTradedQty: 890000,
    totalTradedVal: 2572100000,
    totalTrades: 31200,
    deliveryQty: 569600,
    deliveryPercent: 64.00,
    high52w: 3260.00,
    low52w: 690.00,
    distanceFrom52wHighPercent: -9.51,
    avgVolume20d: 620000,
    volumeSurgeRatio: 1.44,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 20.0,
    sepaStage: 'Stage 2 (Breakout)',
    rsRating: 98,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Financial Services',
    industry: 'Stock Exchange'
  },
  {
    symbol: 'CDSL',
    scripCode: '540526',
    name: 'Central Depository Services Ltd',
    exchange: 'BSE',
    series: 'A',
    isin: 'INE736A01011',
    open: 1485.00,
    high: 1560.00,
    low: 1478.00,
    close: 1545.00,
    lastPrice: 1545.00,
    prevClose: 1470.00,
    change: 75.00,
    changePercent: 5.10,
    totalTradedQty: 740000,
    totalTradedVal: 1132200000,
    totalTrades: 21800,
    deliveryQty: 481000,
    deliveryPercent: 65.00,
    high52w: 1620.00,
    low52w: 680.00,
    distanceFrom52wHighPercent: -4.63,
    avgVolume20d: 520000,
    volumeSurgeRatio: 1.42,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 20.0,
    sepaStage: 'Stage 2 (Breakout)',
    rsRating: 94,
    isMinerviniCandidate: true,
    date: LATEST_TRADING_DATE,
    sector: 'Financial Services',
    industry: 'Capital Markets'
  },
  {
    symbol: 'RELIANCE',
    scripCode: '500325',
    name: 'Reliance Industries Ltd',
    exchange: 'BSE',
    series: 'A',
    isin: 'INE002A01018',
    open: 2985.00,
    high: 3045.00,
    low: 2978.00,
    close: 3028.00,
    lastPrice: 3029.00,
    prevClose: 2972.50,
    change: 55.50,
    changePercent: 1.87,
    totalTradedQty: 890000,
    totalTradedVal: 2687800000,
    totalTrades: 39500,
    deliveryQty: 605200,
    deliveryPercent: 68.00,
    high52w: 3217.00,
    low52w: 2220.00,
    distanceFrom52wHighPercent: -5.87,
    avgVolume20d: 820000,
    volumeSurgeRatio: 1.09,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 10.0,
    sepaStage: 'Stage 2 (Contraction)',
    rsRating: 85,
    isMinerviniCandidate: false,
    date: LATEST_TRADING_DATE,
    sector: 'Energy',
    industry: 'Oil & Gas'
  },
  {
    symbol: 'TCS',
    scripCode: '532540',
    name: 'Tata Consultancy Services Ltd',
    exchange: 'BSE',
    series: 'A',
    isin: 'INE467B01029',
    open: 4255.00,
    high: 4340.00,
    low: 4245.00,
    close: 4310.00,
    lastPrice: 4311.00,
    prevClose: 4235.00,
    change: 75.00,
    changePercent: 1.77,
    totalTradedQty: 240000,
    totalTradedVal: 1032000000,
    totalTrades: 15600,
    deliveryQty: 172800,
    deliveryPercent: 72.00,
    high52w: 4590.00,
    low52w: 3310.00,
    distanceFrom52wHighPercent: -6.10,
    avgVolume20d: 260000,
    volumeSurgeRatio: 0.92,
    isCircuitHit: 'NONE',
    circuitLimitPercent: 10.0,
    sepaStage: 'Stage 2 (Contraction)',
    rsRating: 84,
    isMinerviniCandidate: false,
    date: LATEST_TRADING_DATE,
    sector: 'Technology',
    industry: 'IT Services'
  }
];

// Helper to compute live market summary breadth
export function calculateBhavcopySummary(
  records: BhavcopyRecord[],
  exchange: BhavcopyExchange,
  date: string
): BhavcopyMarketSummary {
  const filtered = records.filter(
    (r) => exchange === 'ALL' || r.exchange === exchange
  );

  let advances = 0;
  let declines = 0;
  let unchanged = 0;
  let totalTurnover = 0;
  let totalVolume = 0;
  let stocksAt52wHigh = 0;
  let stocksAt52wLow = 0;
  let upperCircuitCount = 0;
  let lowerCircuitCount = 0;
  let highDeliveryCount = 0;
  let stage2Count = 0;

  for (const r of filtered) {
    if (r.changePercent > 0) advances++;
    else if (r.changePercent < 0) declines++;
    else unchanged++;

    totalTurnover += r.totalTradedVal;
    totalVolume += r.totalTradedQty;

    if (r.distanceFrom52wHighPercent >= -2.5) stocksAt52wHigh++;
    if (r.low52w > 0 && Math.abs(r.close - r.low52w) / r.low52w <= 0.03) stocksAt52wLow++;

    if (r.isCircuitHit === 'UPPER') upperCircuitCount++;
    if (r.isCircuitHit === 'LOWER') lowerCircuitCount++;

    if ((r.deliveryPercent ?? 0) >= 55) highDeliveryCount++;
    if (r.sepaStage.includes('Stage 2') || r.isMinerviniCandidate) stage2Count++;
  }

  const turnoverCrores = Math.round((totalTurnover / 10000000) * 100) / 100;

  return {
    exchange,
    tradingDate: date,
    totalTradedCount: filtered.length,
    advances,
    declines,
    unchanged,
    totalTurnoverCrores: turnoverCrores,
    totalVolumeTraded: totalVolume,
    stocksAt52wHigh,
    stocksAt52wLow,
    upperCircuitCount,
    lowerCircuitCount,
    highDeliveryAccumulationCount: highDeliveryCount,
    stage2BreakoutCount: stage2Count
  };
}

// Export Bhavcopy to CSV in authentic exchange format
export function exportBhavcopyToCSV(
  records: BhavcopyRecord[],
  exchange: BhavcopyExchange
): string {
  const filtered = records.filter((r) => exchange === 'ALL' || r.exchange === exchange);

  if (exchange === 'BSE') {
    // BSE Bhavcopy format
    const headers = [
      'SC_CODE',
      'SC_NAME',
      'SC_GROUP',
      'SC_TYPE',
      'OPEN',
      'HIGH',
      'LOW',
      'CLOSE',
      'LAST',
      'PREVCLOSE',
      'NO_TRADES',
      'NO_OF_SHRS',
      'NET_TURNOV',
      'DELIV_PER',
      '52W_HIGH',
      '52W_LOW',
      'SEPA_STAGE',
      'RS_RATING',
      'ISIN'
    ];
    const rows = filtered.map((r) => [
      r.scripCode || '',
      `"${r.name.replace(/"/g, '""')}"`,
      r.series,
      'Q',
      r.open.toFixed(2),
      r.high.toFixed(2),
      r.low.toFixed(2),
      r.close.toFixed(2),
      r.lastPrice.toFixed(2),
      r.prevClose.toFixed(2),
      r.totalTrades,
      r.totalTradedQty,
      r.totalTradedVal,
      r.deliveryPercent ?? 0,
      r.high52w.toFixed(2),
      r.low52w.toFixed(2),
      r.sepaStage,
      r.rsRating,
      r.isin
    ]);
    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  } else {
    // NSE Bhavcopy format (or combined)
    const headers = [
      'SYMBOL',
      'SERIES',
      'OPEN',
      'HIGH',
      'LOW',
      'CLOSE',
      'LAST',
      'PREVCLOSE',
      'TOTTRDQTY',
      'TOTTRDVAL',
      'TIMESTAMP',
      'TOTALTRADES',
      'ISIN',
      'DELIV_QTY',
      'DELIV_PER',
      '52W_HIGH',
      '52W_LOW',
      'EXCHANGE',
      'SEPA_STAGE',
      'RS_RATING'
    ];
    const rows = filtered.map((r) => [
      r.symbol,
      r.series,
      r.open.toFixed(2),
      r.high.toFixed(2),
      r.low.toFixed(2),
      r.close.toFixed(2),
      r.lastPrice.toFixed(2),
      r.prevClose.toFixed(2),
      r.totalTradedQty,
      r.totalTradedVal,
      r.date,
      r.totalTrades,
      r.isin,
      r.deliveryQty ?? 0,
      r.deliveryPercent ?? 0,
      r.high52w.toFixed(2),
      r.low52w.toFixed(2),
      r.exchange,
      r.sepaStage,
      r.rsRating
    ]);
    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }
}

// Client-side CSV Parser for user-uploaded Bhavcopy files
export function parseCustomBhavcopyCSV(csvContent: string): {
  records: BhavcopyRecord[];
  detectedExchange: 'NSE' | 'BSE' | 'UNKNOWN';
  error?: string;
} {
  try {
    const lines = csvContent.trim().split(/\r?\n/);
    if (lines.length < 2) {
      return { records: [], detectedExchange: 'UNKNOWN', error: 'File is empty or missing headers.' };
    }

    const headerLine = lines[0].toUpperCase();
    const headers = headerLine.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));

    // Detect format
    const isBse = headers.includes('SC_CODE') || headers.includes('SC_NAME') || headers.includes('NO_OF_SHRS');
    const isNse = headers.includes('SYMBOL') || headers.includes('TOTTRDQTY') || headers.includes('TOTTRDVAL');

    const detectedExchange: 'NSE' | 'BSE' | 'UNKNOWN' = isBse ? 'BSE' : isNse ? 'NSE' : 'UNKNOWN';

    const getColIndex = (names: string[]): number => {
      for (const n of names) {
        const idx = headers.indexOf(n);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const symbolIdx = getColIndex(['SYMBOL', 'SC_NAME', 'SECURITY']);
    const scripCodeIdx = getColIndex(['SC_CODE', 'SCRIP_CODE', 'CODE']);
    const openIdx = getColIndex(['OPEN', 'OPEN_PRICE']);
    const highIdx = getColIndex(['HIGH', 'HIGH_PRICE']);
    const lowIdx = getColIndex(['LOW', 'LOW_PRICE']);
    const closeIdx = getColIndex(['CLOSE', 'CLOSE_PRICE']);
    const prevCloseIdx = getColIndex(['PREVCLOSE', 'PREV_CLOSE', 'PREV_CLO']);
    const qtyIdx = getColIndex(['TOTTRDQTY', 'NO_OF_SHRS', 'VOLUME', 'QTY']);
    const valIdx = getColIndex(['TOTTRDVAL', 'NET_TURNOV', 'TURNOVER', 'VAL']);
    const tradesIdx = getColIndex(['TOTALTRADES', 'NO_TRADES', 'TRADES']);
    const isinIdx = getColIndex(['ISIN', 'ISIN_CODE']);
    const seriesIdx = getColIndex(['SERIES', 'SC_GROUP', 'GROUP']);
    const delivQtyIdx = getColIndex(['DELIV_QTY', 'DELIVERY_QTY']);
    const delivPerIdx = getColIndex(['DELIV_PER', 'DELIV_PERCENT', 'DELIVERY_PER']);
    const high52Idx = getColIndex(['52W_HIGH', 'HIGH52W', 'HI_52_WK']);
    const low52Idx = getColIndex(['52W_LOW', 'LOW52W', 'LO_52_WK']);

    const records: BhavcopyRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle simple CSV splitting with potential quotes
      const row: string[] = [];
      let inQuotes = false;
      let token = '';
      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(token.trim());
          token = '';
        } else {
          token += char;
        }
      }
      row.push(token.trim());

      const rawSymbol = symbolIdx >= 0 ? row[symbolIdx]?.replace(/^"|"$/g, '') : '';
      if (!rawSymbol) continue;

      const open = openIdx >= 0 ? parseFloat(row[openIdx]) || 0 : 0;
      const high = highIdx >= 0 ? parseFloat(row[highIdx]) || 0 : 0;
      const low = lowIdx >= 0 ? parseFloat(row[lowIdx]) || 0 : 0;
      const close = closeIdx >= 0 ? parseFloat(row[closeIdx]) || 0 : 0;
      const prevClose = prevCloseIdx >= 0 ? parseFloat(row[prevCloseIdx]) || close : close;
      const totalTradedQty = qtyIdx >= 0 ? parseInt(row[qtyIdx], 10) || 0 : 0;
      const totalTradedVal = valIdx >= 0 ? parseFloat(row[valIdx]) || 0 : 0;
      const totalTrades = tradesIdx >= 0 ? parseInt(row[tradesIdx], 10) || 0 : 0;
      const scripCode = scripCodeIdx >= 0 ? row[scripCodeIdx] : undefined;
      const isin = isinIdx >= 0 ? row[isinIdx] : 'INE000000000';
      const series = seriesIdx >= 0 ? row[seriesIdx] : (isBse ? 'B' : 'EQ');
      const deliveryQty = delivQtyIdx >= 0 ? parseInt(row[delivQtyIdx], 10) || undefined : undefined;
      const deliveryPercent = delivPerIdx >= 0 ? parseFloat(row[delivPerIdx]) || undefined : undefined;
      const high52w = high52Idx >= 0 ? parseFloat(row[high52Idx]) || (high * 1.05) : (high * 1.05);
      const low52w = low52Idx >= 0 ? parseFloat(row[low52Idx]) || (low * 0.7) : (low * 0.7);

      const change = close - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
      const distanceFrom52wHighPercent = high52w > 0 ? ((close - high52w) / high52w) * 100 : -10;
      const avgVolume20d = Math.max(1, Math.round(totalTradedQty * 0.85));
      const volumeSurgeRatio = avgVolume20d > 0 ? totalTradedQty / avgVolume20d : 1;

      // Determine SEPA criteria
      const isNear52wHigh = distanceFrom52wHighPercent >= -15;
      const hasVolumeSurge = volumeSurgeRatio >= 1.2;
      const hasHighDelivery = (deliveryPercent ?? 50) >= 55;
      const isMinerviniCandidate = isNear52wHigh && changePercent > 0 && (hasVolumeSurge || hasHighDelivery);

      let sepaStage: BhavcopyRecord['sepaStage'] = 'Stage 1 (Base)';
      if (isNear52wHigh && changePercent >= 3.0 && hasVolumeSurge) {
        sepaStage = 'Stage 2 (Breakout)';
      } else if (isNear52wHigh && changePercent >= 0) {
        sepaStage = 'Stage 2 (Contraction)';
      }

      records.push({
        symbol: rawSymbol,
        scripCode,
        name: rawSymbol,
        exchange: isBse ? 'BSE' : 'NSE',
        series,
        isin,
        open,
        high,
        low,
        close,
        lastPrice: close,
        prevClose,
        change,
        changePercent,
        totalTradedQty,
        totalTradedVal,
        totalTrades,
        deliveryQty,
        deliveryPercent,
        high52w,
        low52w,
        distanceFrom52wHighPercent,
        avgVolume20d,
        volumeSurgeRatio,
        isCircuitHit: changePercent >= 9.9 ? 'UPPER' : changePercent <= -9.9 ? 'LOWER' : 'NONE',
        circuitLimitPercent: 10,
        sepaStage,
        rsRating: Math.min(99, Math.max(50, Math.round(80 + changePercent * 2))),
        isMinerviniCandidate,
        date: new Date().toISOString().split('T')[0]
      });
    }

    return { records, detectedExchange };
  } catch (err: unknown) {
    return {
      records: [],
      detectedExchange: 'UNKNOWN',
      error: err instanceof Error ? err.message : 'Failed to parse CSV file.'
    };
  }
}
