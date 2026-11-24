import { useSyncExternalStore } from "react";
import { computeDisplay, initialState } from "./ops";
import type { RealQuote, TerminalState } from "./types";

const KEY = "mt5sim:v1";

let state: TerminalState = initialState(0);
const serverState = state;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let clockSkew = 0;

export function nowMs() {
  return Date.now() + clockSkew;
}

export function setClockSkew(ms: number) {
  clockSkew = ms;
}

function persist() {
  if (typeof window === "undefined" || !state.hydrated) return;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const { real: _r, display: _d, hydrated: _h, ...rest } = state;
    try {
      localStorage.setItem(KEY, JSON.stringify(rest));
    } catch {
      /* storage full or disabled */
    }
  }, 700);
}

export function getState() {
  return state;
}

export function setState(updater: (s: TerminalState) => TerminalState) {
  const next = updater(state);
  if (next === state) return;
  state = next;
  persist();
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useTerminal(): TerminalState {
  return useSyncExternalStore(subscribe, getState, () => serverState);
}

export function hydrate() {
  if (state.hydrated) return;
  const base = initialState(Date.now());
  let loaded: Partial<TerminalState> = {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) loaded = JSON.parse(raw) as Partial<TerminalState>;
  } catch {
    loaded = {};
  }
  setState(() => ({
    ...base,
    ...loaded,
    admin: { ...base.admin, ...(loaded.admin ?? {}) },
    settings: { ...base.settings, ...(loaded.settings ?? {}) },
    account: { ...base.account, ...(loaded.account ?? {}) },
    real: {},
    display: {},
    hydrated: true,
  }));
}

export function applyRealQuotes(quotes: { symbol: string; price: number; prevClose: number; high: number; low: number; time: number }[], digitsOf: (s: string) => number) {
  setState((s) => {
    const real: Record<string, RealQuote> = { ...s.real };
    for (const q of quotes) {
      const d = digitsOf(q.symbol);
      // Sources give fewer decimals than MT5 shows; keep the last digit alive within one point.
      const jitter = d >= 3 ? Math.round((Math.random() - 0.5) * 3) * Math.pow(10, -d) : 0;
      real[q.symbol] = {
        bid: Number((q.price + jitter).toFixed(d)),
        prevClose: q.prevClose,
        high: q.high,
        low: q.low,
        time: Date.now(),
      };
    }
    const ns = { ...s, real };
    return { ...ns, display: computeDisplay(ns) };
  });
}

export function isAdminUnlocked() {
  return typeof window !== "undefined" && sessionStorage.getItem("mt5sim:admin") === "1";
}

export function unlockAdmin(code: string) {
  if (code === "4030") {
    sessionStorage.setItem("mt5sim:admin", "1");
    return true;
  }
  return false;
}
