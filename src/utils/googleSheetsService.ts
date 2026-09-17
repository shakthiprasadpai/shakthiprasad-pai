import { getAccessToken } from './googleAuth';
import { MinerviniTradeSetup } from '../types';

export interface SheetFileMetadata {
  id: string;
  name: string;
  modifiedTime: string;
  createdTime?: string;
  webViewLink?: string;
  owners?: Array<{ displayName: string; emailAddress: string }>;
}

export interface SheetTabInfo {
  sheetId: number;
  title: string;
  rowCount?: number;
  columnCount?: number;
}

export interface SpreadsheetDetails {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: SheetTabInfo[];
}

/**
 * Creates a new Google Sheet with an optional title and initial data
 */
export async function createGoogleSheet(
  title: string,
  initialSheetTitle = 'SEPA Watchlist',
  headerRow?: string[],
  rows?: (string | number)[][]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Authentication required. Please sign in with Google.');

  // 1. Create Spreadsheet
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: title || `Minervini SEPA Watchlist - ${new Date().toISOString().split('T')[0]}`,
      },
      sheets: [
        {
          properties: {
            title: initialSheetTitle,
            gridProperties: {
              frozenRowCount: headerRow ? 1 : 0,
            },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to create Google Sheet: ${createRes.statusText}`);
  }

  const sheetData = await createRes.json();
  const spreadsheetId: string = sheetData.spreadsheetId;
  const spreadsheetUrl: string = sheetData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 2. Populate initial values if provided
  if (headerRow && headerRow.length > 0) {
    const allValues: (string | number)[][] = [headerRow];
    if (rows && rows.length > 0) {
      allValues.push(...rows);
    }

    const range = `${initialSheetTitle}!A1`;
    await updateSheetRangeValues(spreadsheetId, range, allValues);

    // Format header row with bold font and dark accent styling
    await formatHeaderRow(spreadsheetId, 0, headerRow.length);
  }

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Update cell values in a specified sheet range
 */
export async function updateSheetRangeValues(
  spreadsheetId: string,
  range: string,
  values: (string | number)[][]
): Promise<any> {
  const token = await getAccessToken();
  if (!token) throw new Error('Authentication required. Please sign in with Google.');

  const encodedRange = encodeURIComponent(range);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to update sheet values: ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Append rows to an existing spreadsheet
 */
export async function appendSheetRows(
  spreadsheetId: string,
  sheetTitle: string,
  rows: (string | number)[][]
): Promise<any> {
  const token = await getAccessToken();
  if (!token) throw new Error('Authentication required. Please sign in with Google.');

  const encodedRange = encodeURIComponent(`${sheetTitle}!A1`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: rows,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to append rows: ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Reads values from a specified range in a spreadsheet
 */
export async function readSheetRangeValues(
  spreadsheetId: string,
  range: string
): Promise<(string | number)[][]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Authentication required. Please sign in with Google.');

  const encodedRange = encodeURIComponent(range);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to read sheet: ${res.statusText}`);
  }

  const data = await res.json();
  return data.values || [];
}

/**
 * Fetch spreadsheet metadata including sheet tabs and titles
 */
export async function getSpreadsheetDetails(spreadsheetId: string): Promise<SpreadsheetDetails> {
  const token = await getAccessToken();
  if (!token) throw new Error('Authentication required. Please sign in with Google.');

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=false`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to load spreadsheet details: ${res.statusText}`);
  }

  const data = await res.json();
  const sheets: SheetTabInfo[] = (data.sheets || []).map((s: any) => ({
    sheetId: s.properties.sheetId,
    title: s.properties.title,
    rowCount: s.properties.gridProperties?.rowCount,
    columnCount: s.properties.gridProperties?.columnCount,
  }));

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties.title,
    spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    sheets,
  };
}

/**
 * Lists user's Google Sheets files from Google Drive
 */
