import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type {
  CandlestickData,
  IChartApi,
  IPriceLine,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  UTCTimestamp,
} from "lightweight-charts";
import { getCandles } from "@/lib/market/market.functions";
import { getSpec, TF_SECONDS, type Timeframe } from "@/lib/market/symbols";
import { getState, subscribe } from "@/lib/trading/store";
import type { TerminalState } from "@/lib/trading/types";
import { fmtCountdown } from "@/lib/time";

/** Resolve a CSS color token (oklch etc.) into an rgb string the chart canvas understands. */
function cssColor(name: string, alpha = 1): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const ctx = c.getContext("2d");
  if (!ctx) return "rgb(0,0,0)";
  ctx.fillStyle = raw || "#000";
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgba(${r},${g},${b},${alpha})`;
}

const tzShift = () => -new Date().getTimezoneOffset() * 60;

export interface ChartHandle {
  crosshair: boolean;
  showMA: boolean;
}

export function CandleChart({
  symbol,
  tf,
  crosshair,
  showMA,
}: {
  symbol: string;
  tf: Timeframe;
  crosshair: boolean;
  showMA: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const maRef = useRef<ISeriesApi<"Line"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<UTCTimestamp> | null>(null);
  const linesRef = useRef<Map<number | string, IPriceLine>>(new Map());
  const dataRef = useRef<CandlestickData<UTCTimestamp>[]>([]);
  const [ready, setReady] = useState(false);
  const [label, setLabel] = useState<{ y: number; price: string; left: string; w: number } | null>(null);
  const fetchCandles = useServerFn(getCandles);

  // create chart once
  useEffect(() => {
    let disposed = false;
    void (async () => {
      const lc = await import("lightweight-charts");
      if (disposed || !el.current) return;
      const grid = cssColor("--border", 0.7);
      const chart = lc.createChart(el.current, {
        autoSize: true,
        layout: {
          background: { color: cssColor("--background") },
          textColor: cssColor("--foreground"),
          fontFamily: "Roboto Condensed, Roboto, sans-serif",
          fontSize: 13,
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: grid, style: lc.LineStyle.Dashed },
          horzLines: { color: grid, style: lc.LineStyle.Dashed },
        },
        rightPriceScale: { borderColor: cssColor("--border") },
        timeScale: { borderColor: cssColor("--border"), timeVisible: true, secondsVisible: false, rightOffset: 8 },
        crosshair: { mode: lc.CrosshairMode.Hidden },
        handleScale: true,
        handleScroll: true,
      });
      const series = chart.addSeries(lc.CandlestickSeries, {
        upColor: cssColor("--candle-up"),
        downColor: cssColor("--candle-down"),
        borderVisible: false,
        wickUpColor: cssColor("--candle-up"),
        wickDownColor: cssColor("--candle-down"),
        priceLineColor: cssColor("--candle-up"),
        priceLineStyle: lc.LineStyle.Solid,
        priceLineWidth: 1,
        lastValueVisible: false,
      });
      const ma = chart.addSeries(lc.LineSeries, {
        color: cssColor("--primary"),
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        visible: false,
      });
      markersRef.current = lc.createSeriesMarkers(series, []) as ISeriesMarkersPluginApi<UTCTimestamp>;
      chartRef.current = chart;
      seriesRef.current = series;
      maRef.current = ma;
      setReady(true);
    })();
    return () => {
      disposed = true;
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
      linesRef.current = new Map();
    };
  }, []);

  useEffect(() => {
    void (async () => {
      if (!chartRef.current) return;
      const lc = await import("lightweight-charts");
      chartRef.current.applyOptions({
        crosshair: { mode: crosshair ? lc.CrosshairMode.Normal : lc.CrosshairMode.Hidden },
      });
    })();
  }, [crosshair, ready]);

  useEffect(() => {
    maRef.current?.applyOptions({ visible: showMA });
  }, [showMA, ready]);

  // load history
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const spec = getSpec(symbol);
    seriesRef.current?.applyOptions({ priceFormat: { type: "price", precision: spec.digits, minMove: Math.pow(10, -spec.digits) } });
    const load = async (fit: boolean) => {
      try {
        const r = await fetchCandles({ data: { symbol, tf } });
        if (!alive || !seriesRef.current) return;
        const shift = tzShift();
        const data = r.candles.map((c) => ({
          time: (c.time + shift) as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        // keep the live candle we already built if it's newer
        const prevLast = dataRef.current.at(-1);
        const last = data.at(-1);
        if (prevLast && last && prevLast.time >= last.time && dataRef.current.length > 0 && !fit) {
          const idx = data.findIndex((d) => d.time === prevLast.time);
          if (idx >= 0) data[idx] = { ...prevLast, high: Math.max(prevLast.high, data[idx]!.high), low: Math.min(prevLast.low, data[idx]!.low) };
          else if (prevLast.time > last.time) data.push(prevLast);
        }
        dataRef.current = data;
        seriesRef.current.setData(data);
        updateMA();
        if (fit) chartRef.current?.timeScale().setVisibleLogicalRange({ from: data.length - 70, to: data.length + 6 });
        sync(getState());
      } catch {
        /* retry next round */
      }
    };
    dataRef.current = [];
    void load(true);
    const id = setInterval(() => void load(false), 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, tf, ready]);

  function updateMA() {
    const d = dataRef.current;
    const n = 14;
    const out: { time: UTCTimestamp; value: number }[] = [];
    let sum = 0;
    for (let i = 0; i < d.length; i++) {
      sum += d[i]!.close;
      if (i >= n) sum -= d[i - n]!.close;
      if (i >= n - 1) out.push({ time: d[i]!.time, value: sum / n });
    }
    maRef.current?.setData(out);
  }

  function sync(s: TerminalState) {
    const series = seriesRef.current;
    if (!series) return;
    const q = s.display[symbol];
    const spec = getSpec(symbol);
    const tfSec = TF_SECONDS[tf];
    const shift = tzShift();
    if (q && dataRef.current.length > 0) {
      const nowSec = Math.floor(Date.now() / 1000) + shift;
      const last = dataRef.current.at(-1)!;
      const bucket = tf === "W1" || tf === "MN" ? last.time : ((Math.floor(nowSec / tfSec) * tfSec) as UTCTimestamp);
      let bar: CandlestickData<UTCTimestamp>;
      if (bucket > last.time) {
        bar = { time: bucket, open: last.close, high: Math.max(last.close, q.bid), low: Math.min(last.close, q.bid), close: q.bid };
        dataRef.current.push(bar);
      } else {
        bar = { ...last, high: Math.max(last.high, q.bid), low: Math.min(last.low, q.bid), close: q.bid };
        dataRef.current[dataRef.current.length - 1] = bar;
      }
      series.update(bar);
      const y = series.priceToCoordinate(q.bid);
      const remain = (Math.floor(nowSec / tfSec) + 1) * tfSec - nowSec;
      const w = chartRef.current?.priceScale("right").width() ?? 78;
      setLabel(y === null ? null : { y, price: q.bid.toFixed(spec.digits), left: fmtCountdown(remain * 1000), w });
    }

    // price lines: ask + open positions
    const wanted = new Map<number | string, { price: number; color: string; title: string; dashed: boolean }>();
    if (q) wanted.set("ask", { price: q.ask, color: cssColor("--candle-down"), title: "", dashed: false });
    const mine = s.positions.filter((p) => p.symbol === symbol);
    for (const p of mine) {
      wanted.set(p.ticket, {
        price: p.openPrice,
        color: p.type === "buy" ? cssColor("--up") : cssColor("--down"),
        title: `${p.type} ${p.volume.toFixed(2)}`,
        dashed: true,
      });
    }
    for (const [k, line] of linesRef.current) {
      if (!wanted.has(k)) {
        series.removePriceLine(line);
        linesRef.current.delete(k);
      }
    }
    for (const [k, w] of wanted) {
      const existing = linesRef.current.get(k);
      if (existing) existing.applyOptions({ price: w.price });
      else
        linesRef.current.set(
          k,
          series.createPriceLine({
            price: w.price,
            color: w.color,
            lineWidth: 1,
            lineStyle: w.dashed ? 2 : 0,
            axisLabelVisible: k !== "ask" ? true : false,
            title: w.title,
          }),
        );
    }
    const markers = mine
      .map((p) => {
        const t = (Math.floor((p.openTime / 1000 + shift) / tfSec) * tfSec) as UTCTimestamp;
        return {
          time: t,
          position: p.type === "buy" ? ("belowBar" as const) : ("aboveBar" as const),
          shape: p.type === "buy" ? ("arrowUp" as const) : ("arrowDown" as const),
          color: p.type === "buy" ? cssColor("--up") : cssColor("--down"),
          text: "",
        };
      })
      .sort((a, b) => a.time - b.time);
    markersRef.current?.setMarkers(markers);
  }

  useEffect(() => {
    if (!ready) return;
    let last = 0;
    const unsub = subscribe(() => {
      const now = Date.now();
      if (now - last < 250) return;
      last = now;
      sync(getState());
    });
    return () => {
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, symbol, tf]);

  return (
    <div className="relative h-full w-full">
      <div ref={el} className="absolute inset-0" />
      {label && (
        <div
          className="font-num pointer-events-none absolute right-0 z-10 bg-candle-up px-1 text-[13px] leading-tight text-background"
          style={{ top: label.y - 10, width: label.w }}
        >
          <div>{label.price}</div>
          <div>{label.left}</div>
        </div>
      )}
    </div>
  );
}
