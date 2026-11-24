import { getSpec, point, SYMBOLS } from "@/lib/market/symbols";
import { closePrice, openPrice, positionProfit, round2, type PriceMap, type Side } from "./calc";
import type { AdminConfig, Position, Quote, TerminalState } from "./types";

export const DEFAULT_ADMIN: AdminConfig = {
  symbol: "XAUUSD",
  trades: 6,
  lot: 0.01,
  direction: "random",
  closeOn: "profit",
  targetType: "amount",
  targetValue: 2,
  maxFloating: 6,
  firstPhase: { value: 30, unit: "seconds" },
  mode: "auto",
  runFor: "untilPaused",
  runDuration: { value: 30, unit: "minutes" },
  startMode: "now",
  startRelative: { value: 10, unit: "seconds" },
  startTz: "Africa/Nairobi",
  startDate: "",
  startTime: "",
  batchDelay: { value: 10, unit: "seconds" },
  useTpSl: false,
};

export function initialState(now = Date.now()): TerminalState {
  const first = 54_812_000 + Math.floor((now / 1000) % 100000);
  return {
    hydrated: false,
    real: {},
    display: {},
    offsets: {},
    account: { name: "David Mbuvi", login: "6541308", server: "Headway-Demo", leverage: 2000, balance: 1000 },
    positions: [],
    history: [],
    deals: [
      {
        ticket: first,
        order: 0,
        time: now,
        symbol: null,
        type: "balance",
        entry: null,
        volume: 0,
        price: 0,
        profit: 1000,
        comment: "D-DemoDeposit-USD",
      },
    ],
    orders: [],
    journal: [],
    quotesList: SYMBOLS.map((s) => s.name),
    chart: { symbol: "XAUUSD", tf: "M5", lot: 0.01 },
    settings: { advancedMode: true, oneClick: true, orderSounds: true, vibration: true, notifications: true },
    admin: { ...DEFAULT_ADMIN },
    engine: {
      status: "idle",
      startAt: null,
      endAt: null,
      nextBatchAt: null,
      batch: null,
      batchesDone: 0,
      totalProfit: 0,
      config: { ...DEFAULT_ADMIN },
    },
    nextTicket: first + 1,
    epoch: 1,
    lastTick: now,
  };
}

/** Recompute the displayed quotes (real price + simulation offset). */
export function computeDisplay(s: TerminalState): Record<string, Quote> {
  const out: Record<string, Quote> = {};
  for (const [sym, r] of Object.entries(s.real)) {
    const spec = getSpec(sym);
    const bid = Number((r.bid + (s.offsets[sym] ?? 0)).toFixed(spec.digits));
    const prev = s.display[sym];
    const dir: 1 | -1 | 0 = prev ? (bid > prev.bid ? 1 : bid < prev.bid ? -1 : prev.dir) : 0;
    out[sym] = {
      symbol: sym,
      bid,
      ask: Number((bid + spec.spread * point(spec)).toFixed(spec.digits)),
      prevClose: r.prevClose,
      high: Math.max(r.high, bid),
      low: Math.min(r.low, bid),
      time: r.time,
      dir,
    };
  }
  return out;
}

export function priceMap(s: TerminalState): PriceMap {
  return s.display;
}

export function log(s: TerminalState, message: string, source = "Trades", time = Date.now()): TerminalState {
  const journal = [{ time, source, message }, ...s.journal].slice(0, 400);
  return { ...s, journal };
}

export function openPosition(
  s: TerminalState,
  symbol: string,
  side: Side,
  volume: number,
  now: number,
  sim = false,
): { state: TerminalState; ticket: number | null } {
  const q = s.display[symbol];
  if (!q || volume <= 0) return { state: s, ticket: null };
  const spec = getSpec(symbol);
  const price = Number(openPrice(side, q).toFixed(spec.digits));
  const order = s.nextTicket;
  const deal = s.nextTicket + 1;
  const pos: Position = {
    ticket: order,
    symbol,
    type: side,
    volume,
    openPrice: price,
    openTime: now,
    sl: 0,
    tp: 0,
    swap: 0,
    commission: 0,
    sim,
  };
  let st: TerminalState = {
    ...s,
    positions: [...s.positions, pos],
    orders: [{ ticket: order, time: now, doneTime: now, symbol, type: side, volume, price }, ...s.orders],
    deals: [
      { ticket: deal, order, time: now, symbol, type: side, entry: "in", volume, price, profit: 0, comment: "" },
      ...s.deals,
    ],
    nextTicket: s.nextTicket + 2,
  };
  const login = s.account.login;
  st = log(st, `'${login}': market ${side} ${volume.toFixed(2)} ${symbol}`, "Trades", now);
  st = log(
    st,
    `'${login}': order #${order} ${side} ${volume.toFixed(2)} at market done in ${40 + Math.floor(Math.random() * 90)} ms`,
    "Trades",
    now,
  );
  return { state: st, ticket: order };
}

export function closePositions(s: TerminalState, tickets: number[], now: number): { state: TerminalState; profit: number } {
  const set = new Set(tickets);
  const closing = s.positions.filter((p) => set.has(p.ticket));
  if (closing.length === 0) return { state: s, profit: 0 };
  const prices = priceMap(s);
  let total = 0;
  let ticket = s.nextTicket;
  const deals = [...s.deals];
  const orders = [...s.orders];
  const history = [...s.history];
  let st = s;
  for (const p of closing) {
    const q = prices[p.symbol];
    if (!q) continue;
    const spec = getSpec(p.symbol);
    const cp = Number(closePrice(p.type, q).toFixed(spec.digits));
    const profit = round2(positionProfit(p, cp, prices));
    total += profit + p.swap + p.commission;
    const closeSide: Side = p.type === "buy" ? "sell" : "buy";
    orders.unshift({ ticket, time: now, doneTime: now, symbol: p.symbol, type: closeSide, volume: p.volume, price: cp });
    deals.unshift({
      ticket: ticket + 1,
      order: ticket,
      time: now,
      symbol: p.symbol,
      type: closeSide,
      entry: "out",
      volume: p.volume,
      price: cp,
      profit,
      comment: "",
    });
    history.unshift({ ...p, closePrice: cp, closeTime: now, profit });
    st = log(
      st,
      `'${s.account.login}': position #${p.ticket} ${p.type} ${p.volume.toFixed(2)} ${p.symbol} closed at ${cp.toFixed(spec.digits)}, profit ${profit.toFixed(2)}`,
      "Trades",
      now,
    );
    ticket += 2;
  }
  total = round2(total);
  st = {
    ...st,
    positions: s.positions.filter((p) => !set.has(p.ticket)),
    deals,
    orders,
    history,
    nextTicket: ticket,
    account: { ...s.account, balance: round2(s.account.balance + total) },
  };
  return { state: st, profit: total };
}

export function balanceOperation(s: TerminalState, amount: number, now: number, comment?: string): TerminalState {
  if (!Number.isFinite(amount) || amount === 0) return s;
  return {
    ...s,
    deals: [
      {
        ticket: s.nextTicket,
        order: 0,
        time: now,
        symbol: null,
        type: "balance",
        entry: null,
        volume: 0,
        price: 0,
        profit: round2(amount),
        comment: comment ?? (amount > 0 ? "D-Deposit-USD" : "W-Withdrawal-USD"),
      },
      ...s.deals,
    ],
    nextTicket: s.nextTicket + 1,
    account: { ...s.account, balance: round2(s.account.balance + amount) },
  };
}
