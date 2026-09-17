import { getAccessToken } from './googleAuth';
import { MinerviniTradeSetup } from '../types';

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  isUnread?: boolean;
}

export interface GmailMessageFull extends GmailMessageSummary {
  bodyHtml?: string;
  bodyText?: string;
  labels: string[];
}

/**
 * Encodes string to URL-safe Base64 (RFC 4648 § 5)
 */
function toBase64Url(str: string): string {
  // UTF-8 encoding handling
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decodes URL-safe Base64 to string
 */
function fromBase64Url(base64Url: string): string {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Fetches authenticated user's Gmail profile
 */
export async function getGmailProfile(): Promise<GmailProfile> {
  const token = await getAccessToken();
  if (!token) throw new Error('Authentication required. Please sign in with Google.');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to fetch Gmail profile: ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Builds RFC 2822 email payload
 */
function buildRfc2822Email({
  to,
  subject,
  bodyHtml,
  bodyText,
  from,
}: {
  to: string;
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  from?: string;
}): string {
  const boundary = `====boundary_${Date.now()}====`;
  const headers = [
    `To: ${to}`,
    from ? `From: ${from}` : '',
    `Subject: =?utf-8?B?${btoa(new TextEncoder().encode(subject).reduce((acc, b) => acc + String.fromCharCode(b), ''))}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
  ].filter(Boolean);

  const textPart = bodyText || bodyHtml?.replace(/<[^>]+>/g, '') || '';
  const htmlPart = bodyHtml || `<p>${bodyText?.replace(/\n/g, '<br/>') || ''}</p>`;

  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    textPart,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    htmlPart,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  return headers.join('\r\n') + '\r\n' + body;
}

/**
 * Sends an email via Gmail API
 */
export async function sendGmailMessage(params: {
  to: string;
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  from?: string;
}): Promise<{ id: string; threadId: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Authentication required. Please sign in with Google.');

  const rfc2822 = buildRfc2822Email(params);
  const raw = toBase64Url(rfc2822);

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to send email: ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Creates a Gmail draft
 */
export async function createGmailDraft(params: {
  to: string;
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  from?: string;
}): Promise<{ id: string; message: { id: string; threadId: string } }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Authentication required. Please sign in with Google.');

  const rfc2822 = buildRfc2822Email(params);
  const raw = toBase64Url(rfc2822);

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: { raw },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to create draft: ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Searches messages in user's mailbox (e.g. trading alerts, broker confirmations, 5paisa notes)
 */
export async function listGmailMessages(
  query = '',
  maxResults = 20
): Promise<{ messages: GmailMessageSummary[]; resultSizeEstimate: number }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Authentication required. Please sign in with Google.');

  const qParam = query ? `&q=${encodeURIComponent(query)}` : '';
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}${qParam}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!listRes.ok) {
    const err = await listRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to search messages: ${listRes.statusText}`);
  }

  const listData = await listRes.json();
  const rawList: Array<{ id: string; threadId: string }> = listData.messages || [];

  if (rawList.length === 0) {
    return { messages: [], resultSizeEstimate: 0 };
  }

  // Fetch metadata details for the messages (up to 15 concurrent)
  const summaries: GmailMessageSummary[] = await Promise.all(
    rawList.slice(0, 15).map(async (item) => {
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!msgRes.ok) return { id: item.id, threadId: item.threadId, snippet: '', subject: '(No subject)', from: '', to: '', date: '' };
        const msgData = await msgRes.json();
        const headers: Array<{ name: string; value: string }> = msgData.payload?.headers || [];
        const getH = (n: string) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || '';

        return {
          id: msgData.id,
          threadId: msgData.threadId,
          snippet: msgData.snippet || '',
          subject: getH('Subject') || '(No Subject)',
          from: getH('From') || 'Unknown',
          to: getH('To') || '',
          date: getH('Date') || '',
          isUnread: (msgData.labelIds || []).includes('UNREAD'),
        };
      } catch {
        return { id: item.id, threadId: item.threadId, snippet: '', subject: 'Error loading subject', from: '', to: '', date: '' };
      }
    })
  );

  return {
    messages: summaries,
    resultSizeEstimate: listData.resultSizeEstimate || summaries.length,
  };
}

/**
 * Fetches full message payload
 */
