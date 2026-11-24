import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { Pause, Play, Square, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { getSpec, SYMBOLS } from "@/lib/market/symbols";
import { closePrice, fmtMoney, positionProfit } from "@/lib/trading/calc";
import { computeStartAt, startEngine, stopEngineNow, batchTarget } from "@/lib/trading/engine";
import { balanceOperation, initialState } from "@/lib/trading/ops";
import { isAdminUnlocked, nowMs, setState, useTerminal } from "@/lib/trading/store";
import type { AdminConfig, Duration } from "@/lib/trading/types";
import { dateInZone, fmtCountdown, formatInZone, POPULAR_ZONES, type TimeUnit } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Page, Scroll, TopBar } from "../Shell";
import { PositionsList, TradeSummary } from "./Trade";

function useNow(ms = 1000) {
  const [n, setN] = useState(() => nowMs());
  useEffect(() => {
    const id = setInterval(() => setN(nowMs()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return n;
}

function patchAdmin(p: Partial<AdminConfig>) {
  setState((s) => {
    const admin = { ...s.admin, ...p };
    const live = s.engine.status !== "idle" && s.engine.status !== "finished";
    return { ...s, admin, engine: live ? { ...s.engine, config: { ...s.engine.config, ...p } } : s.engine };
  });
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b-8 border-section">
      <div className="px-4 pb-1 pt-4 text-[13px] font-semibold uppercase tracking-wide text-primary">{title}</div>
      <div className="space-y-3 px-4 pb-4 pt-1">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[14px] font-medium text-foreground">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-[12px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

const inputCls =
  "font-num h-11 w-full rounded-lg border border-input bg-background px-3 text-[16px] text-foreground outline-none focus:border-primary";

function NumInput({ value, onChange, step = 1, min = 0 }: { value: number; onChange: (v: number) => void; step?: number; min?: number }) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => {
    if (Number(txt) !== value) setTxt(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      value={txt}
      onChange={(e) => {
        setTxt(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== "" && Number.isFinite(n) && n >= min) onChange(n);
      }}
      className={inputCls}
    />
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "h-9 flex-1 rounded-md text-[14px] font-medium transition-colors",
            value === o.v ? "bg-background text-primary shadow-sm" : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DurationInput({ value, onChange }: { value: Duration; onChange: (d: Duration) => void }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <NumInput value={value.value} onChange={(v) => onChange({ ...value, value: v })} />
      <select
        value={value.unit}
        onChange={(e) => onChange({ ...value, unit: e.target.value as TimeUnit })}
        className="h-11 rounded-lg border border-input bg-background px-2 text-[15px]"
      >
        <option value="seconds">Seconds</option>
        <option value="minutes">Minutes</option>
        <option value="hours">Hours</option>
      </select>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  idle: "Not running",
  scheduled: "Scheduled",
  running: "Running",
  stopping: "Pausing after this batch",
  finished: "Finished",
};

export function AdminScreen() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => setOk(isAdminUnlocked()), []);
  if (ok === null) return null;
  if (!ok) return <Navigate to="/settings" />;
  return <AdminPanel />;
}

function AdminPanel() {
  const s = useTerminal();
  const now = useNow();
  const a = s.admin;
  const e = s.engine;
  const [balance, setBalance] = useState(String(s.account.balance));
  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
    } catch {
      return POPULAR_ZONES.map((z) => z.tz);
    }
  }, []);
  const q = s.display[a.symbol];
  const spec = getSpec(a.symbol);
  const live = e.status === "scheduled" || e.status === "running" || e.status === "stopping";

  const batch = e.batch;
  const floating = batch
    ? s.positions
        .filter((p) => batch.tickets.includes(p.ticket))
        .reduce((acc, p) => {
          const pq = s.display[p.symbol];
          return pq ? acc + positionProfit(p, closePrice(p.type, pq), s.display) : acc;
        }, 0)
    : 0;

  let timerLabel = "";
  if (e.status === "scheduled" && e.startAt) timerLabel = `Starts in ${fmtCountdown(e.startAt - now)}`;
  else if (live && batch)
    timerLabel =
      batch.phase === "opening"
        ? "Opening trades…"
        : batch.phase === "first"
          ? `${e.config.closeOn === "profit" ? "Loss" : "Profit"} phase · ${fmtCountdown(batch.firstEndsAt - now)} left`
          : `Moving to close at ${e.config.closeOn === "profit" ? "+" : "-"}${batch.target.toFixed(2)} USD`;
  else if (live && e.nextBatchAt) timerLabel = `Next batch in ${fmtCountdown(e.nextBatchAt - now)}`;

  const startPreview = computeStartAt(a, now);
  const startDiff = startPreview - now;

  const start = () => {
    if (a.startMode === "clock" && (!a.startDate || !a.startTime)) {
      toast.error("Pick a start date and time");
      return;
    }
    setState((st) => startEngine(st, nowMs()));
    toast.success("Simulation started");
  };

  return (
    <Page nav={false}>
      <TopBar back title="Admin" />
      <Scroll>
        {/* Status */}
        <div className="m-4 rounded-2xl bg-section p-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] uppercase tracking-wide text-muted-foreground">Status</span>
            <span
              className={cn(
                "rounded-full px-3 py-0.5 text-[13px] font-medium",
                e.status === "running" ? "bg-pill-profit text-up" : e.status === "scheduled" || e.status === "stopping" ? "bg-pill text-icon" : "bg-pill text-muted-foreground",
              )}
            >
              {STATUS_LABEL[e.status]}
            </span>
          </div>
          {timerLabel && <div className="font-num mt-2 text-[18px] text-foreground">{timerLabel}</div>}
          {e.endAt && live && <div className="font-num text-[13px] text-muted-foreground">Automation ends in {fmtCountdown(e.endAt - now)}</div>}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="font-num text-[20px]">{e.batchesDone}</div>
              <div className="text-[12px] text-muted-foreground">Batches</div>
            </div>
            <div>
              <div className={cn("font-num text-[20px]", floating < 0 ? "text-down" : "text-up")}>{fmtMoney(floating)}</div>
              <div className="text-[12px] text-muted-foreground">Floating</div>
            </div>
            <div>
              <div className={cn("font-num text-[20px]", e.totalProfit < 0 ? "text-down" : "text-up")}>{fmtMoney(e.totalProfit)}</div>
              <div className="text-[12px] text-muted-foreground">Closed P/L</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {!live ? (
              <button onClick={start} className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground">
                <Play className="h-4 w-4" /> Start
              </button>
            ) : e.status === "stopping" ? (
              <button
                onClick={() => setState((st) => ({ ...st, engine: { ...st.engine, status: "running" } }))}
                className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground"
              >
                <Play className="h-4 w-4" /> Resume
              </button>
            ) : (
              <button
                onClick={() =>
                  setState((st) =>
                    st.engine.status === "scheduled"
                      ? { ...st, engine: { ...st.engine, status: "idle", startAt: null } }
                      : { ...st, engine: { ...st.engine, status: "stopping" } },
                  )
                }
                className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-secondary font-medium text-primary"
              >
                <Pause className="h-4 w-4" /> Pause
              </button>
            )}
            <button
              onClick={() => {
                setState((st) => stopEngineNow(st, nowMs()));
                toast("Simulation stopped");
              }}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-down font-medium text-down"
            >
              <Square className="h-4 w-4" /> Stop
            </button>
          </div>
          <div className="mt-2 text-[12px] text-muted-foreground">
            Pause lets the open batch close on its target, then stops. Stop closes simulated trades right away.
          </div>
        </div>

        {/* Live view */}
        <Section title="Live view (Trade section)">
          <div className="-mx-4">
            <TradeSummary />
            <PositionsList emptyText="No trades" />
          </div>
        </Section>

        <Section title="Account">
          <Field label="Account balance (USD)" hint="Set balance adds a deposit or withdrawal. Reset clears all trades and history.">
            <div className="grid grid-cols-[1fr_auto_auto] gap-2">
              <input type="number" inputMode="decimal" value={balance} onChange={(ev) => setBalance(ev.target.value)} className={inputCls} />
              <button
                onClick={() => {
                  const v = Number(balance);
                  if (!Number.isFinite(v) || v < 0) {
                    toast.error("Enter a valid amount");
                    return;
                  }
                  setState((st) => balanceOperation(st, v - st.account.balance, nowMs()));
                  toast.success("Balance updated");
                }}
                className="h-11 rounded-lg bg-primary px-3 text-[14px] font-medium text-primary-foreground"
              >
                Set
              </button>
              <button
                aria-label="Reset account"
                onClick={() => {
                  const v = Number(balance);
                  if (!Number.isFinite(v) || v <= 0) {
                    toast.error("Enter a valid amount");
                    return;
                  }
                  setState((st) => {
                    const fresh = initialState(nowMs());
                    const base = { ...fresh, deals: fresh.deals.map((d) => ({ ...d, profit: v })) };
                    return {
                      ...st,
                      positions: [],
                      history: [],
                      orders: [],
                      deals: base.deals,
                      journal: [],
                      offsets: {},
                      nextTicket: base.nextTicket,
                      account: { ...st.account, balance: v },
                      engine: { ...base.engine, config: st.admin },
                    };
                  });
                  toast.success("Account reset");
                }}
                className="grid h-11 w-11 place-items-center rounded-lg border border-input text-icon"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Leverage">
              <select
                value={s.account.leverage}
                onChange={(ev) => setState((st) => ({ ...st, account: { ...st.account, leverage: Number(ev.target.value) } }))}
                className="h-11 w-full rounded-lg border border-input bg-background px-2"
              >
                {[50, 100, 200, 500, 1000, 2000, 3000].map((l) => (
                  <option key={l} value={l}>
                    1:{l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Login">
              <input value={s.account.login} onChange={(ev) => setState((st) => ({ ...st, account: { ...st.account, login: ev.target.value } }))} className={inputCls} />
            </Field>
          </div>
          <Field label="Account name">
            <input value={s.account.name} onChange={(ev) => setState((st) => ({ ...st, account: { ...st.account, name: ev.target.value } }))} className={inputCls} />
          </Field>
          <Field label="Server">
            <input value={s.account.server} onChange={(ev) => setState((st) => ({ ...st, account: { ...st.account, server: ev.target.value } }))} className={inputCls} />
          </Field>
        </Section>

        <Section title="Trades">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Number of trades">
              <NumInput value={a.trades} min={1} onChange={(v) => patchAdmin({ trades: Math.max(1, Math.round(v)) })} />
            </Field>
            <Field label="Lot size">
              <NumInput value={a.lot} step={0.01} min={0.01} onChange={(v) => patchAdmin({ lot: Math.max(0.01, Math.round(v * 100) / 100) })} />
            </Field>
          </div>
          <Field label="Pair">
            <select value={a.symbol} onChange={(ev) => patchAdmin({ symbol: ev.target.value })} className="h-11 w-full rounded-lg border border-input bg-background px-2 font-condensed text-[16px]">
              {SYMBOLS.map((x) => (
                <option key={x.name} value={x.name}>
                  {x.name} – {x.description}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-center justify-between rounded-lg bg-section px-3 py-2">
            <span className="font-condensed text-[16px] font-semibold">{a.symbol} live</span>
            <span className="font-num text-[16px]">
              <span className="text-down">{q ? q.bid.toFixed(spec.digits) : "…"}</span>
              {" / "}
              <span className="text-up">{q ? q.ask.toFixed(spec.digits) : "…"}</span>
            </span>
          </div>
          <Field label="Direction">
            <Segmented
              value={a.direction}
              onChange={(v) => patchAdmin({ direction: v })}
              options={[
                { v: "random", label: "Random" },
                { v: "buy", label: "Buy" },
                { v: "sell", label: "Sell" },
              ]}
            />
          </Field>
        </Section>

        <Section title="Close rules">
          <Field label="Close on">
            <Segmented
              value={a.closeOn}
              onChange={(v) => patchAdmin({ closeOn: v })}
              options={[
                { v: "profit", label: "On profit" },
                { v: "loss", label: "On loss" },
              ]}
            />
          </Field>
          <Field label="Close when the batch reaches">
            <Segmented
              value={a.targetType}
              onChange={(v) => patchAdmin({ targetType: v })}
              options={[
                { v: "amount", label: "Amount ($)" },
                { v: "percent", label: "% of equity" },
              ]}
            />
          </Field>
          <Field
            label={a.targetType === "amount" ? `${a.closeOn === "profit" ? "Profit" : "Loss"} target (USD)` : `${a.closeOn === "profit" ? "Profit" : "Loss"} target (% of equity)`}
            hint={`Each batch closes all at once at about ${batchTarget(a, s.account.balance).toFixed(2)} USD.`}
          >
            <NumInput value={a.targetValue} step={0.1} onChange={(v) => patchAdmin({ targetValue: v })} />
          </Field>
          <Field
            label={`Stay in ${a.closeOn === "profit" ? "loss" : "profit"} for`}
            hint={`Trades swing ${a.closeOn === "profit" ? "negative" : "positive"} for this long before turning.`}
          >
            <DurationInput value={a.firstPhase} onChange={(d) => patchAdmin({ firstPhase: d })} />
          </Field>
          <Field label={`Deepest floating ${a.closeOn === "profit" ? "loss" : "profit"} (USD)`}>
            <NumInput value={a.maxFloating} step={0.5} onChange={(v) => patchAdmin({ maxFloating: v })} />
          </Field>
          <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2">
            <div>
              <div className="text-[14px] font-medium">Use TP and SL</div>
              <div className="text-[12px] text-muted-foreground">Coming in a later update</div>
            </div>
            <Switch checked={a.useTpSl} disabled onCheckedChange={(v) => patchAdmin({ useTpSl: v })} />
          </div>
        </Section>

        <Section title="Automation">
          <Field label="Run">
            <Segmented
              value={a.mode}
              onChange={(v) => patchAdmin({ mode: v })}
              options={[
                { v: "once", label: "One time" },
                { v: "auto", label: "Automation" },
              ]}
            />
          </Field>
          {a.mode === "auto" && (
            <>
              <Field label="Keep repeating">
                <Segmented
                  value={a.runFor}
                  onChange={(v) => patchAdmin({ runFor: v })}
                  options={[
                    { v: "duration", label: "For a set time" },
                    { v: "untilPaused", label: "Until paused" },
                  ]}
                />
              </Field>
              {a.runFor === "duration" && (
                <Field label="Run for">
                  <DurationInput value={a.runDuration} onChange={(d) => patchAdmin({ runDuration: d })} />
                </Field>
              )}
              <Field label="Delay before the next batch">
                <DurationInput value={a.batchDelay} onChange={(d) => patchAdmin({ batchDelay: d })} />
              </Field>
            </>
          )}
        </Section>

        <Section title="Start time">
          <Segmented
            value={a.startMode}
            onChange={(v) => {
              const patch: Partial<AdminConfig> = { startMode: v };
              if (v === "clock" && !a.startDate) {
                patch.startDate = dateInZone(nowMs(), a.startTz);
                patch.startTime = formatInZone(nowMs() + 10 * 60_000, a.startTz, false);
              }
              patchAdmin(patch);
            }}
            options={[
              { v: "now", label: "Now" },
              { v: "relative", label: "After" },
              { v: "clock", label: "At time" },
            ]}
          />
          {a.startMode === "relative" && (
            <Field label="Start after">
              <DurationInput value={a.startRelative} onChange={(d) => patchAdmin({ startRelative: d })} />
            </Field>
          )}
          {a.startMode === "clock" && (
            <>
              <Field label="Time zone">
                <select value={a.startTz} onChange={(ev) => patchAdmin({ startTz: ev.target.value })} className="h-11 w-full rounded-lg border border-input bg-background px-2">
                  <optgroup label="Popular">
                    {POPULAR_ZONES.map((z) => (
                      <option key={z.tz} value={z.tz}>
                        {z.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="All time zones">
                    {zones.map((z) => (
                      <option key={z} value={z}>
                        {z.replace(/_/g, " ")}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </Field>
              <div className="rounded-lg bg-section px-3 py-2 text-[14px]">
                Current time there: <span className="font-num font-semibold">{formatInZone(now, a.startTz)}</span>{" "}
                <span className="text-muted-foreground">({dateInZone(now, a.startTz)})</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <input type="date" value={a.startDate} onChange={(ev) => patchAdmin({ startDate: ev.target.value })} className={inputCls} />
                </Field>
                <Field label="Time">
                  <input type="time" value={a.startTime} onChange={(ev) => patchAdmin({ startTime: ev.target.value })} className={inputCls} />
                </Field>
              </div>
            </>
          )}
          {a.startMode !== "now" && (
            <div className="text-[13px] text-muted-foreground">
              {startDiff > 0 ? (
                <>
                  Starts in <span className="font-num font-semibold text-foreground">{fmtCountdown(startDiff)}</span> · your time{" "}
                  {new Date(startPreview).toLocaleTimeString("en-GB")}
                </>
              ) : (
                "This time has passed – it will start right away."
              )}
            </div>
          )}
          <div className="mt-2 rounded-xl border border-border">
            <div className="border-b border-border px-3 py-2 text-[13px] font-medium text-muted-foreground">World clock (online time)</div>
            {POPULAR_ZONES.map((z) => (
              <div key={z.tz} className="flex justify-between px-3 py-1.5 text-[14px]">
                <span>{z.label}</span>
                <span className="font-num">{formatInZone(now, z.tz)}</span>
              </div>
            ))}
          </div>
        </Section>
        <div className="h-8" />
      </Scroll>
    </Page>
  );
}

