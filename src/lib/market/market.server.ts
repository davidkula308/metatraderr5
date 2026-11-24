import { SYMBOLS, TF_SECONDS, getSpec, type Timeframe } from "./symbols";

const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36";

export interface RealQuote {
  symbol: string;
  price: number;
  prevClose: number;
  high: number;
  low: number;
  time: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

type SparkEntry = {
  close?: (number | null)[];
  timestamp?: number[];
  previousClose?: number;
  chartPreviousClose?: number;
};

let quoteCache: { at: number; data: RealQuote[] } | null = null;
const candleCache = new Map<string, { at: number; data: Candle[] }>();

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchSpot(metal: "XAU" | "XAG"): Promise<number | null> {
  const d = await fetchJson<{ price?: number }>(`https://api.gold-api.com/price/${metal}`);
  return d && typeof d.price === "number" && d.price > 0 ? d.price : null;
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** TradingView ticker for each app symbol (primary live source, no key needed). */
function tvTicker(name: string): string {
  if (name === "XAUUSD") return "OANDA:XAUUSD";
  if (name === "XAGUSD") return "TVC:SILVER";
  if (name === "BTCUSD") return "BITSTAMP:BTCUSD";
  return `FX_IDC:${name}`;
}

async function fetchTradingView(): Promise<RealQuote[]> {
  try {
    const tickers = SYMBOLS.map((s) => tvTicker(s.name));
    const res = await fetch("https://scanner.tradingview.com/global/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({ symbols: { tickers }, columns: ["close", "high", "low", "change"] }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { s: string; d: (number | null)[] }[] };
    const byTicker = new Map((json.data ?? []).map((r) => [r.s, r.d]));
    const out: RealQuote[] = [];
    for (const spec of SYMBOLS) {
      const d = byTicker.get(tvTicker(spec.name));
      const close = d?.[0];
      if (typeof close !== "number" || !(close > 0)) continue;
      const high = typeof d?.[1] === "number" ? d[1] : close;
      const low = typeof d?.[2] === "number" ? d[2] : close;
      const change = typeof d?.[3] === "number" ? d[3] : 0;
      out.push({ symbol: spec.name, price: close, prevClose: close / (1 + change / 100), high, low, time: Date.now() });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchYahooQuotes(names: Set<string>): Promise<RealQuote[]> {
  const specs = SYMBOLS.filter((s) => names.has(s.name));
  if (specs.length === 0) return [];
  const groups = chunk(specs, 10);
  const [sparks, xau, xag] = await Promise.all([
    Promise.all(
      groups.map((g) =>
        fetchJson<Record<string, SparkEntry>>(
          `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodeURIComponent(
            g.map((s) => s.yahoo).join(","),
          )}&range=1d&interval=5m`,
        ),
      ),
    ),
    specs.some((s) => s.spot === "XAU") ? fetchSpot("XAU") : Promise.resolve(null),
    specs.some((s) => s.spot === "XAG") ? fetchSpot("XAG") : Promise.resolve(null),
  ]);
  const merged: Record<string, SparkEntry> = Object.assign({}, ...sparks.map((s) => s ?? {}));
  const out: RealQuote[] = [];
  for (const spec of specs) {
    const e = merged[spec.yahoo];
    const closes = (e?.close ?? []).filter((c): c is number => typeof c === "number");
    const last = closes.at(-1);
    const spot = spec.spot === "XAU" ? xau : spec.spot === "XAG" ? xag : null;
    if (last === undefined) {
      if (spot) out.push({ symbol: spec.name, price: spot, prevClose: spot, high: spot, low: spot, time: Date.now() });
      continue;
    }
    const shift = spot ? spot - last : 0;
    const prev = (e?.previousClose ?? e?.chartPreviousClose ?? closes[0] ?? last) + shift;
    out.push({
      symbol: spec.name,
      price: last + shift,
      prevClose: prev,
      high: Math.max(...closes) + shift,
      low: Math.min(...closes) + shift,
      time: Date.now(),
    });
  }
  return out;
}

export async function fetchQuotes(): Promise<RealQuote[]> {
  if (quoteCache && Date.now() - quoteCache.at < 1500) return quoteCache.data;

  const primary = await fetchTradingView();
  const missing = new Set(SYMBOLS.map((s) => s.name).filter((n) => !primary.some((q) => q.symbol === n)));
  const backup = missing.size > 0 ? await fetchYahooQuotes(missing) : [];
  const out = [...primary, ...backup];
  if (out.length > 0) quoteCache = { at: Date.now(), data: out };
  return out.length > 0 ? out : (quoteCache?.data ?? []);
}

const TF_QUERY: Record<Timeframe, { interval: string; range: string; group: number }> = {
  M1: { interval: "1m", range: "1d", group: 1 },
  M5: { interval: "5m", range: "5d", group: 1 },
  M15: { interval: "15m", range: "5d", group: 1 },
  M30: { interval: "30m", range: "1mo", group: 1 },
  H1: { interval: "60m", range: "1mo", group: 1 },
  H4: { interval: "60m", range: "3mo", group: 4 },
  D1: { interval: "1d", range: "2y", group: 1 },
  W1: { interval: "1wk", range: "5y", group: 1 },
  MN: { interval: "1mo", range: "10y", group: 1 },
};

type ChartResp = {
  chart?: {
    result?: {
      timestamp?: number[];
      indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[] }[] };
    }[];
  };
};

async function fetchYahooCandles(symbol: string, tf: Timeframe): Promise<Candle[]> {
  const spec = getSpec(symbol);
  const q = TF_QUERY[tf];
  const [data, spot] = await Promise.all([
    fetchJson<ChartResp>(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(spec.yahoo)}?interval=${q.interval}&range=${q.range}`,
    ),
    spec.spot ? fetchSpot(spec.spot) : Promise.resolve(null),
  ]);
  const r = data?.chart?.result?.[0];
  const ts = r?.timestamp ?? [];
  const ind = r?.indicators?.quote?.[0];
  let candles: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = ind?.open?.[i];
    const h = ind?.high?.[i];
    const l = ind?.low?.[i];
    const c = ind?.close?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({ time: ts[i]!, open: o, high: h, low: l, close: c });
  }
  if (q.group > 1) {
    const sec = 3600 * q.group;
    const grouped: Candle[] = [];
    for (const c of candles) {
      const t = Math.floor(c.time / sec) * sec;
      const last = grouped.at(-1);
      if (last && last.time === t) {
        last.high = Math.max(last.high, c.high);
        last.low = Math.min(last.low, c.low);
        last.close = c.close;
      } else grouped.push({ ...c, time: t });
    }
    candles = grouped;
  }
  const lastClose = candles.at(-1)?.close;
  if (spot && lastClose) {
    const shift = spot - lastClose;
    candles = candles.map((c) => ({
      time: c.time,
      open: c.open + shift,
      high: c.high + shift,
      low: c.low + shift,
      close: c.close + shift,
    }));
  }
  // de-duplicate / sort
  const map = new Map<number, Candle>();
  for (const c of candles) map.set(c.time, c);
  return [...map.values()].sort((a, b) => a.time - b.time).slice(-400);
}

const BINANCE_TF: Record<Timeframe, string> = {
  M1: "1m",
  M5: "5m",
  M15: "15m",
  M30: "30m",
  H1: "1h",
  H4: "4h",
  D1: "1d",
  W1: "1w",
  MN: "1M",
};
const BINANCE_PAIR: Record<string, string> = { XAUUSD: "PAXGUSDT", BTCUSD: "BTCUSDT" };

async function fetchBinanceCandles(symbol: string, tf: Timeframe): Promise<Candle[]> {
  const pair = BINANCE_PAIR[symbol];
  if (!pair) return [];
  const rows = await fetchJson<(string | number)[][]>(
    `https://data-api.binance.vision/api/v3/klines?symbol=${pair}&interval=${BINANCE_TF[tf]}&limit=400`,
  );
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({
    time: Math.floor(Number(r[0]) / 1000),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
  }));
}

/** Deterministic price history ending at the live price, used when no history source answers. */
function syntheticCandles(symbol: string, tf: Timeframe, price: number): Candle[] {
  const spec = getSpec(symbol);
  const sec = TF_SECONDS[tf];
  const dailyVol = spec.kind === "crypto" ? 0.03 : spec.kind === "metal" ? 0.012 : 0.005;
  const sigma = dailyVol * Math.sqrt(sec / 86400);
  const n = 300;
  const lastStart = Math.floor(Date.now() / 1000 / sec) * sec;
  let seed = 0;
  for (const ch of symbol + tf) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = (t: number, k: number) => {
    let x = (seed ^ Math.imul(t, 2654435761) ^ Math.imul(k + 1, 40503)) >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 100000) / 100000;
  };
  const out: Candle[] = [];
  let close = price;
  for (let i = 0; i < n; i++) {
    const t = lastStart - i * sec;
    const r = (rand(t, 0) - 0.5) * 2 * sigma;
    const open = close / (1 + r);
    const hi = Math.max(open, close) * (1 + rand(t, 1) * sigma * 0.6);
    const lo = Math.min(open, close) * (1 - rand(t, 2) * sigma * 0.6);
    out.push({ time: t, open, high: hi, low: lo, close });
    close = open;
  }
  return out.reverse();
}

function shiftTo(candles: Candle[], price: number | undefined): Candle[] {
  const last = candles.at(-1)?.close;
  if (!price || !last) return candles;
  const shift = price - last;
  return candles.map((c) => ({ time: c.time, open: c.open + shift, high: c.high + shift, low: c.low + shift, close: c.close + shift }));
}

export async function fetchCandles(symbol: string, tf: Timeframe): Promise<Candle[]> {
  const key = `${symbol}:${tf}`;
  const cached = candleCache.get(key);
  if (cached && Date.now() - cached.at < 20_000) return cached.data;

  let out = await fetchYahooCandles(symbol, tf);
  if (out.length < 20) {
    const [bin, quotes] = await Promise.all([fetchBinanceCandles(symbol, tf), fetchQuotes()]);
    const live = quotes.find((q) => q.symbol === symbol)?.price;
    if (bin.length >= 20) out = shiftTo(bin, live);
    else if (live) out = syntheticCandles(symbol, tf, live);
  }
  if (out.length > 0) candleCache.set(key, { at: Date.now(), data: out });
  return out;
}

export interface NewsItem {
  id: string;
  title: string;
  publisher: string;
  link: string;
  time: number;
}

let newsCache: { at: number; data: NewsItem[] } | null = null;

export async function fetchNews(): Promise<NewsItem[]> {
  if (newsCache && Date.now() - newsCache.at < 300_000) return newsCache.data;
  const qs = ["EURUSD=X", "GC=F", "GBPUSD=X", "USDJPY=X", "AUDUSD=X"];
  type R = { news?: { uuid: string; title: string; publisher: string; link: string; providerPublishTime: number }[] };
  const res = await Promise.all(
    qs.map((q) =>
      fetchJson<R>(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&newsCount=10&quotesCount=0`),
    ),
  );
  const map = new Map<string, NewsItem>();
  for (const r of res)
    for (const n of r?.news ?? [])
      map.set(n.uuid, { id: n.uuid, title: n.title, publisher: n.publisher, link: n.link, time: n.providerPublishTime * 1000 });
  const data = [...map.values()].sort((a, b) => b.time - a.time);
  if (data.length) newsCache = { at: Date.now(), data };
  return data;
}

export interface CalendarEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
}

let calCache: { at: number; data: CalendarEvent[] } | null = null;

export async function fetchCalendar(): Promise<CalendarEvent[]> {
  if (calCache && Date.now() - calCache.at < 1_800_000) return calCache.data;
  const d = await fetchJson<CalendarEvent[]>("https://nfs.faireconomy.media/ff_calendar_thisweek.json");
  if (d && Array.isArray(d)) {
    calCache = { at: Date.now(), data: d };
    return d;
  }
  return calCache?.data ?? [];
}