export async function listUserGoogleSheets(maxResults = 25): Promise<SheetFileMetadata[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Authentication required. Please sign in with Google.');

  const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const fields = encodeURIComponent('files(id,name,modifiedTime,createdTime,webViewLink,owners)');
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=${maxResults}&orderBy=modifiedTime%20desc`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to list spreadsheets: ${res.statusText}`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Formats header row with dark charcoal/slate background and bold amber text
 */
async function formatHeaderRow(spreadsheetId: string, sheetIndex = 0, columnCount = 10): Promise<void> {
  try {
    const token = await getAccessToken();
    if (!token) return;

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: sheetIndex,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: columnCount,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.08, green: 0.11, blue: 0.16 }, // slate-900
                  textFormat: {
                    foregroundColor: { red: 0.96, green: 0.72, blue: 0.15 }, // amber-400
                    bold: true,
                    fontSize: 10,
                    fontFamily: 'Roboto',
                  },
                  horizontalAlignment: 'CENTER',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
            },
          },
        ],
      }),
    });
  } catch (err) {
    console.warn('Could not format header row:', err);
  }
}

/**
 * 1-Click SEPA Watchlist Export to Google Sheets
 */
export async function exportWatchlistToGoogleSheet(
  stocks: MinerviniTradeSetup[],
  customTitle?: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const title = customTitle || `Minervini SEPA Watchlist - ${new Date().toISOString().split('T')[0]}`;
  const headerRow = [
    'Ticker',
    'Company Name',
    'Exchange',
    'Sector',
    'Price',
    'Change %',
    'Pattern Type',
    'VCP Stage',
    'RS Rating',
    'Trend Score',
    'Pivot Price',
    'Buy Zone Max',
    'Stop Loss',
    'Stop Loss %',
    'Target 1',
    'Target 1 %',
    'Risk/Reward',
    '50 SMA',
    '150 SMA',
    '200 SMA',
    '52W High',
    '52W Low',
    'RSI 14',
    'ADX 14',
    'Analysis Notes'
  ];

  const rows = stocks.map((s) => [
    s.ticker,
    s.name,
    s.exchange,
    s.sector,
    s.currentPrice,
    `${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%`,
    s.patternType,
    s.vcpStage,
    s.rsRating,
    `${s.trendScore}/8`,
    s.pivotPrice,
    s.buyZoneMax,
    s.stopLossPrice,
    `${s.stopLossPercent}%`,
    s.target1Price,
    `${s.target1Percent}%`,
    `${s.riskRewardRatio}:1`,
    s.sma50,
    s.sma150,
    s.sma200,
    s.high52w,
    s.low52w,
    s.rsi14 ?? 'N/A',
    s.adx14 ?? 'N/A',
    s.sepaNotes || ''
  ]);

  return await createGoogleSheet(title, 'SEPA Candidates', headerRow, rows);
}

/**
 * 1-Click Trade Journal Export to Google Sheets
 */
export async function exportJournalToGoogleSheet(
  trades: any[],
  customTitle?: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const title = customTitle || `Minervini SEPA Trade Journal - ${new Date().toISOString().split('T')[0]}`;
  const headerRow = [
    'Date',
    'Ticker',
    'Side',
    'Setup Pattern',
    'Buy Price',
    'Shares',
    'Stop Loss',
    'Target Price',
    'Exit Price',
    'Status',
    'P&L ($)',
    'Return %',
    'R-Multiple',
    'Mistake / Rule Followed',
    'Notes'
  ];

  const rows = trades.map((t) => [
    t.date || t.entryDate || new Date().toISOString().split('T')[0],
    t.symbol || t.ticker || '',
    t.side || 'BUY',
    t.pattern || t.setup || 'VCP Breakout',
    t.buyPrice || t.entryPrice || 0,
    t.shares || t.quantity || 0,
    t.stopLoss || 0,
    t.target || 0,
    t.exitPrice || '',
    t.status || 'CLOSED',
    t.pnl || t.realizedPnl || 0,
    `${t.returnPercent || 0}%`,
    t.rMultiple ? `${t.rMultiple}R` : '',
    t.mistake || t.tag || '',
    t.notes || ''
  ]);

  return await createGoogleSheet(title, 'Trade Journal Log', headerRow, rows);
}
