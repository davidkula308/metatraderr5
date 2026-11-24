import { useState } from "react";
import { ChevronDown, ChevronUp, Crosshair } from "lucide-react";
import { toast } from "sonner";
import { getSpec, TIMEFRAMES, SYMBOLS } from "@/lib/market/symbols";
import { dispatch, getState, setState, useTerminal } from "@/lib/trading/store";
import { cn } from "@/lib/utils";
import { CandleChart } from "../CandleChart";
import { BigPrice } from "../PriceText";
import { BottomSheet, IconBtn, Page, TopBar } from "../Shell";
import { IndicatorIcon, OneClickIcon, SymbolsIcon } from "../icons";
import { SymbolIcon } from "../SymbolIcon";
import { Switch } from "@/components/ui/switch";

export function ChartsScreen() {
  const s = useTerminal();
  const { symbol, tf, lot } = s.chart;
  const spec = getSpec(symbol);
  const q = s.display[symbol];
  const [crosshair, setCrosshair] = useState(false);
  const [showMA, setShowMA] = useState(false);
  const [panel, setPanel] = useState(true);
  const [tfOpen, setTfOpen] = useState(false);
  const [symOpen, setSymOpen] = useState(false);
  const [indOpen, setIndOpen] = useState(false);

  const setLot = (v: number) =>
    setState((st) => ({ ...st, chart: { ...st.chart, lot: Math.max(0.01, Math.min(100, Math.round(v * 100) / 100)) } }));

  const trade = (side: "buy" | "sell") => {
    if (!getState().display[symbol]) {
      toast.error("No price yet, try again in a moment");
      return;
    }
    void dispatch({ t: "open", symbol, side, volume: lot }).then((res) => {
      if (res?.ticket) toast.success(`${side} ${lot.toFixed(2)} ${symbol} opened`);
      else toast.error("Order failed, check your connection");
    });
  };

  return (
    <Page>
      <TopBar
        title=""
        actions={
          <>
            <IconBtn label="Crosshair" onClick={() => setCrosshair((c) => !c)} active={crosshair}>
              <Crosshair className="h-6 w-6" strokeWidth={1.6} />
            </IconBtn>
            <IconBtn label="Indicators" onClick={() => setIndOpen(true)} active={showMA}>
              <IndicatorIcon />
            </IconBtn>
            <button
              onClick={() => setTfOpen(true)}
              className="grid h-11 min-w-11 place-items-center rounded-full px-1 font-condensed text-[19px] font-medium press"
            >
              {tf}
            </button>
            <IconBtn label="Symbols" onClick={() => setSymOpen(true)}>
              <SymbolsIcon />
            </IconBtn>
            <IconBtn label="One-click trading" onClick={() => setPanel((p) => !p)}>
              <OneClickIcon />
            </IconBtn>
          </>
        }
      />
      {panel && (
        <div className="grid h-[68px] shrink-0 grid-cols-[1fr_1fr_1fr] border-y border-border">
          <button onClick={() => trade("sell")} className="flex flex-col items-start bg-primary px-2 pt-1 text-primary-foreground active:opacity-80">
            <span className="text-[13px] font-medium">SELL</span>
            {q && <BigPrice price={q.bid} digits={spec.digits} className="ml-auto text-[28px] font-medium" />}
          </button>
          <div className="flex items-center justify-between bg-background px-1">
            <button aria-label="Decrease volume" onClick={() => setLot(lot - 0.01)} className="grid h-11 w-9 place-items-center press">
              <ChevronDown className="h-6 w-6 text-icon" />
            </button>
            <span className="font-num text-[19px]">{lot.toFixed(2)}</span>
            <button aria-label="Increase volume" onClick={() => setLot(lot + 0.01)} className="grid h-11 w-9 place-items-center press">
              <ChevronUp className="h-6 w-6 text-icon" />
            </button>
          </div>
          <button onClick={() => trade("buy")} className="flex flex-col items-start bg-primary px-2 pt-1 text-primary-foreground active:opacity-80">
            <span className="text-[13px] font-medium">BUY</span>
            {q && <BigPrice price={q.ask} digits={spec.digits} className="ml-auto text-[28px] font-medium" />}
          </button>
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        <button
          onClick={() => setSymOpen(true)}
          className="absolute left-2 top-1 z-10 text-left leading-tight"
        >
          <div className="text-[17px]">
            <span className="text-primary">{symbol}</span>
            <span className="text-primary"> ▾</span> <span>{tf}</span>
          </div>
          <div className="text-[16px] text-foreground">{spec.description}</div>
        </button>
        <CandleChart symbol={symbol} tf={tf} crosshair={crosshair} showMA={showMA} />
      </div>

      {tfOpen && (
        <div className="absolute inset-0 z-50">
          <button aria-label="Close" className="absolute inset-0" onClick={() => setTfOpen(false)} />
          <div className="absolute right-16 top-12 grid grid-cols-3 gap-1 rounded-2xl bg-popover p-2 shadow-2xl animate-pop">
            {TIMEFRAMES.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setState((st) => ({ ...st, chart: { ...st.chart, tf: t } }));
                  setTfOpen(false);
                }}
                className={cn(
                  "h-11 w-16 rounded-lg font-condensed text-[17px] press",
                  t === tf ? "bg-secondary text-primary" : "text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
      {symOpen && (
        <BottomSheet title="Symbols" onClose={() => setSymOpen(false)}>
          <div className="py-1">
            {SYMBOLS.map((sp) => (
              <button
                key={sp.name}
                onClick={() => {
                  setState((st) => ({ ...st, chart: { ...st.chart, symbol: sp.name } }));
                  setSymOpen(false);
                }}
                className={cn("flex w-full items-center gap-3 px-5 py-2.5 text-left press", sp.name === symbol && "bg-secondary")}
              >
                <SymbolIcon symbol={sp.name} size={30} />
                <div className="min-w-0">
                  <div className="font-condensed text-[17px] font-semibold">{sp.name}</div>
                  <div className="truncate text-[13px] text-muted-foreground">{sp.description}</div>
                </div>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
      {indOpen && (
        <BottomSheet title="Indicators" onClose={() => setIndOpen(false)}>
          <div className="px-5 py-2">
            <label className="flex items-center justify-between py-3 text-[16px]">
              Moving Average (14)
              <Switch checked={showMA} onCheckedChange={setShowMA} />
            </label>
          </div>
        </BottomSheet>
      )}
    </Page>
  );
}

