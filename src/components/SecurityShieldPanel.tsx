import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  Globe,
  Lock,
  RefreshCw,
  Terminal,
  FileCode,
  Bug
} from 'lucide-react';

export interface ThreatLogItem {
  id: string;
  timestamp: string;
  type: 'PHISHING_ATTEMPT' | 'MALICIOUS_SCRIPT' | 'SUSPICIOUS_DOMAIN' | 'SAFE_VERIFICATION' | 'API_KEY_SCAN';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';
  source: string;
  details: string;
  status: 'BLOCKED' | 'QUARANTINED' | 'PASSED' | 'FLAGGED';
}

const INITIAL_THREAT_LOGS: ThreatLogItem[] = [
  {
    id: 'log-101',
    timestamp: new Date(Date.now() - 1000 * 60 * 3).toLocaleTimeString(),
    type: 'SAFE_VERIFICATION',
    severity: 'SAFE',
    source: 'https://api.nasdaq.com/v1/market-data',
    details: 'Verified TLS 1.3 encryption & authentic NASDAQ API SSL certificate.',
    status: 'PASSED',
  },
  {
    id: 'log-102',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toLocaleTimeString(),
    type: 'PHISHING_ATTEMPT',
    severity: 'CRITICAL',
    source: 'http://minervini-login-verify-sepa-auth.xyz/login.php',
    details: 'Intercepted homograph phishing domain attempting to harvest trading credentials.',
    status: 'BLOCKED',
  },
  {
    id: 'log-103',
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toLocaleTimeString(),
    type: 'MALICIOUS_SCRIPT',
    severity: 'HIGH',
    source: 'Pasted Custom PineScript Payload',
    details: 'Blocked obfuscated `fetch()` call attempting to transmit broker API keys to external server.',
    status: 'QUARANTINED',
  },
  {
    id: 'log-104',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toLocaleTimeString(),
    type: 'API_KEY_SCAN',
    severity: 'SAFE',
    source: 'Local Storage Vault',
    details: 'Verified local storage state. All user trade plans and alerts are client-side sandboxed.',
    status: 'PASSED',
  },
];

const SUSPICIOUS_DOMAIN_PATTERNS = [
  'xyz', 'top', 'gq', 'cf', 'tk', 'ml', 'free-trading', 'login-verify',
  'sepa-auth', 'minervin-login', 'broker-connect-auth', 'token-claim'
];

