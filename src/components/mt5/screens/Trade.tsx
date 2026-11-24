import { useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowDownUp, FilePlus2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { getSpec } from "@/lib/market/symbols";
import { closePrice, fmtMoney, positionProfit, summarize } from "@/lib/trading/calc";
import { dispatch, getState, setState, useTerminal } from "@/lib/trading/store";
import type { Position } from "@/lib/trading/types";
import { fmtDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { BottomSheet, IconBtn, Page, PopupMenu, Row, Scroll, TopBar } from "../Shell";

type SortKey = "open" | "symbol" | "profit";

export function TradeSummary() {
  const s = useTerminal();
  const sum = summarize(s.account.balance, s.positions, s.display, s.account.leverage);
  return (
    <div className="px-4 py-2">
      <Row label="Balance:" value={fmtMoney(sum.balance)} />
      <Row label="Equity:" value={fmtMoney(sum.equity)} />
      {sum.margin > 0 && <Row label="Margin:" value={fmtMoney(sum.margin)} />}
      <Row label="Free margin:" value={fmtMoney(sum.freeMargin)} />
      {sum.marginLevel !== null && <Row label="Margin Level (%):" value={fmtMoney(sum.marginLevel)} />}
    </div>
  );
}

function PositionRow({ p, onLong }: { p: Position; onLong: (p: Position) => void }) {
  const s = useTerminal();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);
  const q = s.display[p.symbol];
  const spec = getSpec(p.symbol);
  const cur = q ? closePrice(p.type, q) : p.openPrice;
  const profit = q ? positionProfit(p, cur, s.display) : 0;
  const start = () => {
    longFired.current = false;
    timer.current = setTimeout(() => {
      longFired.current = true;
      onLong(p);
    }, 500);
  };
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  return (
    <div
      className="select-none border-b border-border px-4 py-2 press"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onContextMenu={(e) => {
        e.preventDefault();
        onLong(p);
      }}
      onClick={() => {
        if (!longFired.current) setOpen((o) => !o);
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-condensed text-[18px] leading-tight">
            <span className="font-semibold text-foreground">{p.symbol},</span>{" "}
            <span className={p.type === "buy" ? "text-up" : "text-down"}>
              {p.type} {p.volume.toFixed(2)}
            </span>
          </div>
          <div className="font-num text-[18px] leading-tight text-muted-foreground">
            {fmtMoney(p.openPrice, spec.digits)} → {fmtMoney(cur, spec.digits)}
          </div>
        </div>
        <div className={cn("font-num shrink-0 text-[21px] font-semibold", profit < 0 ? "text-down" : "text-up")}>
          {fmtMoney(profit)}
        </div>
      </div>
      {open && (
        <div className="font-num mt-1 grid grid-cols-2 gap-x-6 text-[14px] text-muted-foreground">
          <div className="col-span-2 text-right">{fmtDateTime(p.openTime)}</div>
          <div className="flex justify-between">
            <span>S / L:</span>
            <span>{p.sl ? p.sl.toFixed(spec.digits) : "-"}</span>
          </div>
          <div className="flex justify-between">
            <span>Swap:</span>
            <span>{p.swap.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>T / P:</span>
            <span>{p.tp ? p.tp.toFixed(spec.digits) : "-"}</span>
          </div>
          <div className="flex justify-between">
            <span>ID:</span>
            <span>{p.ticket}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function PositionsList({ emptyText = "", sort = "open" as SortKey }: { emptyText?: string; sort?: SortKey }) {
  const s = useTerminal();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [target, setTarget] = useState<Position | null>(null);
  const [closing, setClosing] = useState<Position | null>(null);

  const list = [...s.positions].sort((a, b) => {
    if (sort === "symbol") return a.symbol.localeCompare(b.symbol);
    if (sort === "profit") {
      const pa = s.display[a.symbol] ? positionProfit(a, closePrice(a.type, s.display[a.symbol]!), s.display) : 0;
      const pb = s.display[b.symbol] ? positionProfit(b, closePrice(b.type, s.display[b.symbol]!), s.display) : 0;
      return pb - pa;
    }
    return a.openTime - b.openTime;
  });

  const closeWhere = (fn: (p: Position, profit: number) => boolean) => {
    const st = getState();
    const tickets = st.positions
      .filter((p) => {
        const q = st.display[p.symbol];
        return q ? fn(p, positionProfit(p, closePrice(p.type, q), st.display)) : false;
      })
      .map((p) => p.ticket);
    if (!tickets.length) return;
    void dispatch({ t: "close", tickets }).then((res) => {
      if (res) toast.success(`${res.count ?? tickets.length} position(s) closed, ${(res.profit ?? 0).toFixed(2)} USD`);
      else toast.error("Could not close, check your connection");
    });
  };

  return (
    <>
      <div className="flex h-11 items-center justify-between border-y border-border bg-section px-4">
        <span className="font-condensed text-[18px] text-muted-foreground">Positions</span>
        {s.positions.length > 0 && (
          <button aria-label="Positions menu" onClick={() => setMenu(true)} className="grid h-9 w-9 place-items-center rounded-full press">
            <MoreHorizontal className="h-6 w-6 text-icon" />
          </button>
        )}
      </div>
      {list.length === 0 && emptyText && <div className="py-10 text-center text-[16px] text-muted-foreground">{emptyText}</div>}
      {list.map((p) => (
        <PositionRow key={p.ticket} p={p} onLong={setTarget} />
      ))}
      {menu && (
        <PopupMenu
          onClose={() => setMenu(false)}
          items={[
            { label: "Close all positions", onClick: () => closeWhere(() => true) },
            { label: "Close profitable positions", onClick: () => closeWhere((_, pr) => pr > 0) },
            { label: "Close losing positions", onClick: () => closeWhere((_, pr) => pr < 0) },
          ]}
        />
      )}
      {target && (
        <PopupMenu
          title={`#${target.ticket} ${target.type} ${target.volume.toFixed(2)} ${target.symbol}`}
          onClose={() => setTarget(null)}
          items={[
            { label: "Close position", onClick: () => setClosing(target) },
            { label: "New order", onClick: () => navigate({ to: "/order", search: { symbol: target.symbol } }) },
            {
              label: "Chart",
              onClick: () => {
                setState((st) => ({ ...st, chart: { ...st.chart, symbol: target.symbol } }));
                navigate({ to: "/charts" });
              },
            },
          ]}
        />
      )}
      {closing && <CloseSheet p={closing} onClose={() => setClosing(null)} />}
    </>
  );
}

function CloseSheet({ p, onClose }: { p: Position; onClose: () => void }) {
  const s = useTerminal();
  const live = s.positions.find((x) => x.ticket === p.ticket);
  const q = s.display[p.symbol];
  const spec = getSpec(p.symbol);
  if (!live || !q) {
    return (
      <BottomSheet title="Position closed" onClose={onClose}>
        <div className="px-5 py-4 text-muted-foreground">This position is no longer open.</div>
      </BottomSheet>
    );
  }
  const cur = closePrice(p.type, q);
  const profit = positionProfit(p, cur, s.display);
  return (
    <BottomSheet title={`#${p.ticket} ${p.type} ${p.volume.toFixed(2)} ${p.symbol}`} onClose={onClose}>
      <div className="px-5 py-2">
        <Row label="Open price" value={fmtMoney(p.openPrice, spec.digits)} />
        <Row label="Current price" value={fmtMoney(cur, spec.digits)} />
        <Row label="Profit" value={fmtMoney(profit)} valueClass={profit < 0 ? "text-down" : "text-up"} />
        <button
          onClick={() => {
            void dispatch({ t: "close", tickets: [p.ticket] }).then((res) => {
              if (res) toast.success(`Position closed, ${(res.profit ?? 0).toFixed(2)} USD`);
              else toast.error("Could not close, check your connection");
            });
            onClose();
          }}
          className={cn(
            "mt-4 h-12 w-full rounded-xl text-[16px] font-medium text-primary-foreground",
            profit < 0 ? "bg-down" : "bg-primary",
          )}
        >
          Close with {profit < 0 ? "loss" : "profit"} {fmtMoney(profit)}
        </button>
      </div>
    </BottomSheet>
  );
}

export function TradeScreen() {
  const s = useTerminal();
  const [sort, setSort] = useState<SortKey>("open");
  const [sortMenu, setSortMenu] = useState(false);
  const sum = summarize(s.account.balance, s.positions, s.display, s.account.leverage);
  const has = s.positions.length > 0;
  return (
    <Page>
      <TopBar
        title="Trade"
        subtitle={`${fmtMoney(has ? sum.profit : s.account.balance)} USD`}
        subtitleClass={has ? (sum.profit < 0 ? "text-down" : "text-up") : undefined}
        actions={
          <>
            <IconBtn label="Sort" onClick={() => setSortMenu(true)}>
              <ArrowDownUp className="h-6 w-6" strokeWidth={1.8} />
            </IconBtn>
            <Link to="/order" search={{ symbol: s.chart.symbol }} aria-label="New order" className="grid h-11 w-11 place-items-center rounded-full press">
              <FilePlus2 className="h-6 w-6" strokeWidth={1.8} />
            </Link>
          </>
        }
      />
      <Scroll>
        <TradeSummary />
        <PositionsList sort={sort} />
      </Scroll>
      {sortMenu && (
        <PopupMenu
          title="Sort by"
          onClose={() => setSortMenu(false)}
          items={[
            { label: `${sort === "open" ? "✓ " : ""}Open time`, onClick: () => setSort("open") },
            { label: `${sort === "symbol" ? "✓ " : ""}Symbol`, onClick: () => setSort("symbol") },
            { label: `${sort === "profit" ? "✓ " : ""}Profit`, onClick: () => setSort("profit") },
          ]}
        />
      )}
    </Page>
  );
}
