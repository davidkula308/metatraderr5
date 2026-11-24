import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getQuotes } from "@/lib/market/market.functions";
import { getSpec } from "@/lib/market/symbols";
import { engineTick } from "@/lib/trading/engine";
import { applyRealQuotes, hydrate, nowMs, setClockSkew, setState } from "@/lib/trading/store";

/** Polls live prices and drives the trade simulation while the app is open. */
export function TerminalRunner() {
  const fetchQuotes = useServerFn(getQuotes);

  useEffect(() => {
    hydrate();
    let alive = true;
    let skewSet = false;
    const poll = async () => {
      const sent = Date.now();
      try {
        const r = await fetchQuotes();
        if (!alive) return;
        if (!skewSet) {
          setClockSkew(r.serverTime - (sent + Date.now()) / 2);
          skewSet = true;
        }
        applyRealQuotes(r.quotes, (s) => getSpec(s).digits);
      } catch {
        /* keep last prices */
      }
    };
    void poll();
    const pollId = setInterval(poll, 2500);
    const tickId = setInterval(() => {
      setState((s) => (s.hydrated ? engineTick(s, nowMs()) : s));
    }, 500);
    return () => {
      alive = false;
      clearInterval(pollId);
      clearInterval(tickId);
    };
  }, [fetchQuotes]);

  return null;
}
