import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { getSpec, SYMBOLS } from "@/lib/market/symbols";
import { openPosition } from "@/lib/trading/ops";
import { getState, nowMs, setState, useTerminal } from "@/lib/trading/store";
import { BigPrice } from "../PriceText";
import { Page, Scroll, TopBar } from "../Shell";
import { SymbolIcon } from "../SymbolIcon";

export function OrderScreen({ symbol: initial }: { symbol: string }) {
  const s = useTerminal();
  const navigate = useNavigate();
  const [symbol, setSymbol] = useState(initial);
  const [vol, setVol] = useState(0.01);
  const [ticks, setTicks] = useState<{ i: number; v: number }[]>([]);
  const counter = useRef(0);
  const spec = getSpec(symbol);
  const q = s.display[symbol];

  useEffect(() => {
    setTicks([]);
  }, [symbol]);
  useEffect(() => {
    if (!q) return;
    setTicks((t) => [...t.slice(-80), { i: counter.current++, v: q.bid }]);
  }, [q?.bid]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = (d: number) => setVol((v) => Math.max(0.01, Math.min(100, Math.round((v + d) * 100) / 100)));
  const submit = (side: "buy" | "sell") => {
    const { state, ticket } = openPosition(getState(), symbol, side, vol, nowMs());
    if (ticket === null) {
      toast.error("No price yet");
      return;
    }
    setState(() => state);
    toast.success(`Order #${ticket} ${side} ${vol.toFixed(2)} ${symbol} done`);
    navigate({ to: "/trade" });
  };

  return (
    <Page nav={false}>
      <TopBar back title={symbol} subtitle={undefined} />
      <Scroll className="px-4">
        <div className="flex items-center gap-3 pb-2">
          <SymbolIcon symbol={symbol} size={32} />
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="h-11 flex-1 rounded-lg border border-input bg-background px-2 font-condensed text-[17px]"
          >
            {SYMBOLS.map((x) => (
              <option key={x.name} value={x.name}>
                {x.name} – {x.description}
              </option>
            ))}
          </select>
        </div>
        <div className="border-b border-border py-3 text-center font-condensed text-[18px] text-foreground">Market Execution</div>
        <div className="grid grid-cols-7 items-center gap-1 py-4 text-center">
          {[-0.5, -0.1, -0.01].map((d) => (
            <button key={d} onClick={() => step(d)} className="font-num h-10 rounded-lg text-[14px] text-primary press">
              {d}
            </button>
          ))}
          <span className="font-num text-[22px] font-semibold">{vol.toFixed(2)}</span>
          {[0.01, 0.1, 0.5].map((d) => (
            <button key={d} onClick={() => step(d)} className="font-num h-10 rounded-lg text-[14px] text-primary press">
              +{d}
            </button>
          ))}
        </div>
        {q && (
          <div className="grid grid-cols-2 py-2 text-center">
            <BigPrice price={q.bid} digits={spec.digits} className="justify-center text-[32px] text-down" />
            <BigPrice price={q.ask} digits={spec.digits} className="justify-center text-[32px] text-up" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 border-y border-border py-3 text-[15px] text-muted-foreground">
          <div className="flex justify-between">
            <span>Stop Loss</span>
            <span>-</span>
          </div>
          <div className="flex justify-between">
            <span>Take Profit</span>
            <span>-</span>
          </div>
        </div>
        <div className="h-44 py-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={ticks}>
              <YAxis domain={["dataMin", "dataMax"]} hide />
              <Area type="stepAfter" dataKey="v" stroke="var(--candle-down)" fill="var(--pill-loss)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="py-2 text-center text-[13px] text-muted-foreground">
          Attention! The trade will be executed at market conditions, difference with requested price may be significant!
        </div>
      </Scroll>
      <div className="grid shrink-0 grid-cols-2 gap-3 p-3">
        <button onClick={() => submit("sell")} className="h-14 rounded-xl bg-down text-[16px] font-semibold text-primary-foreground">
          SELL BY MARKET
        </button>
        <button onClick={() => submit("buy")} className="h-14 rounded-xl bg-primary text-[16px] font-semibold text-primary-foreground">
          BUY BY MARKET
        </button>
      </div>
    </Page>
  );
}
