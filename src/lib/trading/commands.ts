import { getSpec } from "@/lib/market/symbols";
import type { Side } from "./calc";
import { engineTick, startEngine, stopEngineNow } from "./engine";
import { balanceOperation, closePositions, computeDisplay, initialState, openPosition } from "./ops";
import type { Account, AdminConfig, ClosedPosition, Deal, JournalEntry, OrderRec, RealQuote, TerminalState } from "./types";

/** Everything a phone can ask the shared terminal to do. */
export type Command =
  | { t: "open"; symbol: string; side: Side; volume: number }
  | { t: "close"; tickets: number[] }
  | { t: "admin"; patch: Partial<AdminConfig> }
  | { t: "account"; patch: Partial<Pick<Account, "name" | "login" | "server" | "leverage">> }
  | { t: "start" }
  | { t: "pause" }
  | { t: "resume" }
  | { t: "stop" }
  | { t: "setBalance"; value: number }
  | { t: "reset"; value: number };

const ADMIN_ONLY = new Set<Command["t"]>(["admin", "account", "start", "pause", "resume", "stop", "setBalance", "reset"]);

export function needsAdmin(cmd: Command): boolean {
  return ADMIN_ONLY.has(cmd.t);
}

export interface CommandResult {
  ticket?: number | null;
  profit?: number;
  count?: number;
}

export function applyCommand(s: TerminalState, cmd: Command, now: number): { state: TerminalState; result: CommandResult } {
  switch (cmd.t) {
    case "open": {
      const { state, ticket } = openPosition(s, cmd.symbol, cmd.side, cmd.volume, now);
      return { state, result: { ticket } };
    }
    case "close": {
      const tickets = cmd.tickets.filter((t) => s.positions.some((p) => p.ticket === t));
      const res = closePositions(s, tickets, now);
      return { state: res.state, result: { profit: res.profit, count: tickets.length } };
    }
    case "admin": {
      const admin = { ...s.admin, ...cmd.patch };
      const live = s.engine.status !== "idle" && s.engine.status !== "finished";
      return {
        state: { ...s, admin, engine: live ? { ...s.engine, config: { ...s.engine.config, ...cmd.patch } } : s.engine },
        result: {},
      };
    }
    case "account":
      return { state: { ...s, account: { ...s.account, ...cmd.patch } }, result: {} };
    case "start":
      return { state: startEngine(s, now), result: {} };
    case "pause":
      return {
        state:
          s.engine.status === "scheduled"
            ? { ...s, engine: { ...s.engine, status: "idle", startAt: null } }
            : s.engine.status === "running"
              ? { ...s, engine: { ...s.engine, status: "stopping" } }
              : s,
        result: {},
      };
    case "resume":
      return { state: s.engine.status === "stopping" ? { ...s, engine: { ...s.engine, status: "running" } } : s, result: {} };
    case "stop":
      return { state: stopEngineNow(s, now), result: {} };
    case "setBalance":
      return { state: balanceOperation(s, cmd.value - s.account.balance, now), result: {} };
    case "reset": {
      const fresh = initialState(now);
      const deals = fresh.deals.map((d) => ({ ...d, profit: cmd.value }));
      return {
        state: {
          ...s,
          positions: [],
          history: [],
          orders: [],
          deals,
          journal: [],
          offsets: {},
          nextTicket: fresh.nextTicket,
          account: { ...s.account, balance: cmd.value },
          engine: { ...fresh.engine, config: s.admin },
          epoch: s.epoch + 1,
          display: computeDisplay({ ...s, offsets: {} }),
        },
        result: {},
      };
    }
  }
}

export interface MarketQuote {
  symbol: string;
  price: number;
  prevClose: number;
  high: number;
  low: number;
}

