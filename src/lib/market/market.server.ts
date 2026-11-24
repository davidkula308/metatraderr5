import { SYMBOLS, getSpec, type Timeframe } from "./symbols";

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

export async function fetchQuotes(): Promise<RealQuote[]> {
  if (quoteCache && Date.now() - quoteCache.at < 1500) return quoteCache.data;

  const groups = chunk(SYMBOLS, 10);
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
    fetchSpot("XAU"),
    fetchSpot("XAG"),
  ]);
  const merged: Record<string, SparkEntry> = Object.assign({}, ...sparks.map((s) => s ?? {}));

  const out: RealQuote[] = [];
  for (const spec of SYMBOLS) {
    const e = merged[spec.yahoo];
    const closes = (e?.close ?? []).filter((c): c is number => typeof c === "number");
    const last = closes.at(-1);
    if (last === undefined) continue;
    const spot = spec.spot === "XAU" ? xau : spec.spot === "XAG" ? xag : null;
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

export async function fetchCandles(symbol: string, tf: Timeframe): Promise<Candle[]> {
  const key = `${symbol}:${tf}`;
  const cached = candleCache.get(key);
  if (cached && Date.now() - cached.at < 20_000) return cached.data;

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
  const out = [...map.values()].sort((a, b) => a.time - b.time).slice(-400);
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