export async function getFullGmailMessage(messageId: string): Promise<GmailMessageFull> {
  const token = await getAccessToken();
  if (!token) throw new Error('Authentication required. Please sign in with Google.');

  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to fetch message: ${res.statusText}`);
  }

  const msg = await res.json();
  const headers: Array<{ name: string; value: string }> = msg.payload?.headers || [];
  const getH = (n: string) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || '';

  let bodyHtml = '';
  let bodyText = '';

  const parsePart = (part: any) => {
    if (part.mimeType === 'text/html' && part.body?.data) {
      bodyHtml = fromBase64Url(part.body.data);
    } else if (part.mimeType === 'text/plain' && part.body?.data) {
      bodyText = fromBase64Url(part.body.data);
    }
    if (part.parts) {
      part.parts.forEach(parsePart);
    }
  };

  if (msg.payload) {
    parsePart(msg.payload);
  }

  return {
    id: msg.id,
    threadId: msg.threadId,
    snippet: msg.snippet || '',
    subject: getH('Subject') || '(No Subject)',
    from: getH('From') || 'Unknown',
    to: getH('To') || '',
    date: getH('Date') || '',
    labels: msg.labelIds || [],
    bodyHtml: bodyHtml || `<pre>${bodyText}</pre>`,
    bodyText,
  };
}

/**
 * Trashes a message in Gmail (Must be protected by user confirmation dialog)
 */
export async function trashGmailMessage(messageId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('Authentication required. Please sign in with Google.');

  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to trash email: ${res.statusText}`);
  }
}

/**
 * Generates rich HTML template for a Minervini SEPA Breakout Alert
 */
