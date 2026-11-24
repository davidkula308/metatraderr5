export type SymbolKind = "fx" | "metal" | "crypto";

export interface SymbolSpec {
  name: string;
  description: string;
  yahoo: string;
  digits: number;
  contract: number;
  spread: number; // in points
  base: string;
  quote: string;
  kind: SymbolKind;
  spot?: "XAU" | "XAG";
}

const fx = (name: string, description: string, digits: number, spread: number): SymbolSpec => ({
  name,
  description,
  yahoo: `${name}=X`,
  digits,
  contract: 100000,
  spread,
  base: name.slice(0, 3),
  quote: name.slice(3, 6),
  kind: "fx",
});

export const SYMBOLS: SymbolSpec[] = [
  fx("AUDCAD", "Australian Dollar vs Canadian Dollar", 5, 16),
  fx("AUDCHF", "Australian Dollar vs Swiss Franc", 5, 11),
  fx("AUDJPY", "Australian Dollar vs Japanese Yen", 3, 16),
  fx("AUDNZD", "Australian Dollar vs New Zealand Dollar", 5, 12),
  fx("AUDUSD", "Australian Dollar vs US Dollar", 5, 11),
  fx("CADCHF", "Canadian Dollar vs Swiss Franc", 5, 12),
  fx("CADJPY", "Canadian Dollar vs Japanese Yen", 3, 19),
  fx("CHFJPY", "Swiss Franc vs Japanese Yen", 3, 17),
  fx("EURAUD", "Euro vs Australian Dollar", 5, 18),
  fx("EURGBP", "Euro vs Great Britain Pound", 5, 12),
  fx("EURJPY", "Euro vs Japanese Yen", 3, 15),
  fx("EURUSD", "Euro vs US Dollar", 5, 12),
  fx("GBPJPY", "Great Britain Pound vs Japanese Yen", 3, 22),
  fx("GBPUSD", "Great Britain Pound vs US Dollar", 5, 15),
  fx("NZDUSD", "New Zealand Dollar vs US Dollar", 5, 18),
  fx("USDCAD", "US Dollar vs Canadian Dollar", 5, 18),
  fx("USDCHF", "US Dollar vs Swiss Franc", 5, 16),
  fx("USDJPY", "US Dollar vs Japanese Yen", 3, 14),
  {
    name: "XAGUSD",
    description: "Silver vs US Dollar",
    yahoo: "SI=F",
    digits: 3,
    contract: 5000,
    spread: 30,
    base: "XAG",
    quote: "USD",
    kind: "metal",
    spot: "XAG",
  },
  {
    name: "XAUUSD",
    description: "Gold vs US Dollar",
    yahoo: "GC=F",
    digits: 2,
    contract: 100,
    spread: 36,
    base: "XAU",
    quote: "USD",
    kind: "metal",
    spot: "XAU",
  },
  {
    name: "BTCUSD",
    description: "Bitcoin vs US Dollar",
    yahoo: "BTC-USD",
    digits: 2,
    contract: 1,
    spread: 1500,
    base: "BTC",
    quote: "USD",
    kind: "crypto",
  },
];

export const SYMBOL_MAP: Record<string, SymbolSpec> = Object.fromEntries(
  SYMBOLS.map((s) => [s.name, s]),
);

export function getSpec(name: string): SymbolSpec {
  return SYMBOL_MAP[name] ?? SYMBOL_MAP["XAUUSD"]!;
}

export const point = (spec: SymbolSpec) => Math.pow(10, -spec.digits);

export const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const TF_SECONDS: Record<Timeframe, number> = {
  M1: 60,
  M5: 300,
  M15: 900,
  M30: 1800,
  H1: 3600,
  H4: 14400,
  D1: 86400,
  W1: 604800,
  MN: 2592000,
};

const COUNTRY: Record<string, string> = {
  AUD: "au",
  CAD: "ca",
  CHF: "ch",
  JPY: "jp",
  NZD: "nz",
  USD: "us",
  EUR: "eu",
  GBP: "gb",
};

export function flagUrl(ccy: string): string | null {
  const c = COUNTRY[ccy];
  return c ? `https://flagcdn.com/w80/${c}.png` : null;
}
