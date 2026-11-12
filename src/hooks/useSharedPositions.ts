import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { sanitizePositions, type Position } from "../core/desk/tracker";
import { loadPositions, savePositions, canonPositions } from "../core/desk/positionsStore";

type Positions = Record<string, Position>;
const POLL_MS = 3000, QUIET_MS = 1500;

/**
 * Open positions for the Trade Desk. They always live in this browser (localStorage). When the dev server is running on this
 * computer they are also kept in ~/.trade_desk/positions.json, the file the desk command line uses, so `track update` in a
 * terminal shows up here within a few seconds and an edit here shows up in `dash --watch`. Without the server it is browser-only.
 */
export function useSharedPositions(): [Positions, Dispatch<SetStateAction<Positions>>, boolean] {
  const [positions, setPositionsState] = useState<Positions>(() => loadPositions());
  const [shared, setShared] = useState(false);
  const synced = useRef<string | null>(null);   // the version the file is known to hold
  const edited = useRef(0);                      // when this browser last changed something
  const first = useRef(true);
  const latest = useRef(positions);
  latest.current = positions;

  const setPositions: Dispatch<SetStateAction<Positions>> = useCallback((v) => { edited.current = Date.now(); setPositionsState(v); }, []);

  // browser copy
  useEffect(() => { savePositions(positions); }, [positions]);

  // push local changes to the file
  useEffect(() => {
    if (!shared) return;
    const c = canonPositions(positions);
    if (c === synced.current) return;
    synced.current = c;
    fetch("/api/desk/positions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ positions }) })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); }, () => { throw new Error("offline"); })
      .catch(() => { synced.current = null; setShared(false); });
  }, [positions, shared]);

  // pull changes made elsewhere (the terminal)
  useEffect(() => {
    let stop = false;
    const pull = async () => {
      try {
        const r = await fetch("/api/desk/positions", { cache: "no-store" });
        if (!r.ok || !(r.headers.get("content-type") || "").includes("json")) throw new Error("no server");
        const remote = sanitizePositions((await r.json()).positions);
        if (stop) return;
        const rc = canonPositions(remote), local = latest.current;
        if (first.current) {
          first.current = false;
          // the file is the source of truth, but an empty file must not wipe positions that only this browser has
          if (!Object.keys(remote).length && Object.keys(local).length) { synced.current = null; }
          else { synced.current = rc; setPositionsState(remote); }
        } else if (rc !== synced.current && Date.now() - edited.current > QUIET_MS && rc !== canonPositions(local)) {
          synced.current = rc; setPositionsState(remote);
        }
        setShared(true);
      } catch { if (!stop) setShared(false); }
    };
    pull();
    const id = setInterval(pull, POLL_MS);
    const onFocus = () => { pull(); };
    window.addEventListener("focus", onFocus);
    return () => { stop = true; clearInterval(id); window.removeEventListener("focus", onFocus); };
  }, []);

  return [positions, setPositions, shared];
}
