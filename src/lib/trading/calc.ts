import { getSpec, type SymbolSpec } from "@/lib/market/symbols";

export type Side = "buy" | "sell";

export interface PriceLike {
  bid: number;
  ask: number;
}

export type PriceMap = Record<string, PriceLike | undefined>;

/** USD value of one unit of `ccy`, using the available quotes. */
export function rateToUSD(ccy: string, prices: PriceMap): number {
  if (ccy === "USD") return 1;
  const direct = prices[`${ccy}USD`];
  if (direct && direct.bid > 0) return direct.bid;
  const inverse = prices[`USD${ccy}`];
  if (inverse && inverse.bid > 0) return 1 / inverse.bid;
  return 1;
}

/** Price at which a position of `side` would close right now. */
export function closePrice(side: Side, p: PriceLike): number {
  return side === "buy" ? p.bid : p.ask;
}

/** Price at which a new position of `side` opens. */
export function openPrice(side: Side, p: PriceLike): number {
  return side === "buy" ? p.ask : p.bid;
}

export function positionProfit(
  pos: { symbol: string; type: Side; volume: number; openPrice: number },
  current: number,
  prices: PriceMap,
): number {
  const spec = getSpec(pos.symbol);
  const dir = pos.type === "buy" ? 1 : -1;
  return (current - pos.openPrice) * dir * pos.volume * spec.contract * rateToUSD(spec.quote, prices);
}

/** USD margin required for a position, standard MT5 forex formula. */
export function marginFor(spec: SymbolSpec, volume: number, price: number, leverage: number, prices: PriceMap) {
  const baseUSD = spec.quote === "USD" ? price : rateToUSD(spec.base, prices);
  return (volume * spec.contract * baseUSD) / leverage;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export interface AccountSummary {
  balance: number;
  profit: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number | null;
}

export function summarize(
  balance: number,
  positions: { symbol: string; type: Side; volume: number; openPrice: number; swap: number }[],
  prices: PriceMap,
  leverage: number,
): AccountSummary {
  let profit = 0;
  let margin = 0;
  for (const p of positions) {
    const q = prices[p.symbol];
    if (!q) continue;
    profit += positionProfit(p, closePrice(p.type, q), prices) + p.swap;
    margin += marginFor(getSpec(p.symbol), p.volume, p.openPrice, leverage, prices);
  }
  const equity = balance + profit;
  return {
    balance,
    profit,
    equity,
    margin,
    freeMargin: equity - margin,
    marginLevel: margin > 0 ? (equity / margin) * 100 : null,
  };
}

/** "1 000.00" style money formatting used by MT5. */
export function fmtMoney(n: number, digits = 2): string {
  const neg = n < 0;
  const fixed = Math.abs(n).toFixed(digits);
  const [int, dec] = fixed.split(".");
  const spaced = int!.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${neg ? "-" : ""}${spaced}${dec !== undefined ? "." + dec : ""}`;
}

export function fmtPrice(n: number, digits: number, spaced = false): string {
  return spaced ? fmtMoney(n, digits) : n.toFixed(digits);
}