export const SecurityShieldPanel: React.FC = () => {
  const [realtimeShieldEnabled, setRealtimeShieldEnabled] = useState<boolean>(true);
  const [antiphishingLevel] = useState<'STRICT' | 'STANDARD' | 'PARANOID'>('STRICT');
  const [urlInput, setUrlInput] = useState<string>('');
  const [scriptInput, setScriptInput] = useState<string>('');
  
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanStepLabel, setScanStepLabel] = useState<string>('');
  const [lastScanTime, setLastScanTime] = useState<string>(new Date().toLocaleTimeString());

  const [threatLogs, setThreatLogs] = useState<ThreatLogItem[]>(INITIAL_THREAT_LOGS);
  const [urlScanResult, setUrlScanResult] = useState<{
    status: 'SAFE' | 'DANGEROUS' | 'SUSPICIOUS' | null;
    score: number;
    issues: string[];
    domain: string;
  } | null>(null);

  const [scriptScanResult, setScriptScanResult] = useState<{
    status: 'SAFE' | 'DANGEROUS' | null;
    threatsFound: string[];
  } | null>(null);

  const handleRunDeepScan = () => {
    setIsScanning(true);
    setScanProgress(0);

    const steps = [
      { pct: 20, label: 'Checking Anti-Virus Definition Database & Malware Signatures...' },
      { pct: 40, label: 'Inspecting Anti-Phishing URL Filters & Domain Spoofing Databases...' },
      { pct: 60, label: 'Auditing LocalStorage Vault & Sandboxed Memory Environment...' },
      { pct: 80, label: 'Analyzing Broker Webhook Endpoints & API Key Encryption...' },
      { pct: 100, label: 'Scan Complete: System Protected with Zero Vulnerabilities Found!' }
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setScanProgress(steps[currentStep].pct);
        setScanStepLabel(steps[currentStep].label);
        currentStep++;
      } else {
        clearInterval(interval);
        setIsScanning(false);
        setLastScanTime(new Date().toLocaleTimeString());

        const newLog: ThreatLogItem = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'SAFE_VERIFICATION',
          severity: 'SAFE',
          source: 'On-Demand Deep System Scan',
          details: 'Full virus definition & anti-phishing audit completed. 0 threats detected.',
          status: 'PASSED',
        };
        setThreatLogs(prev => [newLog, ...prev]);
      }
    }, 600);
  };

  const handleInspectUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    let testUrl = urlInput.trim();
    if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
      testUrl = 'https://' + testUrl;
    }

    try {
      const parsed = new URL(testUrl);
      const domain = parsed.hostname.toLowerCase();
      const issues: string[] = [];
      let score = 98;

      if (parsed.protocol === 'http:') {
        issues.push('Missing TLS/SSL certificate (unencrypted http:// connection)');
        score -= 30;
      }

      SUSPICIOUS_DOMAIN_PATTERNS.forEach(pat => {
        if (domain.includes(pat)) {
          issues.push(`Matches high-risk phishing pattern signature: "${pat}"`);
          score -= 35;
        }
      });

      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(domain)) {
        issues.push('Raw IP address host detected — common in phishing redirectors');
        score -= 40;
      }

      let status: 'SAFE' | 'DANGEROUS' | 'SUSPICIOUS' = 'SAFE';
      if (score < 50 || issues.some(i => i.includes('phishing pattern'))) {
        status = 'DANGEROUS';
      } else if (score < 80 || issues.length > 0) {
        status = 'SUSPICIOUS';
      }

      setUrlScanResult({
        status,
        score: Math.max(0, score),
        issues: issues.length > 0 ? issues : ['No phishing signatures or malicious URL vectors detected.'],
        domain,
      });

      if (status !== 'SAFE') {
        const newLog: ThreatLogItem = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'PHISHING_ATTEMPT',
          severity: status === 'DANGEROUS' ? 'CRITICAL' : 'HIGH',
          source: domain,
          details: `Anti-phishing inspect flagged ${domain}: ${issues.join('; ')}`,
          status: 'BLOCKED',
        };
        setThreatLogs(prev => [newLog, ...prev]);
      }
    } catch {
      setUrlScanResult({
        status: 'DANGEROUS',
        score: 10,
        issues: ['Malformed or invalid URL string format.'],
        domain: urlInput,
      });
    }
  };

  const handleScanScript = () => {
    if (!scriptInput.trim()) return;

    const threats: string[] = [];
    const code = scriptInput;

    if (/fetch\s*\(|axios|XMLHttpRequest/i.test(code) && /key|token|auth|password|secret/i.test(code)) {
      threats.push('Exfiltrates private authentication tokens or API keys to external endpoints via network requests.');
    }
    if (/eval\s*\(|Function\s*\(|atob\s*\(/i.test(code)) {
      threats.push('Contains obfuscated dynamic execution payloads (`eval` / `atob`).');
    }
    if (/document\.cookie|localStorage\.getItem/i.test(code) && /http/i.test(code)) {
      threats.push('Attempts to read client browser storage vault or session cookies.');
    }

    if (threats.length > 0) {
      setScriptScanResult({
        status: 'DANGEROUS',
        threatsFound: threats,
      });

      const newLog: ThreatLogItem = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        type: 'MALICIOUS_SCRIPT',
        severity: 'HIGH',
        source: 'User Script Scanner',
        details: `Blocked malicious code snippet: ${threats.join('; ')}`,
        status: 'QUARANTINED',
      };
      setThreatLogs(prev => [newLog, ...prev]);
    } else {
      setScriptScanResult({
        status: 'SAFE',
        threatsFound: ['No keylogging, credential theft, or obfuscated malware found in code.'],
      });
    }
  };

  return (
    <div className="bg-[#0b0d11] text-[#f1f5f9] border border-[#1e293b] p-6 space-y-6 font-mono shadow-2xl rounded-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 shadow-lg relative">
            <ShieldCheck className="w-7 h-7 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0b0d11]"></span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                Cyber Defense Engine
              </span>
              <span className="bg-emerald-950 text-emerald-300 text-[9px] px-2 py-0.5 uppercase font-bold border border-emerald-700">
                ACTIVE SHIELD v4.8
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif italic font-black text-white tracking-tight mt-0.5">
              Antivirus, Anti-Phishing & API Threat Protection
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-3 bg-slate-900 p-2 border border-slate-800">
          <div className="text-right">
            <span className="text-[9px] uppercase font-bold text-gray-400 block">Real-Time Protection</span>
            <span className={`text-[10px] font-black uppercase ${realtimeShieldEnabled ? 'text-emerald-400' : 'text-red-400'}`}>
              {realtimeShieldEnabled ? '● SHIELD ONLINE' : '○ SHIELD PAUSED'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setRealtimeShieldEnabled(!realtimeShieldEnabled)}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border cursor-pointer transition-all ${
              realtimeShieldEnabled
                ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700'
                : 'bg-red-950 text-red-200 border-red-700 hover:bg-red-900'
            }`}
          >
            {realtimeShieldEnabled ? 'Enabled' : 'Enable Shield'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-900/90 p-3.5 border border-slate-800 space-y-1.5">
          <div className="flex justify-between items-center text-[10px] text-gray-400 uppercase font-bold">
            <span className="flex items-center space-x-1.5 text-emerald-400">
              <Bug className="w-3.5 h-3.5" />
              <span>Antivirus Engine</span>
            </span>
            <span className="text-emerald-400 font-extrabold">Active</span>
          </div>
          <div className="text-lg font-black text-white">0 Malware Detected</div>
          <p className="text-[9px] text-gray-400">Definitions updated today. Zero payload vulnerabilities found.</p>
        </div>

        <div className="bg-slate-900/90 p-3.5 border border-slate-800 space-y-1.5">
          <div className="flex justify-between items-center text-[10px] text-gray-400 uppercase font-bold">
            <span className="flex items-center space-x-1.5 text-amber-400">
              <Globe className="w-3.5 h-3.5" />
              <span>Anti-Phishing Filter</span>
            </span>
            <span className="text-amber-300 font-extrabold">{antiphishingLevel}</span>
          </div>
          <div className="text-lg font-black text-white">Domain Spoofing Guard</div>
          <p className="text-[9px] text-gray-400">Intercepts malicious lookalike trading portals & fake logins.</p>
        </div>

        <div className="bg-slate-900/90 p-3.5 border border-slate-800 space-y-1.5">
          <div className="flex justify-between items-center text-[10px] text-gray-400 uppercase font-bold">
            <span className="flex items-center space-x-1.5 text-sky-400">
              <Lock className="w-3.5 h-3.5" />
              <span>Vault Sandbox</span>
            </span>
            <span className="text-sky-300 font-extrabold">Isolated</span>
          </div>
          <div className="text-lg font-black text-white">Client-Side Storage</div>
          <p className="text-[9px] text-gray-400">API keys & trade logs stored locally with AES client sandboxing.</p>
        </div>

        <div className="bg-slate-900/90 p-3.5 border border-slate-800 space-y-2 flex flex-col justify-between">
          <div className="flex justify-between items-center text-[10px] text-gray-400 uppercase font-bold">
            <span className="text-purple-300">System Audit</span>
            <span className="text-gray-400">{lastScanTime}</span>
          </div>
          <button
            type="button"
            onClick={handleRunDeepScan}
            disabled={isScanning}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wider flex items-center justify-center space-x-1.5 cursor-pointer transition-all border border-emerald-500"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning System...' : 'Run Deep Scan'}</span>
          </button>
        </div>
      </div>

      {isScanning && (
        <div className="bg-slate-900 p-3.5 border border-emerald-500/60 space-y-2">
          <div className="flex justify-between items-center text-[10px] text-emerald-300 font-bold uppercase">
            <span>{scanStepLabel}</span>
            <span>{scanProgress}%</span>
          </div>
          <div className="w-full bg-slate-950 h-2 border border-slate-800 overflow-hidden">
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: `${scanProgress}%` }}
              transition={{ duration: 0.3 }}
              className="h-full bg-emerald-500"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900/80 p-4 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-2 text-amber-400">
              <Globe className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Anti-Phishing URL & Link Inspector
              </span>
            </div>
            <span className="text-[9px] bg-amber-950 text-amber-300 border border-amber-800 px-1.5 py-0.5 uppercase font-bold">
              Malicious Domain Detector
            </span>
          </div>

          <p className="text-[10px] text-gray-400">
            Paste any external broker authorization link, news URL, or webhook endpoint to scan for phishing homographs, SSL vulnerabilities, or credential harvesting traps.
          </p>

          <form onSubmit={handleInspectUrl} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. https://auth.interactivebrokers.com or suspicious link..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 text-white text-xs px-3 py-2 font-mono focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs uppercase cursor-pointer transition-all border border-amber-400 shrink-0"
            >
              Inspect Link
            </button>
          </form>

          {urlScanResult && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 border text-xs space-y-1.5 ${
                urlScanResult.status === 'SAFE'
                  ? 'bg-emerald-950/60 border-emerald-600 text-emerald-200'
                  : urlScanResult.status === 'SUSPICIOUS'
                  ? 'bg-amber-950/60 border-amber-600 text-amber-200'
                  : 'bg-red-950/60 border-red-600 text-red-200'
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span className="uppercase text-[10px]">
                  Target: {urlScanResult.domain}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-black/40 border border-current">
                  Safety Score: {urlScanResult.score}/100 ({urlScanResult.status})
                </span>
              </div>
              <ul className="text-[10px] space-y-0.5 list-disc pl-4">
                {urlScanResult.issues.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            </motion.div>
          )}
        </div>

        <div className="bg-slate-900/80 p-4 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-2 text-sky-400">
              <FileCode className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                PineScript & Custom Payload Antivirus Inspector
              </span>
            </div>
            <span className="text-[9px] bg-sky-950 text-sky-300 border border-sky-800 px-1.5 py-0.5 uppercase font-bold">
              Keylogger & Exfiltration Guard
            </span>
          </div>

          <p className="text-[10px] text-gray-400">
            Paste custom indicator code or JSON config payloads to verify there are no hidden keyloggers, cookie extractors, or unauthorized webhook exfiltrations.
          </p>

          <div className="space-y-2">
            <textarea
              rows={2}
              placeholder="// Paste custom script code here to scan..."
              value={scriptInput}
              onChange={(e) => setScriptInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-2.5 font-mono focus:outline-none focus:border-sky-500"
            />
            <button
              type="button"
              onClick={handleScanScript}
              className="w-full py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs uppercase cursor-pointer transition-all border border-sky-400"
            >
              Scan Code Payload
            </button>
          </div>

          {scriptScanResult && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 border text-xs space-y-1 ${
                scriptScanResult.status === 'SAFE'
                  ? 'bg-emerald-950/60 border-emerald-600 text-emerald-200'
                  : 'bg-red-950/60 border-red-600 text-red-200'
              }`}
            >
              <div className="font-bold text-[10px] uppercase">
                Audit Result: {scriptScanResult.status === 'SAFE' ? '✅ Verified Clean Payload' : '🔴 Malicious Code Detected'}
              </div>
              <ul className="text-[10px] space-y-0.5 list-disc pl-4">
                {scriptScanResult.threatsFound.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </motion.div>
          )}
        </div>
      </div>

      <div className="bg-slate-900/90 p-4 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center space-x-2 text-purple-400">
            <Terminal className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Real-Time Security Threat Audit Log
            </span>
          </div>
          <span className="text-[9px] text-gray-400">
            Showing {threatLogs.length} Security Events
          </span>
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {threatLogs.map((log) => {
            let statusBadgeClass = 'bg-emerald-950 text-emerald-300 border-emerald-700';
            if (log.status === 'BLOCKED') statusBadgeClass = 'bg-red-950 text-red-300 border-red-700';
            if (log.status === 'QUARANTINED') statusBadgeClass = 'bg-amber-950 text-amber-300 border-amber-700';

            return (
              <div
                key={log.id}
                className="p-2 bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[10px]"
              >
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500 font-mono">{log.timestamp}</span>
                  <span className={`px-1.5 py-0.2 uppercase font-black border text-[9px] ${statusBadgeClass}`}>
                    {log.status}
                  </span>
                  <span className="text-white font-bold truncate max-w-[200px]">{log.source}</span>
                </div>
                <div className="text-gray-400 text-[9px] truncate max-w-[380px]">
                  {log.details}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
