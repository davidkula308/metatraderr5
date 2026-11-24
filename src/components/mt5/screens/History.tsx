import { useMemo, useState } from "react";
import { ArrowDownUp, CalendarDays, CalendarRange, Check, ChartColumnIncreasing, CircleDollarSign } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getSpec } from "@/lib/market/symbols";
import { fmtMoney } from "@/lib/trading/calc";
import { useTerminal } from "@/lib/trading/store";
import { fmtDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { BottomSheet, IconBtn, Page, PopupMenu, Row, Scroll, TopBar } from "../Shell";

type Tab = "positions" | "orders" | "deals";
type Period = "today" | "week" | "month" | "3months" | "custom";

const DAY = 86_400_000;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function short(ms: number) {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

function periodRange(p: Period, custom: { from: string; to: string }): [number, number] {
  const end = Date.now() + DAY;
  const t = startOfToday();
  if (p === "today") return [t, end];
  if (p === "week") return [t - 7 * DAY, end];
  if (p === "month") return [t - 30 * DAY, end];
  if (p === "3months") return [t - 91 * DAY, end];
  const from = custom.from ? new Date(custom.from + "T00:00").getTime() : 0;
  const to = custom.to ? new Date(custom.to + "T23:59:59").getTime() : end;
  return [from, to];
}

export function HistoryScreen() {
  const s = useTerminal();
  const [tab, setTab] = useState<Tab>("positions");
  const [period, setPeriod] = useState<Period>("today");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [calOpen, setCalOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [newestFirst, setNewestFirst] = useState(true);
  const [sortMenu, setSortMenu] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [report, setReport] = useState(false);
  const [from, to] = periodRange(period, custom);

  const inRange = (t: number) => t >= from && t <= to;
  const deals = s.deals.filter((d) => inRange(d.time));
  const balanceDeals = deals.filter((d) => d.type === "balance");
  const closed = s.history.filter((h) => inRange(h.closeTime));
  const orders = s.orders.filter((o) => inRange(o.time));
  const profit = closed.reduce((a, h) => a + h.profit, 0);
  const deposit = balanceDeals.filter((d) => d.profit > 0).reduce((a, d) => a + d.profit, 0);
  const withdrawal = balanceDeals.filter((d) => d.profit < 0).reduce((a, d) => a + d.profit, 0);
  const swap = closed.reduce((a, h) => a + h.swap, 0);
  const commission = closed.reduce((a, h) => a + h.commission, 0);
  const balance = profit + deposit + withdrawal + swap + commission;

  type Item = { key: string; time: number; node: React.ReactNode };
  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    if (tab === "positions") {
      for (const h of closed) {
        const spec = getSpec(h.symbol);
        out.push({
          key: `p${h.ticket}`,
          time: h.closeTime,
          node: (
            <>
              <div className="flex justify-between">
                <span className="font-condensed text-[18px]">
                  <span className="font-semibold">{h.symbol},</span>{" "}
                  <span className={h.type === "buy" ? "text-up" : "text-down"}>
                    {h.type} {h.volume.toFixed(2)}
                  </span>
                </span>
                <span className="font-num text-[15px] text-muted-foreground">{fmtDateTime(h.closeTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-num text-[16px] text-muted-foreground">
                  {fmtMoney(h.openPrice, spec.digits)} → {fmtMoney(h.closePrice, spec.digits)}
                </span>
                <span className={cn("font-num text-[17px] font-semibold", h.profit < 0 ? "text-down" : "text-up")}>
                  {fmtMoney(h.profit)}
                </span>
              </div>
            </>
          ),
        });
      }
    }
    if (tab === "orders") {
      for (const o of orders) {
        const spec = getSpec(o.symbol);
        out.push({
          key: `o${o.ticket}`,
          time: o.time,
          node: (
            <>
              <div className="flex justify-between">
                <span className="font-condensed text-[18px]">
                  <span className="font-semibold">{o.symbol},</span>{" "}
                  <span className={o.type === "buy" ? "text-up" : "text-down"}>
                    {o.type} {o.volume.toFixed(2)}
                  </span>
                </span>
                <span className="font-num text-[15px] text-muted-foreground">{fmtDateTime(o.time)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-num text-[16px] text-muted-foreground">
                  {o.volume.toFixed(2)} / {o.volume.toFixed(2)} at {fmtMoney(o.price, spec.digits)}
                </span>
                <span className="font-condensed text-[15px] font-semibold tracking-wide text-muted-foreground">FILLED</span>
              </div>
            </>
          ),
        });
      }
    }
    if (tab === "deals") {
      for (const d of deals) {
        if (d.type === "balance") continue;
        const spec = getSpec(d.symbol ?? "XAUUSD");
        out.push({
          key: `d${d.ticket}`,
          time: d.time,
          node: (
            <>
              <div className="flex justify-between">
                <span className="font-condensed text-[18px]">
                  <span className="font-semibold">{d.symbol},</span>{" "}
                  <span className={d.type === "buy" ? "text-up" : "text-down"}>
                    {d.type} {d.entry}
                  </span>
                </span>
                <span className="font-num text-[15px] text-muted-foreground">{fmtDateTime(d.time)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-num text-[16px] text-muted-foreground">
                  {d.volume.toFixed(2)} at {fmtMoney(d.price, spec.digits)}
                </span>
                <span className={cn("font-num text-[17px] font-semibold", d.profit < 0 ? "text-down" : d.entry === "out" ? "text-up" : "text-muted-foreground")}>
                  {fmtMoney(d.profit)}
                </span>
              </div>
            </>
          ),
        });
      }
    }
    if (tab !== "orders" && showBalance) {
      for (const d of balanceDeals) {
        out.push({
          key: `b${d.ticket}`,
          time: d.time,
          node: (
            <>
              <div className="flex justify-between">
                <span className="font-condensed text-[18px] font-semibold">Balance</span>
                <span className="font-num text-[15px] text-muted-foreground">{fmtDateTime(d.time)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-condensed text-[15px] text-muted-foreground">{d.comment}</span>
                <span className={cn("font-num text-[17px] font-semibold", d.profit < 0 ? "text-down" : "text-up")}>
                  {fmtMoney(d.profit)}
                </span>
              </div>
            </>
          ),
        });
      }
    }
    out.sort((a, b) => (newestFirst ? a.time - b.time : b.time - a.time));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, s.deals, s.history, s.orders, from, to, newestFirst, showBalance]);

  const periods: { key: Period; label: string; sub: string }[] = [
    { key: "today", label: "Today", sub: short(Date.now()) },
    { key: "week", label: "Last week", sub: `${short(Date.now() - 7 * DAY)} - ${short(Date.now())}` },
    { key: "month", label: "Last month", sub: `${short(Date.now() - 30 * DAY)} - ${short(Date.now())}` },
    { key: "3months", label: "Last 3 months", sub: `${short(Date.now() - 91 * DAY)} - ${short(Date.now())}` },
    { key: "custom", label: "Custom period", sub: "" },
  ];

  return (
    <Page>
      <TopBar
        title="History"
        subtitle="All symbols"
        actions={
          <>
            <IconBtn label="Show balance operations" onClick={() => setShowBalance((v) => !v)} active={!showBalance}>
              <CircleDollarSign className="h-6 w-6" strokeWidth={1.8} />
            </IconBtn>
            <IconBtn label="Sort" onClick={() => setSortMenu(true)}>
              <ArrowDownUp className="h-6 w-6" strokeWidth={1.8} />
            </IconBtn>
            <IconBtn label="Period" onClick={() => setCalOpen(true)}>
              <CalendarDays className="h-6 w-6" strokeWidth={1.8} />
            </IconBtn>
            <IconBtn label="Report" onClick={() => setReport(true)}>
              <ChartColumnIncreasing className="h-6 w-6" strokeWidth={1.8} />
            </IconBtn>
          </>
        }
      />
      <div className="grid shrink-0 grid-cols-3 border-b border-border">
        {(["positions", "orders", "deals"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "h-12 border-b-[3px] font-condensed text-[17px] uppercase tracking-wide",
              tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <Scroll>
        <div className="border-b border-border px-4 py-2">
          {tab === "orders" ? (
            <>
              <Row label="Filled:" value={orders.length} />
              <Row label="Canceled:" value={0} />
              <Row label="Total:" value={orders.length} />
            </>
          ) : (
            <>
              <Row label="Profit:" value={fmtMoney(profit)} valueClass={profit < 0 ? "text-down" : "text-up"} />
              <Row label="Deposit" value={fmtMoney(deposit)} />
              {withdrawal !== 0 && <Row label="Withdrawal" value={fmtMoney(withdrawal)} />}
              <Row label="Swap:" value={fmtMoney(swap)} />
              <Row label="Commission:" value={fmtMoney(commission)} />
              <Row label="Balance:" value={fmtMoney(balance)} />
            </>
          )}
        </div>
        {items.map((it) => (
          <div key={it.key} className="border-b border-border px-4 py-1.5">
            {it.node}
          </div>
        ))}
      </Scroll>

      {calOpen && (
        <div className="absolute inset-0 z-50">
          <button aria-label="Close" className="absolute inset-0" onClick={() => setCalOpen(false)} />
          <div className="absolute right-12 top-10 w-[270px] overflow-hidden rounded-2xl bg-popover shadow-2xl animate-pop">
            {periods.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  setCalOpen(false);
                  if (p.key === "custom") setCustomOpen(true);
                  else setPeriod(p.key);
                }}
                className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left last:border-b-0 press"
              >
                {p.key === "custom" ? (
                  <CalendarRange className="h-7 w-7 text-icon" />
                ) : (
                  <CalendarDays className="h-7 w-7 text-icon" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-condensed text-[18px]">{p.label}</div>
                  {p.sub && <div className="font-condensed text-[14px] text-muted-foreground">{p.sub}</div>}
                </div>
                {period === p.key && <Check className="h-5 w-5 text-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}
      {customOpen && (
        <BottomSheet title="Custom period" onClose={() => setCustomOpen(false)}>
          <div className="space-y-3 px-5 py-3">
            <label className="block text-[14px] text-muted-foreground">
              From
              <input
                type="date"
                value={custom.from}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                className="mt-1 block h-11 w-full rounded-lg border border-input bg-background px-3 text-foreground"
              />
            </label>
            <label className="block text-[14px] text-muted-foreground">
              To
              <input
                type="date"
                value={custom.to}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                className="mt-1 block h-11 w-full rounded-lg border border-input bg-background px-3 text-foreground"
              />
            </label>
            <button
              onClick={() => {
                setPeriod("custom");
                setCustomOpen(false);
              }}
              className="h-12 w-full rounded-xl bg-primary font-medium text-primary-foreground"
            >
              Apply
            </button>
          </div>
        </BottomSheet>
      )}
      {sortMenu && (
        <PopupMenu
          title="Sort by time"
          onClose={() => setSortMenu(false)}
          items={[
            { label: `${newestFirst ? "✓ " : ""}Oldest first`, onClick: () => setNewestFirst(true) },
            { label: `${!newestFirst ? "✓ " : ""}Newest first`, onClick: () => setNewestFirst(false) },
          ]}
        />
      )}
      {report && <ReportSheet onClose={() => setReport(false)} />}
    </Page>
  );
}

function ReportSheet({ onClose }: { onClose: () => void }) {
  const s = useTerminal();
  const points = [...s.deals]
    .filter((d) => d.type === "balance" || d.entry === "out")
    .sort((a, b) => a.time - b.time)
    .reduce<{ t: string; v: number }[]>((acc, d) => {
      const prev = acc.at(-1)?.v ?? 0;
      acc.push({ t: fmtDateTime(d.time).slice(5, 16), v: Math.round((prev + d.profit) * 100) / 100 });
      return acc;
    }, []);
  const wins = s.history.filter((h) => h.profit > 0).length;
  return (
    <BottomSheet title="Balance growth" onClose={onClose}>
      <div className="h-52 px-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points}>
            <XAxis dataKey="t" hide />
            <YAxis domain={["auto", "auto"]} width={56} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Area type="monotone" dataKey="v" stroke="var(--primary)" fill="var(--pill-profit)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="px-5">
        <Row label="Trades" value={s.history.length} />
        <Row label="Profitable" value={wins} />
        <Row label="Balance" value={fmtMoney(s.account.balance)} />
      </div>
    </BottomSheet>
  );
}
