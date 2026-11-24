import { flagUrl, getSpec } from "@/lib/market/symbols";

function Coin({ ccy, size, pos }: { ccy: string; size: number; pos: "a" | "b" }) {
  const url = flagUrl(ccy);
  const place = pos === "a" ? "left-0 top-0" : "bottom-0 right-0";
  const style = { width: size, height: size };
  if (url)
    return (
      <span className={`absolute block overflow-hidden rounded-full ring-2 ring-background ${place}`} style={style}>
        <img src={url} alt={ccy} className="h-full w-full object-cover" loading="lazy" />
      </span>
    );
  const tone = ccy === "XAU" ? "bg-chart-4" : ccy === "BTC" ? "bg-candle-down" : "bg-muted-foreground";
  return (
    <span
      className={`absolute grid place-items-center rounded-full ring-2 ring-background font-condensed text-[10px] font-bold text-background ${tone} ${place}`}
      style={style}
    >
      {ccy === "XAU" ? "Au" : ccy === "XAG" ? "Ag" : "₿"}
    </span>
  );
}

export function SymbolIcon({ symbol, size = 40 }: { symbol: string; size?: number }) {
  const spec = getSpec(symbol);
  const s = Math.round(size * 0.62);
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }} aria-label={symbol}>
      <Coin ccy={spec.base} size={s} pos="a" />
      <Coin ccy={spec.quote} size={s} pos="b" />
    </span>
  );
}
