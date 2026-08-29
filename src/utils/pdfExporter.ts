import { MinerviniTradeSetup } from '../types';
import {
  formatCurrency,
  evaluateTrendTemplate,
  calculateBreakoutProbability,
  calculatePositionSize,
  calculateRiskAdjustedMetrics,
  getCurrencySymbol,
  calculateDailyVolatilityMetrics,
} from './sepaCalculator';

export interface PdfExportOptions {
  accountCapital?: number;
  riskPercent?: number;
  notes?: string;
  currency?: string;
}

/**
 * Generates an in-depth, publication-grade Risk-Adjusted SEPA Trade Setup Dossier PDF
 */
export function generateSepaPdfReport(stock: MinerviniTradeSetup, options?: PdfExportOptions): void {
  const currency = options?.currency || getCurrencySymbol(stock.exchange) || '$';
  const accountSize = options?.accountCapital || 100000;
  const riskPct = options?.riskPercent || 1.0;
  
  const trendEval = evaluateTrendTemplate({
    currentPrice: stock.currentPrice,
    sma50: stock.sma50,
    sma150: stock.sma150,
    sma200: stock.sma200,
    sma200_1mo_ago: stock.sma200_1mo_ago,
    high52w: stock.high52w,
    low52w: stock.low52w,
    rsRating: stock.rsRating
  });

  const breakoutProb = calculateBreakoutProbability(stock);
  const sizing = calculatePositionSize(accountSize, riskPct, stock.pivotPrice, stock.stopLossPrice);
  const riskMetrics = calculateRiskAdjustedMetrics(stock);
  const volMetrics = calculateDailyVolatilityMetrics(stock);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export the PDF trade setup report.');
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <title>Risk-Adjusted SEPA Blueprint - ${stock.ticker}</title>
        <style>
          @page {
            size: A4;
            margin: 12mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1a1a1a;
            background: #ffffff;
            margin: 0;
            padding: 16px;
            font-size: 11.5px;
            line-height: 1.45;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #1a1a1a;
            padding-bottom: 10px;
            margin-bottom: 16px;
          }
          .logo {
            font-size: 18px;
            font-weight: 900;
            letter-spacing: 1.5px;
            text-transform: uppercase;
          }
          .logo-sub {
            font-size: 10px;
            color: #64748b;
            letter-spacing: 0.5px;
            margin-top: 2px;
          }
          .badge {
            background: #1a1a1a;
            color: #f59e0b;
            padding: 5px 12px;
            font-size: 10.5px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-radius: 3px;
          }
          .stock-title {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            padding: 14px 18px;
            border-radius: 4px;
            margin-bottom: 16px;
          }
          .ticker {
            font-size: 26px;
            font-weight: 900;
            margin: 0;
            color: #0f172a;
          }
          .company-name {
            font-size: 12.5px;
            color: #475569;
            font-weight: 500;
          }
          .risk-kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 16px;
          }
          .kpi-card {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            padding: 10px 12px;
            border-radius: 4px;
          }
          .kpi-label {
            font-size: 9px;
            text-transform: uppercase;
            color: #64748b;
            font-weight: bold;
            letter-spacing: 0.5px;
          }
          .kpi-val {
            font-size: 18px;
            font-weight: 900;
            font-family: monospace;
            margin: 4px 0 2px 0;
          }
          .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            margin-bottom: 16px;
          }
          .card {
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 12px 14px;
            background: #ffffff;
          }
          .card-title {
            font-size: 10.5px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #0f172a;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
          }
          .metric-row {
            display: flex;
            justify-content: space-between;
            padding: 3.5px 0;
            border-bottom: 1px dashed #f1f5f9;
            font-size: 11px;
          }
          .metric-label {
            color: #475569;
          }
          .metric-value {
            font-weight: bold;
            font-family: monospace;
          }
          .value-green { color: #16a34a; }
          .value-red { color: #dc2626; }
          .value-purple { color: #7c3aed; }
          .value-amber { color: #d97706; }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
            font-size: 10.5px;
          }
          th, td {
            padding: 6px 8px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
          }
          th {
            background: #f8fafc;
            color: #475569;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 8.5px;
            letter-spacing: 0.5px;
          }
          .pass-tag {
            color: #16a34a;
            font-weight: bold;
          }
          .fail-tag {
            color: #dc2626;
            font-weight: bold;
          }
          .rules-list {
            margin: 0;
            padding-left: 16px;
            color: #334155;
            font-size: 10.5px;
          }
          .rules-list li {
            margin-bottom: 4px;
          }
          .footer {
            margin-top: 20px;
            padding-top: 8px;
            border-top: 1px solid #cbd5e1;
            text-align: center;
            font-size: 9.5px;
            color: #94a3b8;
          }
          @media print {
            .no-print { display: none; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="background:#0f172a; color:#fff; padding:12px; text-align:center; margin-bottom:16px; border-radius:4px; display:flex; justify-content:center; gap:12px; align-items:center;">
          <span style="font-weight:bold; font-size:12px;">📄 Risk-Adjusted Trade Setup Dossier Ready:</span>
          <button onclick="window.print()" style="background:#f59e0b; color:#000; border:none; padding:7px 20px; font-weight:900; cursor:pointer; font-size:12px; border-radius:3px; text-transform:uppercase;">
            🖨️ Save as PDF / Print
          </button>
        </div>

        <div class="header">
          <div>
            <div class="logo">Growth Stock Alpha — Risk-Adjusted SEPA Engine</div>
            <div class="logo-sub">Mark Minervini SEPA Protocol • Asymmetric Risk/Reward & Capital Allocation Audit</div>
          </div>
          <div class="badge">${riskMetrics.riskTierLabel}</div>
        </div>

        <div class="stock-title">
          <div>
            <div class="ticker">${stock.ticker} <span style="font-size:13px; font-weight:normal; color:#64748b;">(${stock.exchange})</span></div>
            <div class="company-name">${stock.name} • ${stock.sector || 'Equities'} • VCP Stage: ${stock.vcpStage}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:9.5px; color:#64748b; text-transform:uppercase; font-weight:bold;">Current Market Price</div>
            <div style="font-size:22px; font-weight:900; font-family:monospace; color:#0f172a;">${formatCurrency(stock.currentPrice, currency)}</div>
          </div>
        </div>

        <!-- 4-Card Risk-Adjusted KPI Banner -->
        <div class="risk-kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Reward / Risk Ratio</div>
            <div class="kpi-val value-purple">${riskMetrics.riskRewardRatio.toFixed(2)} : 1</div>
            <div style="font-size:9px; color:#64748b;">Target 2: ${riskMetrics.target2RiskRewardRatio.toFixed(2)}:1</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label">Mathematical Expectancy</div>
            <div class="kpi-val ${riskMetrics.expectancyR >= 1.5 ? 'value-green' : 'value-amber'}">+${riskMetrics.expectancyR.toFixed(2)} R</div>
            <div style="font-size:9px; color:#64748b;">Win Prob: ${breakoutProb.score}% (${breakoutProb.rating})</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label">Max Downside Risk</div>
            <div class="kpi-val value-red">-${riskMetrics.riskPct.toFixed(2)}%</div>
            <div style="font-size:9px; color:#64748b;">Stop at ${formatCurrency(stock.stopLossPrice, currency)}</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label">Risk-Adjusted Alpha Score</div>
            <div class="kpi-val value-green">${riskMetrics.riskQualityScore} <span style="font-size:11px; color:#94a3b8;">/ 100</span></div>
            <div style="font-size:9px; color:#64748b;">RS Rating: ${stock.rsRating} • SEPA: ${stock.trendScore}/8</div>
          </div>
        </div>

        <div class="grid-2">
          <!-- Execution Levels -->
          <div class="card">
            <div class="card-title">
              <span>Tactical Entry & Exit Spectrum</span>
              <span class="value-green">Buy Zone</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Optimal Pivot Breakout Entry:</span>
              <span class="metric-value value-green">${formatCurrency(stock.pivotPrice, currency)}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Max Buy Zone (+2% Max Chase):</span>
              <span class="metric-value">${formatCurrency(stock.buyZoneMax || stock.pivotPrice * 1.02, currency)}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Hard Invalidation Stop Loss:</span>
              <span class="metric-value value-red">${formatCurrency(stock.stopLossPrice, currency)} (-${riskMetrics.riskPct.toFixed(1)}%)</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Target 1 (Primary 3:1 Scale Out):</span>
              <span class="metric-value value-purple">${formatCurrency(stock.target1Price, currency)} (+${riskMetrics.rewardPct.toFixed(1)}%)</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Target 2 (Runner / Home Run +35%):</span>
              <span class="metric-value value-green">${formatCurrency(stock.target2Price, currency)}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Daily ATR / Volatility Tier:</span>
              <span class="metric-value">${volMetrics.atrPercent.toFixed(2)}% (${riskMetrics.volatilityTier} Vol)</span>
            </div>
          </div>

          <!-- Position Sizing & Capital Allocation -->
          <div class="card">
            <div class="card-title">
              <span>Risk-Budgeted Position Sizing</span>
              <span>${riskPct}% Risk Model</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Total Portfolio Account Capital:</span>
              <span class="metric-value">${formatCurrency(accountSize, currency)}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Max 1R Dollar Risk Allocation (${riskPct}%):</span>
              <span class="metric-value value-red">${formatCurrency(sizing.riskAmount, currency)}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Recommended Share Size:</span>
              <span class="metric-value value-green" style="font-size:13px;">${sizing.shareQuantity.toLocaleString()} Shares</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Total Capital Committed:</span>
              <span class="metric-value">${formatCurrency(sizing.totalPositionCost, currency)}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Portfolio Position Weight:</span>
              <span class="metric-value">${sizing.portfolioAllocationPercent.toFixed(1)}% of Portfolio</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Half-Kelly Optimal Sizing Cap:</span>
              <span class="metric-value">${riskMetrics.halfKellyAllocationPct.toFixed(1)}% max allocation</span>
            </div>
          </div>
        </div>

        <!-- Trend Template Rules Audit -->
        <div class="card" style="margin-bottom:14px;">
          <div class="card-title">
            <span>Mark Minervini Stage 2 Trend Template (${trendEval.passedCount}/8 Rules Passing)</span>
            <span style="font-family:monospace;">Score: ${((trendEval.passedCount / 8) * 100).toFixed(0)}%</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Rule Description</th>
                <th>Required Threshold</th>
                <th>Actual Metric</th>
                <th>Audit Result</th>
              </tr>
            </thead>
            <tbody>
              ${trendEval.rules.map(r => `
                <tr>
                  <td><strong>${r.title}</strong></td>
                  <td>${r.requiredConditionStr}</td>
                  <td>${r.actualValueStr}</td>
                  <td>${r.passed ? '<span class="pass-tag">✓ PASSED</span>' : '<span class="fail-tag">✗ FAIL</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Risk Management Directives -->
        <div class="card">
          <div class="card-title">
            <span>Minervini Risk Management Execution Checklist</span>
            <span style="color:#d97706;">Strict Discipline Protocol</span>
          </div>
          <ul class="rules-list">
            <li><strong>Non-Negotiable Stop Loss:</strong> Place a stop order at ${formatCurrency(stock.stopLossPrice, currency)} immediately upon entry. Maximum permitted capital risk is ${formatCurrency(sizing.riskAmount, currency)}.</li>
            <li><strong>Never Average Down:</strong> If price breaks below pivot support, exit immediately without emotion. Never add capital to a losing trade.</li>
            <li><strong>Progressive Scaling:</strong> Lock in 50% of profits at Target 1 (${formatCurrency(stock.target1Price, currency)}). Move stop loss to breakeven (${formatCurrency(stock.pivotPrice, currency)}) on remainder.</li>
            <li><strong>Chasing Prohibition:</strong> If stock gaps or runs >2.5% above pivot (${formatCurrency(stock.buyZoneMax || stock.pivotPrice * 1.02, currency)}), wait for the first tight pullback before initiating.</li>
          </ul>
        </div>

        <div class="footer">
          Generated via Growth Stock Alpha • Mark Minervini SEPA Engine • Confidential Trading Blueprint • ${new Date().toLocaleDateString()}
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

export interface ScreenerPdfExportOptions {
  accountCapital?: number;
  riskPercent?: number;
  filterName?: string;
  currency?: string;
}

/**
 * Generates a multi-stock Risk-Adjusted Screener & Watchlist Portfolio PDF Dossier
 */
export function exportRiskAdjustedScreenerPdf(
  stocks: MinerviniTradeSetup[],
  options?: ScreenerPdfExportOptions
): void {
  const currency = options?.currency || '$';
  const accountSize = options?.accountCapital || 100000;
  const riskPct = options?.riskPercent || 1.0;
  const filterName = options?.filterName || 'All Active SEPA Setups';

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export the Risk-Adjusted Screener PDF report.');
    return;
  }

  // Calculate risk-adjusted metrics for all stocks and sort by Expectancy (+R)
  const analyzedStocks = stocks.map(s => {
    const metrics = calculateRiskAdjustedMetrics(s);
    const sizing = calculatePositionSize(accountSize, riskPct, s.pivotPrice, s.stopLossPrice);
    return { stock: s, metrics, sizing };
  }).sort((a, b) => b.metrics.expectancyR - a.metrics.expectancyR);

  // Screener aggregate stats
  const avgRR = (analyzedStocks.reduce((sum, item) => sum + item.metrics.riskRewardRatio, 0) / (analyzedStocks.length || 1)).toFixed(2);
  const avgRiskPct = (analyzedStocks.reduce((sum, item) => sum + item.metrics.riskPct, 0) / (analyzedStocks.length || 1)).toFixed(1);
  const championSetupsCount = analyzedStocks.filter(item => item.metrics.riskRewardRatio >= 4.0).length;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <title>Risk-Adjusted Screener Report (${analyzedStocks.length} Setups)</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1a1a1a;
            background: #ffffff;
            margin: 0;
            padding: 14px;
            font-size: 10.5px;
            line-height: 1.4;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .logo {
            font-size: 16px;
            font-weight: 900;
            letter-spacing: 1px;
            text-transform: uppercase;
          }
          .summary-bar {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 12px;
          }
          .stat-box {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            padding: 8px 10px;
            border-radius: 4px;
          }
          .stat-label {
            font-size: 8.5px;
            text-transform: uppercase;
            color: #64748b;
            font-weight: bold;
          }
          .stat-val {
            font-size: 16px;
            font-weight: 900;
            font-family: monospace;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9.5px;
            margin-bottom: 14px;
          }
          th, td {
            padding: 5px 6px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
          }
          th {
            background: #0f172a;
            color: #ffffff;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 8px;
            letter-spacing: 0.5px;
          }
          tr:nth-child(even) {
            background: #f8fafc;
          }
          .tag-champion {
            background: #f3e8ff;
            color: #7e22ce;
            font-weight: bold;
            padding: 2px 4px;
            border-radius: 2px;
            font-size: 8px;
          }
          .tag-standard {
            background: #dcfce7;
            color: #15803d;
            font-weight: bold;
            padding: 2px 4px;
            border-radius: 2px;
            font-size: 8px;
          }
          .tag-subpar {
            background: #fee2e2;
            color: #b91c1c;
            font-weight: bold;
            padding: 2px 4px;
            border-radius: 2px;
            font-size: 8px;
          }
          .val-mono {
            font-family: monospace;
            font-weight: 700;
          }
          .footer {
            margin-top: 10px;
            border-top: 1px solid #cbd5e1;
            padding-top: 6px;
            font-size: 8.5px;
            color: #94a3b8;
            display: flex;
            justify-content: space-between;
          }
          @media print {
            .no-print { display: none; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="background:#0f172a; color:#fff; padding:10px; text-align:center; margin-bottom:12px; border-radius:4px; display:flex; justify-content:center; gap:10px; align-items:center;">
          <span style="font-weight:bold; font-size:11.5px;">📄 Multi-Stock Risk-Adjusted Screener PDF Ready:</span>
          <button onclick="window.print()" style="background:#f59e0b; color:#000; border:none; padding:6px 16px; font-weight:900; cursor:pointer; font-size:11.5px; border-radius:3px; text-transform:uppercase;">
            🖨️ Save as PDF / Print Report
          </button>
        </div>

        <div class="header">
          <div>
            <div class="logo">Growth Stock Alpha • Risk-Adjusted Screener Dossier</div>
            <div style="font-size:9.5px; color:#64748b;">Filter: ${filterName} • Account Capital: ${formatCurrency(accountSize, currency)} (${riskPct}% Max Risk/Trade)</div>
          </div>
          <div style="font-size:10px; font-weight:bold; color:#0f172a; text-align:right;">
            <div>Total Setups: ${analyzedStocks.length}</div>
            <div style="color:#64748b; font-weight:normal;">Generated: ${new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <!-- KPI summary banner -->
        <div class="summary-bar">
          <div class="stat-box">
            <div class="stat-label">Average Risk/Reward</div>
            <div class="stat-val" style="color:#7c3aed;">${avgRR} : 1</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Average Downside Stop</div>
            <div class="stat-val" style="color:#dc2626;">-${avgRiskPct}%</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Champion Grade (4:1+)</div>
            <div class="stat-val" style="color:#16a34a;">${championSetupsCount} / ${analyzedStocks.length}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Max Risk Per Trade</div>
            <div class="stat-val">${formatCurrency(accountSize * (riskPct / 100), currency)}</div>
          </div>
        </div>

        <!-- Master Risk Table -->
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Ticker & Company</th>
              <th>Sector</th>
              <th>Price</th>
              <th>Pivot Entry</th>
              <th>Hard Stop</th>
              <th>Max Risk %</th>
              <th>Target 1</th>
              <th>R:R Ratio</th>
              <th>Expectancy</th>
              <th>Win Prob</th>
              <th>Safe Shares</th>
              <th>Position Cost</th>
              <th>Weight %</th>
              <th>Alpha Score</th>
            </tr>
          </thead>
          <tbody>
            ${analyzedStocks.map((item, idx) => {
              const { stock: s, metrics: m, sizing: sz } = item;
              const isChamp = m.riskRewardRatio >= 4.0;
              const isStandard = m.riskRewardRatio >= 3.0 && m.riskRewardRatio < 4.0;
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${s.ticker}</strong> <span style="color:#64748b; font-size:8px;">(${s.name.slice(0, 15)})</span></td>
                  <td>${s.sector || 'Equities'}</td>
                  <td class="val-mono">${formatCurrency(s.currentPrice, currency)}</td>
                  <td class="val-mono" style="color:#16a34a;">${formatCurrency(s.pivotPrice, currency)}</td>
                  <td class="val-mono" style="color:#dc2626;">${formatCurrency(s.stopLossPrice, currency)}</td>
                  <td class="val-mono" style="color:${m.riskPct <= 5 ? '#16a34a' : '#dc2626'};">-${m.riskPct.toFixed(1)}%</td>
                  <td class="val-mono">${formatCurrency(s.target1Price, currency)}</td>
                  <td>
                    <span class="${isChamp ? 'tag-champion' : isStandard ? 'tag-standard' : 'tag-subpar'}">
                      ${m.riskRewardRatio.toFixed(1)}:1
                    </span>
                  </td>
                  <td class="val-mono" style="color:${m.expectancyR >= 1.5 ? '#16a34a' : '#d97706'};">+${m.expectancyR.toFixed(2)}R</td>
                  <td class="val-mono">${m.breakoutScore}%</td>
                  <td class="val-mono">${sz.shareQuantity.toLocaleString()}</td>
                  <td class="val-mono">${formatCurrency(sz.totalPositionCost, currency)}</td>
                  <td class="val-mono">${sz.portfolioAllocationPercent.toFixed(1)}%</td>
                  <td class="val-mono" style="font-weight:900; color:#0f172a;">${m.riskQualityScore}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:8px 10px; border-radius:4px; font-size:8.5px; color:#475569;">
          <strong>Minervini SEPA Golden Rule:</strong> Never risk more than 1.0% of total equity on any single position. If a stock drops below its confirmed pivot stop loss, liquidate without hesitation. Lock in 50% profits at Target 1 (3:1 R:R) and let runners ride with a trailing stop.
        </div>

        <div class="footer">
          <div>Growth Stock Alpha • Mark Minervini SEPA Engine</div>
          <div>Confidential • For Personal Investment Research Only</div>
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
