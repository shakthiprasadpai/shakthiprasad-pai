import TradeDeskView from "../../src/components/TradeDeskView";

// Inside claude.ai the co-pilot is Claude, through the page's "sample" capability. Everything else is the repo's TradeDeskView.
const sampleOf = () => (window as any).claude?.use?.("sample");
const askClaude = async (messages: any[], onText?: (t: string) => void) => {
  const sample = await sampleOf();
  if (!sample) throw Object.assign(new Error("unavailable"), { code: "unavailable" });
  const r = await sample(messages, { cache: false, onText: ({ text }: { text: string }) => onText?.(text) });
  return typeof r === "string" ? r : r.text;
};
const checkReady = async () => !!(await sampleOf());

(window as any).ReactDOM.createRoot(document.getElementById("root")).render(<TradeDeskView askModel={askClaude} checkReady={checkReady} />);
