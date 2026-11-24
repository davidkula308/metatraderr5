import { getSpec, point } from "@/lib/market/symbols";
import { unitMs, zonedToUtc } from "@/lib/time";
import { closePrice, positionProfit, rateToUSD } from "./calc";
import { closePositions, computeDisplay, log, openPosition } from "./ops";
import type { AdminConfig, Batch, TerminalState } from "./types";

/** Close target in USD for a batch. */
export function batchTarget(cfg: AdminConfig, balance: number): number {
  const v = Math.max(0, cfg.targetValue);
  const t = cfg.targetType === "percent" ? (balance * v) / 100 : v;
  return Math.max(0.01, t);
}

export function computeStartAt(cfg: AdminConfig, now: number): number {
  if (cfg.startMode === "relative") return now + unitMs(cfg.startRelative.value, cfg.startRelative.unit);
  if (cfg.startMode === "clock" && cfg.startDate && cfg.startTime) {
    try {
      return zonedToUtc(cfg.startDate, cfg.startTime, cfg.startTz);
    } catch {
      return now;
    }
  }
  return now;
}

export function startEngine(s: TerminalState, now: number): TerminalState {
  const cfg = { ...s.admin };
  const startAt = computeStartAt(cfg, now);
  const st: TerminalState = {
    ...s,
    engine: {
      status: "scheduled",
      startAt,
      endAt: null,
      nextBatchAt: null,
      batch: null,
      batchesDone: 0,
      totalProfit: 0,
      config: cfg,
    },
  };
  return log(st, `Simulation scheduled: ${cfg.trades} x ${cfg.lot} ${cfg.symbol}`, "Admin", now);
}

/** Batch floating P/L in the favourable direction (positive = towards target). */
function batchFloating(s: TerminalState, b: Batch, sign: number): number {
  let sum = 0;
  for (const p of s.positions) {
    if (!b.tickets.includes(p.ticket)) continue;
    const q = s.display[p.symbol];
    if (!q) continue;
    sum += positionProfit(p, closePrice(p.type, q), s.display);
  }
  return sum * sign;
}

function finishBatch(s: TerminalState, now: number): TerminalState {
  const cfg = s.engine.config;
  return {
    ...s,
    engine: {
      ...s.engine,
      batch: null,
      nextBatchAt: now + unitMs(cfg.batchDelay.value, cfg.batchDelay.unit),
    },
  };
}

