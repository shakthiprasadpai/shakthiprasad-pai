import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MinerviniTradeSetup } from '../types';
import { HeadlineItem, getHeadlineImpactScore, getHeadlineVolatilityTriggers } from '../components/TickerNewsGrounding';
import {
  HeadlinePriceZonePlan,
  HeadlineProfitTarget,
  HeadlineStopLoss,
  calculateRewardToRisk,
} from '../utils/headlinePriceZonesStorage';

interface ExportPdfParams {
  stock: MinerviniTradeSetup;
  summary: string;
  headlines: HeadlineItem[];
  priceZonePlan: HeadlinePriceZonePlan;
  groundingSources?: { title: string; uri: string }[];
  currencySymbol: string;
  sentimentOverview?: {
    bullish: number;
    catalyst: number;
    neutral: number;
    bearish: number;
    total: number;
    bullishRatio: number;
  };
}

export function exportNewsSentimentToPdf({
  stock,
  summary,
  headlines,
  priceZonePlan,
  groundingSources = [],
  currencySymbol,
  sentimentOverview,
}: ExportPdfParams): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let yPos = margin;

  // Helpers
  const primaryDark = [26, 26, 26]; // #1a1a1a
  const accentAmber = [217, 119, 6]; // #d97706
  const emeraldGreen = [5, 150, 105]; // #059669
  const crimsonRed = [225, 29, 72]; // #e11d48
  const neutralGray = [107, 114, 128]; // #6b7280
  const lightBg = [249, 248, 245]; // #f9f8f5
  const borderGray = [229, 228, 225]; // #e5e4e1

  // Function to check if a new page is needed
  const checkNewPage = (neededHeight: number) => {
    if (yPos + neededHeight > pageHeight - 16) {
      doc.addPage();
      yPos = margin;
      drawHeaderBanner(false);
    }
  };

  // Header Banner
  const drawHeaderBanner = (isFirstPage = true) => {
    // Header background bar
    doc.setFillColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.rect(margin, yPos, pageWidth - margin * 2, isFirstPage ? 24 : 14, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isFirstPage ? 14 : 10);
    doc.text(
      isFirstPage
        ? `${stock.ticker} — SEPA CATALYST & SENTIMENT INTELLIGENCE REPORT`
        : `${stock.ticker} Catalyst Briefing (${stock.name})`,
      margin + 5,
      yPos + (isFirstPage ? 10 : 9)
    );

    if (isFirstPage) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(214, 211, 209);
      doc.text(
        `${stock.name} | Exchange: ${stock.exchange} | Price: ${currencySymbol}${stock.currentPrice} | Date: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        margin + 5,
        yPos + 17
      );
    }

    yPos += (isFirstPage ? 28 : 18);
  };

  // Draw first page header
  drawHeaderBanner(true);

  // 1. SEPA Setup & Technical Context Matrix
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.rect(margin, yPos, pageWidth - margin * 2, 22, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);

  const colW = (pageWidth - margin * 2) / 4;
  
  // Row 1 metrics
  doc.text(`Trend Score: ${stock.trendScore}/8`, margin + 4, yPos + 6);
  doc.text(`VCP Stage: ${stock.vcpStage || 'Contraction'}`, margin + colW + 4, yPos + 6);
  doc.text(`RS Rating: ${stock.rsRating || 'N/A'}`, margin + colW * 2 + 4, yPos + 6);
  doc.text(`Pattern: ${stock.patternType || 'VCP'}`, margin + colW * 3 + 4, yPos + 6);

  // Row 2 metrics
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(neutralGray[0], neutralGray[1], neutralGray[2]);
  doc.text(`Sector: ${stock.sector || 'Equities'}`, margin + 4, yPos + 14);
  doc.text(`Vol Dry-Up: ${stock.volumeDryUpPercent || 0}%`, margin + colW + 4, yPos + 14);
  doc.text(`R:R Ratio: ${stock.riskRewardRatio ? stock.riskRewardRatio + ':1' : '3:1+'}`, margin + colW * 2 + 4, yPos + 14);
  doc.text(`Pivot: ${currencySymbol}${stock.pivotPrice || stock.currentPrice}`, margin + colW * 3 + 4, yPos + 14);

  yPos += 26;

  // 2. Executive Catalyst Summary Box
  if (summary) {
    checkNewPage(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(accentAmber[0], accentAmber[1], accentAmber[2]);
    doc.text('EXECUTIVE CATALYST SYNTHESIS & SEPA CONTEXT', margin, yPos);
    yPos += 4;

    const splitSummary = doc.splitTextToSize(summary, pageWidth - margin * 2 - 8);
    const boxHeight = Math.min(65, splitSummary.length * 4.2 + 8);

    doc.setFillColor(254, 252, 246);
    doc.setDrawColor(245, 230, 200);
    doc.rect(margin, yPos, pageWidth - margin * 2, boxHeight, 'FD');

    // Left accent bar
    doc.setFillColor(accentAmber[0], accentAmber[1], accentAmber[2]);
    doc.rect(margin, yPos, 2.5, boxHeight, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.text(splitSummary.slice(0, 14), margin + 6, yPos + 6);

    yPos += boxHeight + 6;
  }

  // 3. Trade Plan & Target Zones Table
  const entryPrice = priceZonePlan.entryPrice > 0 ? priceZonePlan.entryPrice : stock.pivotPrice > 0 ? stock.pivotPrice : stock.currentPrice;
  const t1: HeadlineProfitTarget = priceZonePlan.profitTargets[0] || {
    id: 't1',
    label: 'Target 1',
    price: entryPrice * 1.2,
    percentGain: 20,
    status: 'ACTIVE',
  };
  const t2: HeadlineProfitTarget = priceZonePlan.profitTargets[1] || {
    id: 't2',
    label: 'Target 2',
    price: entryPrice * 1.35,
    percentGain: 35,
    status: 'ACTIVE',
  };
  const sl: HeadlineStopLoss = priceZonePlan.stopLoss || {
    price: entryPrice * 0.95,
    percentRisk: 5,
    riskType: 'HARD_STOP',
  };

  const rrT1 = calculateRewardToRisk(entryPrice, t1.price, sl.price);
  const rrT2 = calculateRewardToRisk(entryPrice, t2.price, sl.price);

  checkNewPage(45);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('SEPA PROFIT TARGET & RISK CONTAINMENT PLAN', margin, yPos);
  yPos += 3;

  autoTable(doc, {
    startY: yPos,
    margin: { left: margin, right: margin },
    head: [['Zone / Objective', 'Price', 'Gain / Risk %', 'R:R Ratio', 'Catalyst Rationale & Driver']],
    body: [
      [
        'Pivot Entry',
        `${currencySymbol}${entryPrice.toFixed(2)}`,
        'Base Entry (0.0%)',
        '—',
        'Technical VCP pivot breakout or contraction breakout point',
      ],
      [
        `Target 1 (${t1.label || 'Base Take-Profit'})`,
        `${currencySymbol}${t1.price.toFixed(2)}`,
        `+${t1.percentGain}%`,
        `${rrT1.ratio}:1 ${rrT1.isValidSEPA ? '✓' : ''}`,
        t1.catalystRationale || (t1.associatedHeadlineTitle ? `Triggered by: "${t1.associatedHeadlineTitle}"` : 'Standard Minervini 20% partial profit lock'),
      ],
      [
        `Target 2 (${t2.label || 'Catalyst Extension'})`,
        `${currencySymbol}${t2.price.toFixed(2)}`,
        `+${t2.percentGain}%`,
        `${rrT2.ratio}:1 ${rrT2.isValidSEPA ? '✓' : ''}`,
        t2.catalystRationale || (t2.associatedHeadlineTitle ? `Runner on: "${t2.associatedHeadlineTitle}"` : 'Multi-week institutional runner target'),
      ],
      [
        `Stop Loss (${sl.riskType || 'HARD_STOP'})`,
        `${currencySymbol}${sl.price.toFixed(2)}`,
        `-${sl.percentRisk}%`,
        'Max Risk',
        sl.invalidationThesis || (sl.associatedHeadlineTitle ? `Risk factor: "${sl.associatedHeadlineTitle}"` : 'Loss of pivot support or 5% maximum capital risk containment'),
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [31, 41, 55],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [31, 41, 55],
      cellPadding: 2.2,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold' },
      1: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: 24, halign: 'center' },
      3: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 'auto' },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // 4. Sentiment Overview Summary
  if (sentimentOverview) {
    checkNewPage(24);
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.rect(margin, yPos, pageWidth - margin * 2, 16, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.text(
      `Sentiment Breakdown (${sentimentOverview.total} Total Headlines Evaluated):`,
      margin + 4,
      yPos + 5.5
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
    doc.text(`Bullish: ${sentimentOverview.bullish}`, margin + 4, yPos + 11.5);

    doc.setTextColor(accentAmber[0], accentAmber[1], accentAmber[2]);
    doc.text(`Catalysts: ${sentimentOverview.catalyst}`, margin + 35, yPos + 11.5);

    doc.setTextColor(neutralGray[0], neutralGray[1], neutralGray[2]);
    doc.text(`Neutral: ${sentimentOverview.neutral}`, margin + 70, yPos + 11.5);

    doc.setTextColor(crimsonRed[0], crimsonRed[1], crimsonRed[2]);
    doc.text(`Bearish: ${sentimentOverview.bearish}`, margin + 105, yPos + 11.5);

    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(`Bullish Ratio: ${sentimentOverview.bullishRatio}%`, margin + 138, yPos + 11.5);

    yPos += 22;
  }

  // 5. Grounded News & Catalysts Headlines Table
  checkNewPage(45);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text(`GROUNDED NEWS HEADLINES & CATALYST INTELLIGENCE (${headlines.length})`, margin, yPos);
  yPos += 3;

  const headlineRows = headlines.map((h, i) => {
    const impactScore = getHeadlineImpactScore(h);
    const triggers = getHeadlineVolatilityTriggers(h);
    const triggersStr = triggers.length > 0 ? ` [${triggers.join(', ')}]` : '';

    return [
      `${i + 1}`,
      `${h.date || 'Recent'}\n${h.source || 'News'}`,
      `${h.title}\n"${h.snippet || ''}"${triggersStr}`,
      `${h.sentiment}\n(${h.catalystType || 'News'})`,
      `${impactScore}/10`,
    ];
  });

  autoTable(doc, {
    startY: yPos,
    margin: { left: margin, right: margin },
    head: [['#', 'Date / Source', 'Headline & Key Fundamental Takeaway', 'Sentiment / Type', 'Impact']],
    body: headlineRows,
    theme: 'grid',
    headStyles: {
      fillColor: primaryDark as any,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7.2,
      textColor: [31, 41, 55],
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // 6. Grounding Sources Citations
  if (groundingSources.length > 0) {
    checkNewPage(24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.text('GOOGLE SEARCH GROUNDING CITATIONS', margin, yPos);
    yPos += 4;

    groundingSources.slice(0, 5).forEach((src, idx) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(neutralGray[0], neutralGray[1], neutralGray[2]);
      const line = `• [${idx + 1}] ${src.title}: ${src.uri}`;
      const splitLine = doc.splitTextToSize(line, pageWidth - margin * 2);
      doc.text(splitLine, margin, yPos);
      yPos += splitLine.length * 3.5;
    });
    yPos += 4;
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(neutralGray[0], neutralGray[1], neutralGray[2]);
    doc.text(
      `Mark Minervini SEPA & VCP Master Platform — Confidential Financial Catalyst Intelligence Report`,
      margin,
      pageHeight - 6
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 18, pageHeight - 6);
  }

  // Download PDF
  const dateFormatted = new Date().toISOString().slice(0, 10);
  doc.save(`${stock.ticker}_SEPA_News_Catalyst_Report_${dateFormatted}.pdf`);
}