export function generateSepaAlertHtml(candidate: MinerviniTradeSetup, triggerType = 'PIVOT_BREAKOUT'): string {
  const isBreakout = triggerType === 'PIVOT_BREAKOUT';
  const headline = isBreakout
    ? `🚨 SEPA PIVOT BREAKOUT ALERT: ${candidate.ticker}`
    : `⚡ SEPA SETUP UPDATE: ${candidate.ticker} (${candidate.vcpStage})`;

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1120; color: #e2e8f0; margin: 0; padding: 24px; }
      .card { background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; max-width: 600px; margin: 0 auto; overflow: hidden; }
      .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-bottom: 2px solid #f59e0b; padding: 20px; text-align: center; }
      .ticker { font-size: 28px; font-weight: 800; color: #fbbf24; letter-spacing: 1px; margin: 0; font-family: monospace; }
      .company { font-size: 14px; color: #94a3b8; margin: 4px 0 0 0; }
      .content { padding: 24px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
      .metric-box { background-color: #0f172a; border: 1px solid #334155; padding: 12px; border-radius: 6px; }
      .label { font-size: 11px; text-transform: uppercase; color: #94a3b8; font-family: monospace; }
      .value { font-size: 16px; font-weight: bold; color: #f8fafc; font-family: monospace; margin-top: 2px; }
      .highlight { color: #10b981; }
      .danger { color: #ef4444; }
      .badge { display: inline-block; padding: 4px 10px; background-color: rgba(245, 158, 11, 0.2); border: 1px solid #f59e0b; color: #fbbf24; font-size: 11px; font-weight: bold; border-radius: 4px; font-family: monospace; }
      .footer { background-color: #0f172a; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="header">
        <span class="badge">${candidate.patternType} • ${candidate.vcpStage}</span>
        <h1 class="ticker">${candidate.ticker} (${candidate.exchange})</h1>
        <p class="company">${candidate.name} • Sector: ${candidate.sector}</p>
      </div>
      <div class="content">
        <h2 style="font-size: 18px; color: #f8fafc; margin-top: 0;">${headline}</h2>
        <p style="font-size: 14px; color: #cbd5e1; line-height: 1.5;">${candidate.sepaNotes}</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #334155; color: #94a3b8;">Current Price</td>
            <td style="padding: 8px; border-bottom: 1px solid #334155; text-align: right; font-weight: bold; color: #f8fafc; font-family: monospace;">$${candidate.currentPrice.toFixed(2)} (${candidate.changePercent >= 0 ? '+' : ''}${candidate.changePercent.toFixed(2)}%)</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #334155; color: #94a3b8;">Pivot Entry</td>
            <td style="padding: 8px; border-bottom: 1px solid #334155; text-align: right; font-weight: bold; color: #10b981; font-family: monospace;">$${candidate.pivotPrice.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #334155; color: #94a3b8;">Stop Loss</td>
            <td style="padding: 8px; border-bottom: 1px solid #334155; text-align: right; font-weight: bold; color: #ef4444; font-family: monospace;">$${candidate.stopLossPrice.toFixed(2)} (${candidate.stopLossPercent}%)</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #334155; color: #94a3b8;">Target 1 (3:1 R/R)</td>
            <td style="padding: 8px; border-bottom: 1px solid #334155; text-align: right; font-weight: bold; color: #fbbf24; font-family: monospace;">$${candidate.target1Price.toFixed(2)} (+${candidate.target1Percent}%)</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #334155; color: #94a3b8;">Relative Strength (RS)</td>
            <td style="padding: 8px; border-bottom: 1px solid #334155; text-align: right; font-weight: bold; color: #f8fafc; font-family: monospace;">${candidate.rsRating} / 99</td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #94a3b8;">Trend Template Score</td>
            <td style="padding: 8px; text-align: right; font-weight: bold; color: #10b981; font-family: monospace;">${candidate.trendScore} / 8 Rules Passed</td>
          </tr>
        </table>
      </div>
      <div class="footer">
        Generated by Minervini SEPA Screener & Gmail Alert Dispatcher.<br/>
        Always honor your hard stop-loss to manage downside risk.
      </div>
    </div>
  </body>
  </html>
  `;
}

/**
 * Generates Daily SEPA Briefing Email HTML
 */
export function generateDailyBriefingHtml(stocks: MinerviniTradeSetup[], userEmail: string): string {
  const topStocks = stocks.slice(0, 5);
  const rows = topStocks
    .map(
      (s) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #334155; font-family: monospace; font-weight: bold; color: #fbbf24;">${s.ticker}</td>
      <td style="padding: 10px; border-bottom: 1px solid #334155;">${s.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #334155; font-family: monospace;">$${s.currentPrice.toFixed(2)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #334155; font-family: monospace; color: #10b981;">$${s.pivotPrice.toFixed(2)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #334155; font-family: monospace; color: #ef4444;">${s.stopLossPercent}%</td>
      <td style="padding: 10px; border-bottom: 1px solid #334155; font-family: monospace; font-weight: bold;">${s.rsRating}</td>
    </tr>
  `
    )
    .join('');

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b1120; color: #e2e8f0; margin: 0; padding: 24px; }
      .card { background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; max-width: 650px; margin: 0 auto; overflow: hidden; }
      .header { background: #0f172a; border-bottom: 2px solid #3b82f6; padding: 24px; text-align: left; }
      .content { padding: 24px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
      th { text-align: left; padding: 10px; background-color: #0f172a; color: #94a3b8; font-size: 11px; text-transform: uppercase; font-family: monospace; }
      .footer { background-color: #0f172a; padding: 16px; text-align: center; font-size: 12px; color: #64748b; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="header">
        <h1 style="font-size: 22px; color: #f8fafc; margin: 0 0 6px 0;">Minervini SEPA Daily Watchlist Digest</h1>
        <p style="font-size: 13px; color: #94a3b8; margin: 0;">Market Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })} • Prepared for: ${userEmail}</p>
      </div>
      <div class="content">
        <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
          Here are your top qualified Minervini Stage 2 leaders currently setting up in tight Volatility Contraction Patterns (VCP) with superior Relative Strength (RS Rating &gt; 80).
        </p>
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Company</th>
              <th>Price</th>
              <th>Pivot</th>
              <th>Risk</th>
              <th>RS</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div style="margin-top: 20px; padding: 14px; background-color: #0f172a; border-left: 4px solid #f59e0b; border-radius: 4px;">
          <p style="font-size: 13px; color: #e2e8f0; margin: 0; font-weight: 500;">
            <strong>Minervini Rule:</strong> Never chase a stock more than 2% to 3% past the true pivot. Always determine your maximum loss threshold before pressing the buy order.
          </p>
        </div>
      </div>
      <div class="footer">
        Automated Dispatch from Minervini SEPA Trading Vault via Gmail API.
      </div>
    </div>
  </body>
  </html>
  `;
}
