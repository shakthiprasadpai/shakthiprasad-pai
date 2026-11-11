import { DEFAULT_SETTINGS, mergeSettings, type DeskSettings } from "./plan";

// One saved settings record for every dashboard surface (Trade Desk tab and the home-screen desk panel).
// The Chrome extension keeps the same shape in chrome.storage.local.
export const SETTINGS_KEY = "gsa-desk-settings";

export function loadDeskSettings(): DeskSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (raw) return mergeSettings(raw);
    // First run after the merge: pick up what the two old screens saved.
    return mergeSettings({ capital: localStorage.getItem("gsa-dash-capital") ?? undefined, riskPct: localStorage.getItem("gsa-dash-risk") ?? undefined });
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveDeskSettings(s: DeskSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* storage unavailable: the desk still works for this session */ }
}