/** Advance the simulation by one step. `dt` is the step length in ms; the path is tuned per 500 ms. */
export function engineTick(input: TerminalState, now: number, rnd: () => number = Math.random, dt = 500): TerminalState {
  let s = input;
  const stepK = Math.max(0.1, dt / 500);
  const ease = (rate: number) => 1 - Math.pow(1 - rate, stepK);
  const noise = Math.sqrt(stepK);
  const e = s.engine;
  const cfg = e.config;
  const controlled = e.batch && e.batch.phase !== "opening" ? e.batch.symbol : null;

  // Let any simulation offset drift back to the real market price.
  let offsetsChanged = false;
  const offsets = { ...s.offsets };
  for (const [sym, off] of Object.entries(offsets)) {
    if (sym === controlled || off === 0) continue;
    const next = off * Math.pow(0.95, stepK);
    offsets[sym] = Math.abs(next) < point(getSpec(sym)) / 2 ? 0 : next;
    offsetsChanged = true;
  }
  if (offsetsChanged) {
    s = { ...s, offsets };
    s = { ...s, display: computeDisplay(s) };
  }

  if (e.status === "idle" || e.status === "finished") return s;

  if (e.status === "scheduled") {
    if (e.startAt !== null && now < e.startAt) return s;
    const endAt = cfg.runFor === "duration" ? now + unitMs(cfg.runDuration.value, cfg.runDuration.unit) : null;
    s = { ...s, engine: { ...e, status: "running", endAt, nextBatchAt: now } };
    return log(s, "Simulation started", "Admin", now);
  }

  // running or stopping
  const b = s.engine.batch;
  if (!b) {
    const expired = s.engine.endAt !== null && now >= s.engine.endAt;
    const onceDone = cfg.mode === "once" && s.engine.batchesDone >= 1;
    if (s.engine.status === "stopping" || expired || onceDone) {
      s = { ...s, engine: { ...s.engine, status: "finished", nextBatchAt: null } };
      return log(s, "Simulation finished", "Admin", now);
    }
    if (s.engine.nextBatchAt !== null && now < s.engine.nextBatchAt) return s;
    if (!s.display[cfg.symbol]) return s;
    const side = cfg.direction === "random" ? (rnd() < 0.5 ? "buy" : "sell") : cfg.direction;
    const batch: Batch = {
      id: s.engine.batchesDone + 1,
      symbol: cfg.symbol,
      side,
      toOpen: Math.max(1, Math.min(100, Math.round(cfg.trades))),
      tickets: [],
      openedAt: now,
      firstEndsAt: now,
      phase: "opening",
      F: 0,
      target: batchTarget(cfg, s.account.balance),
      depth: Math.max(0.01, cfg.maxFloating),
    };
    return { ...s, engine: { ...s.engine, batch } };
  }

  const sign = cfg.closeOn === "profit" ? 1 : -1;

  if (b.phase === "opening") {
    const { state, ticket } = openPosition(s, b.symbol, b.side, Math.max(0.01, cfg.lot), now, true);
    s = state;
    const tickets = ticket !== null ? [...b.tickets, ticket] : b.tickets;
    const toOpen = ticket !== null ? b.toOpen - 1 : b.toOpen;
    let nb: Batch = { ...b, tickets, toOpen };
    if (toOpen <= 0) {
      nb = {
        ...nb,
        phase: "first",
        openedAt: now,
        firstEndsAt: now + unitMs(cfg.firstPhase.value, cfg.firstPhase.unit),
        F: batchFloating(s, nb, sign),
      };
    }
    return { ...s, engine: { ...s.engine, batch: nb } };
  }

  const alive = s.positions.filter((p) => b.tickets.includes(p.ticket));
  if (alive.length === 0) return finishBatch(s, now);

  // Evolve the favourable P/L along the configured path.
  let F = b.F;
  let phase = b.phase;
  if (phase === "first" && now >= b.firstEndsAt) phase = "second";
  if (phase === "first") {
    const wave = -b.depth * (0.6 + 0.4 * Math.sin(((now - b.openedAt) / 18000) * Math.PI * 2));
    F += (wave - F) * ease(0.12) + (rnd() - 0.5) * b.depth * 0.1 * noise;
    F = Math.min(-0.02 * b.depth, Math.max(-b.depth * 1.1, F));
  } else {
    const goal = b.target * 1.3 + b.depth * 0.1;
    F += (goal - F) * ease(0.05) + (rnd() - 0.42) * Math.max(b.depth, b.target) * 0.06 * noise;
  }

  // Translate the desired P/L into the symbol price shown in the app.
  const spec = getSpec(b.symbol);
  const real = s.real[b.symbol];
  if (!real) return s;
  const dir = b.side === "buy" ? 1 : -1;
  const rate = rateToUSD(spec.quote, s.display);
  let k = 0;
  let w = 0;
  for (const p of alive) {
    const units = p.volume * spec.contract * rate;
    k += units;
    w += p.openPrice * units;
  }
  const avgOpen = w / k;
  const desiredPnl = F * sign;
  const closeAt = avgOpen + desiredPnl / (dir * k);
  const desiredBid = b.side === "buy" ? closeAt : closeAt - spec.spread * point(spec);
  s = { ...s, offsets: { ...s.offsets, [b.symbol]: desiredBid - real.bid } };
  s = { ...s, display: computeDisplay(s) };

  const actual = batchFloating(s, b, sign);
  if (phase === "second" && actual >= b.target) {
    const res = closePositions(s, alive.map((p) => p.ticket), now);
    s = res.state;
    s = log(s, `Batch #${b.id} closed, result ${res.profit.toFixed(2)} USD`, "Admin", now);
    s = {
      ...s,
      engine: {
        ...s.engine,
        batchesDone: s.engine.batchesDone + 1,
        totalProfit: Math.round((s.engine.totalProfit + res.profit) * 100) / 100,
      },
    };
    return finishBatch(s, now);
  }
  return { ...s, engine: { ...s.engine, batch: { ...b, F, phase } } };
}

/** Close all simulated positions immediately and stop. */
export function stopEngineNow(s: TerminalState, now: number): TerminalState {
  const tickets = s.positions.filter((p) => p.sim).map((p) => p.ticket);
  let st = closePositions(s, tickets, now).state;
  st = { ...st, engine: { ...st.engine, status: "idle", batch: null, nextBatchAt: null, startAt: null, endAt: null } };
  return log(st, "Simulation stopped", "Admin", now);
}
