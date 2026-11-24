import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { getSpec, point } from "@/lib/market/symbols";
import { setState, useTerminal } from "@/lib/trading/store";
import type { Quote } from "@/lib/trading/types";
import { cn } from "@/lib/utils";
import { BigPrice } from "../PriceText";
import { BottomSheet, IconBtn, Page, PopupMenu, Row, Scroll, TopBar } from "../Shell";
import { SpreadIcon } from "../icons";
import { SymbolIcon } from "../SymbolIcon";

function hhmmss(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function QuoteRow({ q, edit, onTap }: { q: Quote; edit: boolean; onTap: () => void }) {
  const spec = getSpec(q.symbol);
  const pt = point(spec);
  const pts = Math.round((q.bid - q.prevClose) / pt);
  const pct = q.prevClose ? ((q.bid - q.prevClose) / q.prevClose) * 100 : 0;
  const changeCls = pct >= 0 ? "text-up" : "text-down";
  const priceCls = q.dir < 0 ? "text-down" : "text-up";
  const spread = Math.round((q.ask - q.bid) / pt);
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 press" onClick={edit ? undefined : onTap}>
      {edit && (
        <button
          aria-label={`Remove ${q.symbol}`}
          onClick={() => setState((s) => ({ ...s, quotesList: s.quotesList.filter((x) => x !== q.symbol) }))}
          className="grid h-9 w-9 place-items-center rounded-full text-down"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      )}
      <SymbolIcon symbol={q.symbol} size={30} />
      <div className="min-w-0 flex-1">
        <div className={cn("font-num text-[13px]", changeCls)}>
          {pct.toFixed(2)}% <span>{pts > 0 ? `+${pts}` : pts}</span>
        </div>
        <div className="font-condensed text-[18px] font-semibold leading-tight text-foreground">{q.symbol}</div>
        <div className="font-num flex items-center gap-1 text-[13px] text-muted-foreground">
          {hhmmss(q.time)} <SpreadIcon /> {spread}
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-x-3 text-right">
        <BigPrice price={q.bid} digits={spec.digits} className={cn("justify-end text-[24px] font-semibold", priceCls)} />
        <BigPrice price={q.ask} digits={spec.digits} className={cn("justify-end text-[24px] font-semibold", priceCls)} />
        <span className="font-num mt-1 text-[12px] text-muted-foreground">L: {q.low.toFixed(spec.digits)}</span>
        <span className="font-num mt-1 text-[12px] text-muted-foreground">H: {q.high.toFixed(spec.digits)}</span>
      </div>
    </div>
  );
}

export function QuotesScreen() {
  const s = useTerminal();
  const navigate = useNavigate();
  const [edit, setEdit] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [props, setProps] = useState<string | null>(null);
  const [stats, setStats] = useState<string | null>(null);
  const rows = s.quotesList.map((sym) => s.display[sym]).filter((q): q is Quote => !!q);

  return (
    <Page>
      <TopBar
        title="Quotes"
        actions={
          <>
            <Link to="/symbols" aria-label="Add symbol" className="grid h-11 w-11 place-items-center rounded-full press">
              <Plus className="h-7 w-7" strokeWidth={1.6} />
            </Link>
            <IconBtn label="Edit list" onClick={() => setEdit((e) => !e)} active={edit}>
              <Pencil className="h-6 w-6" strokeWidth={1.6} />
            </IconBtn>
          </>
        }
      />
      <Scroll>
        {rows.length === 0 && (
          <div className="p-10 text-center text-muted-foreground">Connecting to live prices…</div>
        )}
        {rows.map((q) => (
          <QuoteRow key={q.symbol} q={q} edit={edit} onTap={() => setMenu(q.symbol)} />
        ))}
      </Scroll>

      {menu && (
        <PopupMenu
          title={menu}
          onClose={() => setMenu(null)}
          items={[
            { label: "New order", onClick: () => navigate({ to: "/order", search: { symbol: menu } }) },
            {
              label: "Chart",
              onClick: () => {
                setState((st) => ({ ...st, chart: { ...st.chart, symbol: menu } }));
                navigate({ to: "/charts" });
              },
            },
            { label: "Properties", onClick: () => setProps(menu) },
            { label: "Market statistics", onClick: () => setStats(menu) },
          ]}
        />
      )}
      {props && <PropertiesSheet symbol={props} onClose={() => setProps(null)} />}
      {stats && <StatsSheet symbol={stats} onClose={() => setStats(null)} />}
    </Page>
  );
}

function PropertiesSheet({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const spec = getSpec(symbol);
  return (
    <BottomSheet title={symbol} onClose={onClose}>
      <div className="px-5 pb-2 text-[14px] text-muted-foreground">{spec.description}</div>
      <div className="px-5">
        <Row label="Digits" value={spec.digits} />
        <Row label="Contract size" value={spec.contract.toLocaleString("en-US")} />
        <Row label="Spread" value="floating" />
        <Row label="Margin currency" value={spec.base} />
        <Row label="Profit currency" value={spec.quote} />
        <Row label="Minimal volume" value="0.01" />
        <Row label="Maximal volume" value="100.00" />
        <Row label="Volume step" value="0.01" />
        <Row label="Execution" value="Market" />
      </div>
    </BottomSheet>
  );
}

function StatsSheet({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const s = useTerminal();
  const q = s.display[symbol];
  const spec = getSpec(symbol);
  if (!q) return null;
  const ch = q.bid - q.prevClose;
  return (
    <BottomSheet title={`${symbol} statistics`} onClose={onClose}>
      <div className="px-5">
        <Row label="Bid" value={q.bid.toFixed(spec.digits)} />
        <Row label="Ask" value={q.ask.toFixed(spec.digits)} />
        <Row label="Previous close" value={q.prevClose.toFixed(spec.digits)} />
        <Row label="Day low" value={q.low.toFixed(spec.digits)} />
        <Row label="Day high" value={q.high.toFixed(spec.digits)} />
        <Row label="Change" value={ch.toFixed(spec.digits)} valueClass={ch >= 0 ? "text-up" : "text-down"} />
      </div>
    </BottomSheet>
  );
}
