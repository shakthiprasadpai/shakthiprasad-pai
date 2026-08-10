import { MinerviniTradeSetup } from '../types';
import { formatCurrency, evaluateTrendTemplate, calculateBreakoutProbability, calculatePositionSize } from './sepaCalculator';

export interface PdfExportOptions {
  accountCapital?: number;
  riskPercent?: number;
  notes?: string;
}

export function generateSepaPdfReport(stock: MinerviniTradeSetup, options?: PdfExportOptions): void {
  const currency = '₹';
  const accountSize = options?.accountCapital || 500000; // ₹5,000,000 default
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

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export the PDF trade setup report.');
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>SEPA Trade Setup Report - ${stock.ticker}</title>
        <style>
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1a1a1a;
            background: #ffffff;
            margin: 0;
            padding: 20px;
            font-size: 12px;
            line-height: 1.5;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #1a1a1a;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .logo {
            font-size: 20px;
            font-weight: 900;
            letter-spacing: 2px;
            text-transform: uppercase;
          }
          .logo-sub {
            font-size: 10px;
            color: #888;
            letter-spacing: 1px;
            margin-top: 2px;
          }
          .badge {
            background: #1a1a1a;
            color: #f59e0b;
            padding: 4px 10px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-radius: 3px;
          }
          .stock-title {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 16px;
            border-radius: 6px;
            margin-bottom: 20px;
          }
          .ticker {
            font-size: 28px;
            font-weight: 900;
            margin: 0;
            color: #0f172a;
          }
          .company-name {
            font-size: 13px;
            color: #64748b;
          }
          .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 20px;
          }
          .card {
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 14px;
            background: #ffffff;
          }
          .card-title {
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #b5a68d;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 6px;
            margin-bottom: 10px;
          }
          .metric-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            border-bottom: 1px dashed #f1f5f9;
          }
          .metric-label {
            color: #64748b;
          }
          .metric-value {
            font-weight: bold;
            font-family: monospace;
          }
          .value-green { color: #16a34a; }
          .value-red { color: #dc2626; }
          .value-amber { color: #d97706; }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 11px;
          }
          th, td {
            padding: 8px 10px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
          }
          th {
            background: #f8fafc;
            color: #475569;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 9px;
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
          .footer {
            margin-top: 30px;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
          }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="background:#1a1a1a; color:#fff; padding:12px; text-align:center; margin-bottom:20px; border-radius:6px;">
          <button onclick="window.print()" style="background:#f59e0b; color:#000; border:none; padding:8px 20px; font-weight:bold; cursor:pointer; font-size:13px; border-radius:4px;">
            🖨️ Save as PDF / Print Report
          </button>
        </div>

        <div class="header">
          <div>
            <div class="logo">Growth Stock Alpha — SEPA Engine</div>
            <div class="logo-sub">Mark Minervini Strategy & Hermes AI Agent Co-Pilot Audit</div>
          </div>
          <div class="badge">Official Setup Blueprint</div>
        </div>

        <div class="stock-title">
          <div>
            <div class="ticker">${stock.ticker} <span style="font-size:14px; font-weight:normal; color:#64748b;">(${stock.exchange})</span></div>
            <div class="company-name">${stock.name} • ${stock.sector} Industry</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px; color:#64748b; text-transform:uppercase;">Current Price</div>
            <div style="font-size:22px; font-weight:bold; font-family:monospace;">${formatCurrency(stock.currentPrice, currency)}</div>
          </div>
        </div>

        <div class="grid-2">
          <!-- Execution Levels -->
          <div class="card">
            <div class="card-title">Tactical Minervini Execution Levels</div>
            <div class="metric-row">
              <span class="metric-label">Pivot Breakout Entry:</span>
              <span class="metric-value value-green">${formatCurrency(stock.pivotPrice, currency)}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Buy Zone Maximum (+2%):</span>
              <span class="metric-value">${formatCurrency(stock.buyZoneMax || stock.pivotPrice * 1.02, currency)}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Hard Stop Loss (-${Math.abs(stock.stopLossPercent)}%):</span>
              <span class="metric-value value-red">${formatCurrency(stock.stopLossPrice, currency)}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Target 1 (+20% Profit Scale):</span>
              <span class="metric-value">${formatCurrency(stock.target1Price, currency)}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Target 2 (+35% Home Run):</span>
              <span class="metric-value">${formatCurrency(stock.target2Price, currency)}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Risk/Reward Ratio:</span>
              <span class="metric-value value-amber">${stock.riskRewardRatio}:1</span>
            </div>
          </div>

          <!-- Position Sizing & Capital Allocation -->
          <div class="card">
            <div class="card-title">Hermes Position Sizing Matrix</div>
            <div class="metric-row">
              <span class="metric-label">Account Total Capital:</span>
              <span class="metric-value">${formatCurrency(accountSize, currency)}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Max Risk Limit (${riskPct}%):</span>
              <span class="metric-value value-red">${formatCurrency(sizing.riskAmount, currency)}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Recommended Shares:</span>
              <span class="metric-value value-green" style="font-size:14px;">${sizing.shareQuantity.toLocaleString()} Shares</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Total Position Cost:</span>
              <span class="metric-value">${formatCurrency(sizing.totalPositionCost, currency)}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Portfolio Allocation:</span>
              <span class="metric-value">${sizing.portfolioAllocationPercent.toFixed(1)}% of Portfolio</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Breakout Probability Score:</span>
              <span class="metric-value value-amber">${breakoutProb.score}% (${breakoutProb.rating})</span>
            </div>
          </div>
        </div>

        <!-- Trend Template Rules Audit -->
        <div class="card" style="margin-bottom:20px;">
          <div class="card-title">Mark Minervini Stage 2 Trend Template Audit (${trendEval.passedCount}/8 Rules Passing)</div>
          <table>
            <thead>
              <tr>
                <th>Rule Description</th>
                <th>Required Threshold</th>
                <th>Actual Stock Value</th>
                <th>Status</th>
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

        <!-- Notes / Directives -->
        <div class="card">
          <div class="card-title">Hermes AI Strategy Directives</div>
          <p style="margin:0; font-style:italic; color:#475569;">
            ${options?.notes || `Buy strictly on a high-volume breakout crossing ${formatCurrency(stock.pivotPrice, currency)} with volume expanding +50% above the 20-day average. Enforce a hard stop loss at ${formatCurrency(stock.stopLossPrice, currency)}. Do not chase beyond ${formatCurrency(stock.buyZoneMax || stock.pivotPrice * 1.02, currency)}.`}
          </p>
        </div>

        <div class="footer">
          Generated via Growth Stock Alpha • Mark Minervini SEPA Engine • Confidential Trading Blueprint
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