/** Put fresh market prices into the state and recompute what the app shows. */
export function withRealQuotes(s: TerminalState, quotes: MarketQuote[], now: number, rnd: () => number = Math.random): TerminalState {
  if (quotes.length === 0) return s;
  const real: Record<string, RealQuote> = { ...s.real };
  for (const q of quotes) {
    const d = getSpec(q.symbol).digits;
    // Sources give fewer decimals than MT5 shows; keep the last digit alive within one point.
    const jitter = d >= 3 ? Math.round((rnd() - 0.5) * 3) * Math.pow(10, -d) : 0;
    real[q.symbol] = {
      bid: Number((q.price + jitter).toFixed(d)),
      prevClose: q.prevClose,
      high: q.high,
      low: q.low,
      time: now,
    };
  }
  const ns = { ...s, real };
  return { ...ns, display: computeDisplay(ns) };
}

/** Run the simulation from the last step up to `now`, in steps of about a second. */
export function advanceTo(input: TerminalState, now: number, rnd: () => number = Math.random): TerminalState {
  const last = input.lastTick || now;
  const gap = now - last;
  if (gap <= 0) return input;
  const steps = Math.min(240, Math.max(1, Math.ceil(gap / 1000)));
  const dt = gap / steps;
  let s = input;
  for (let i = 1; i <= steps; i++) s = engineTick(s, Math.round(last + dt * i), rnd, dt);
  return { ...s, lastTick: now };
}

/* ---------- splitting state between the shared record and the history log ---------- */

export type LogKind = "deal" | "order" | "history" | "journal";
export type LogData = Deal | OrderRec | ClosedPosition | JournalEntry;
export interface LogRow {
  kind: LogKind;
  data: LogData;
}
export interface LogEntry extends LogRow {
  id: number;
}

/** Parts of the state that every phone shares (history lists live in the log). */
export type SharedState = Pick<
  TerminalState,
  "real" | "display" | "offsets" | "account" | "positions" | "admin" | "engine" | "nextTicket" | "epoch" | "lastTick"
>;

export function toShared(s: TerminalState): SharedState {
  return {
    real: s.real,
    display: s.display,
    offsets: s.offsets,
    account: s.account,
    positions: s.positions,
    admin: s.admin,
    engine: s.engine,
    nextTicket: s.nextTicket,
    epoch: s.epoch,
    lastTick: s.lastTick,
  };
}

/** Rebuild a full working state from the shared record (history lists start empty). */
export function fromShared(sh: Partial<SharedState>, now: number): TerminalState {
  const base = initialState(now);
  return {
    ...base,
    ...sh,
    admin: { ...base.admin, ...(sh.admin ?? {}) },
    account: { ...base.account, ...(sh.account ?? {}) },
    engine: { ...base.engine, ...(sh.engine ?? {}), config: { ...base.admin, ...(sh.engine?.config ?? {}) } },
    hydrated: true,
    deals: [],
    orders: [],
    history: [],
    journal: [],
  };
}

/** New history items produced since the lists were emptied, oldest first. */
export function collectLogs(s: TerminalState): LogRow[] {
  const rows: LogRow[] = [];
  const push = (kind: LogKind, list: LogData[]) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const data = list[i];
      if (data) rows.push({ kind, data });
    }
  };
  push("deal", s.deals);
  push("order", s.orders);
  push("history", s.history);
  push("journal", s.journal);
  return rows;
}

const LIMITS: Record<LogKind, number> = { deal: 5000, order: 5000, history: 5000, journal: 400 };

/** Merge log rows (any order) into newest-first lists. */
export function mergeLogs(
  s: Pick<TerminalState, "deals" | "orders" | "history" | "journal">,
  rows: LogEntry[],
): Pick<TerminalState, "deals" | "orders" | "history" | "journal"> {
  if (rows.length === 0) return { deals: s.deals, orders: s.orders, history: s.history, journal: s.journal };
  const sorted = [...rows].sort((a, b) => b.id - a.id);
  const pick = <T>(kind: LogKind) => sorted.filter((r) => r.kind === kind).map((r) => r.data as T);
  const cap = <T>(kind: LogKind, fresh: T[], old: T[]) => (fresh.length ? [...fresh, ...old].slice(0, LIMITS[kind]) : old);
  return {
    deals: cap("deal", pick<Deal>("deal"), s.deals),
    orders: cap("order", pick<OrderRec>("order"), s.orders),
    history: cap("history", pick<ClosedPosition>("history"), s.history),
    journal: cap("journal", pick<JournalEntry>("journal"), s.journal),
  };
}

