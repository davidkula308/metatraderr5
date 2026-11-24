import { getSpec, point } from "@/lib/market/symbols";
import { dateInZone, zonedToUtc } from "@/lib/time";
import { rateToUSD } from "./calc";
import { startEngine } from "./engine";
import { balanceOperation, closePositions, log, openPosition } from "./ops";
import type { RemoteConfig } from "./remote-config";
import type { TerminalState } from "./types";

function targetPrice(s: TerminalState, p: TerminalState["positions"][number], win: boolean) {
  const spec = getSpec(p.symbol);
  const units = p.volume * spec.contract * rateToUSD(spec.quote, s.display);
  const pip = point(spec) * (spec.digits === 3 || spec.digits === 5 ? 10 : 1);
  const distance = Math.max(pip, (s.remote?.config.entryPips ?? 20) * pip);
  const amount = Math.max(0.01, distance * units);
  // Net outcome includes swap and commission, not just the price movement.
  const gross = (win ? amount : -amount) - p.swap - p.commission;
  return Number((p.openPrice + (p.type === "buy" ? 1 : -1) * gross / units).toFixed(spec.digits));
}

export function closeAllInProfit(s: TerminalState, now: number): TerminalState {
  const marked = { ...s, positions: s.positions.map((p) => ({ ...p, markPrice: targetPrice(s, p, true) })) };
  const result = closePositions(marked, marked.positions.map((p) => p.ticket), now);
  return { ...result.state, engine: { ...result.state.engine, batch: null, nextBatchAt: now + (s.remote?.config.cooldownSec ?? 10) * 1000 } };
}

/** Map remote settings to the same saved account/admin record as the local controls. */
export function applyRemoteConfig(input: TerminalState, patch: RemoteConfig, now: number): TerminalState {
  const old = input.remote?.config ?? {};
  if (patch.version !== undefined && old.version !== undefined && patch.version <= old.version) return input;
  const config = { ...old, ...patch };
  let s: TerminalState = { ...input, remote: {
    config, active: input.remote?.active ?? false, receivedAt: now,
    lastNonce: input.remote?.lastNonce ?? 0, tradeSequence: input.remote?.tradeSequence ?? 0, forceLoss: false,
  } };
  const account = { ...s.account,
    ...(patch.accountName !== undefined ? { name: patch.accountName } : {}),
    ...(patch.login !== undefined ? { login: patch.login } : {}),
    ...(patch.server !== undefined ? { server: patch.server } : {}),
    ...(patch.company !== undefined ? { company: patch.company } : {}),
  };
  const admin = { ...s.admin,
    ...(patch.symbol !== undefined ? { symbol: patch.symbol } : {}),
    ...(patch.lot !== undefined ? { lot: patch.lot } : {}),
    ...(patch.tradesPerWave !== undefined ? { trades: patch.tradesPerWave } : {}),
    ...(patch.execMode !== undefined ? { direction: patch.execMode === "buy" || patch.execMode === "sell" ? patch.execMode : "random" as const } : {}),
    ...(patch.holdSec !== undefined ? { firstPhase: { value: patch.holdSec, unit: "seconds" as const } } : {}),
    ...(patch.cooldownSec !== undefined ? { batchDelay: { value: patch.cooldownSec, unit: "seconds" as const } } : {}),
    ...(patch.continuity !== undefined ? { mode: patch.continuity === "single" ? "once" as const : "auto" as const } : {}),
    ...(patch.outcome !== undefined ? { closeOn: "profit" as const } : {}),
  };
  s = { ...s, account, admin, engine: { ...s.engine, config: admin } };
  if (patch.historyDeposit !== undefined && patch.historyDeposit !== old.historyDeposit) {
    s = balanceOperation(s, patch.historyDeposit - (old.historyDeposit ?? 0), now, "Remote history deposit");
  }
  if (patch.balance !== undefined && patch.balance !== old.balance) s = balanceOperation(s, patch.balance - s.account.balance, now);
  if (patch.charge !== undefined && patch.charge !== old.charge) s = balanceOperation(s, -(patch.charge - (old.charge ?? 0)), now, "Remote charge");
  if (patch.swap !== undefined || patch.commission !== undefined) s = { ...s, positions: s.positions.map((p) => ({
    ...p, swap: patch.swap ?? p.swap, commission: patch.commission ?? p.commission,
  })) };
  if (patch.closeAllNonce !== undefined && patch.closeAllNonce > (input.remote?.lastNonce ?? 0)) {
    s = closeAllInProfit(s, now);
    if (s.remote) s = { ...s, remote: { ...s.remote, lastNonce: patch.closeAllNonce } };
  }
  if (patch.botRunning === false) {
    s = { ...s, engine: { ...s.engine, status: "idle", batch: null, nextBatchAt: null }, remote: s.remote ? { ...s.remote, active: false } : null };
  } else if (patch.botRunning === true && (input.remote?.active !== true || ["idle", "finished", "stopping"].includes(input.engine.status))) {
    let startAt = now;
    if (config.startTime) {
      const tz = s.admin.startTz;
      startAt = zonedToUtc(dateInZone(now, tz), config.startTime, tz);
      if (startAt < now) startAt = zonedToUtc(dateInZone(now + 86_400_000, tz), config.startTime, tz);
    }
    s = startEngine({ ...s, admin: { ...admin, startMode: "now" } }, now);
    s = { ...s, engine: { ...s.engine, startAt }, remote: s.remote ? { ...s.remote, active: true } : null };
  }
  return log(s, "Remote settings saved", "Remote", now);
}

/** Independent marks let a mixed buy/sell wave have the requested per-trade outcomes. */
export function remoteTick(input: TerminalState, now: number): TerminalState {
  const remote = input.remote;
  if (!remote?.active) return input;
  let s = input;
  const cfg = remote.config;
  if (s.engine.status === "scheduled") {
    if (now < (s.engine.startAt ?? now)) return s;
    s = { ...s, engine: { ...s.engine, status: "running", nextBatchAt: now } };
  }
  if (!["running", "stopping"].includes(s.engine.status)) return s;
  const positions = s.positions.filter((p) => p.remoteSequence !== undefined);
  if (positions.length) {
    const hold = s.admin.firstPhase.value * (s.admin.firstPhase.unit === "hours" ? 3600 : s.admin.firstPhase.unit === "minutes" ? 60 : 1) * 1000;
    s = { ...s, positions: s.positions.map((p) => {
      if (p.remoteSequence === undefined) return p;
      const progress = hold === 0 ? 1 : Math.min(1, (now - p.openTime) / hold);
      const win = !remote.forceLoss && (cfg.outcome !== "winlose" || p.remoteSequence % 5 !== 4);
      const target = targetPrice(s, p, win);
      return { ...p, markPrice: p.openPrice + (target - p.openPrice) * progress };
    }) };
    const due = s.positions.filter((p) => p.remoteSequence !== undefined && now - p.openTime >= hold);
    if (!due.length) return s;
    const result = closePositions(s, due.map((p) => p.ticket), now);
    s = result.state;
    if (!s.positions.some((p) => p.remoteSequence !== undefined)) s = { ...s, engine: {
      ...s.engine, batch: null, batchesDone: s.engine.batchesDone + 1,
      totalProfit: Math.round((s.engine.totalProfit + result.profit) * 100) / 100,
      nextBatchAt: now + s.admin.batchDelay.value * (s.admin.batchDelay.unit === "hours" ? 3600 : s.admin.batchDelay.unit === "minutes" ? 60 : 1) * 1000,
    } };
    return s;
  }
  if (s.engine.status === "stopping" || (s.admin.mode === "once" && s.engine.batchesDone >= 1)) {
    return { ...s, engine: { ...s.engine, status: "finished", nextBatchAt: null }, remote: { ...remote, active: false } };
  }
  if (now < (s.engine.nextBatchAt ?? now) || !s.display[s.admin.symbol]) return s;
  let sequence = remote.tradeSequence;
  for (let i = 0; i < s.admin.trades; i++) {
    const mode = cfg.execMode ?? "buy";
    const side = mode === "sell" ? "sell" : mode === "buy" ? "buy" : mode === "candle" ? ((s.display[s.admin.symbol]?.dir ?? 1) < 0 ? "sell" : "buy") : sequence % 2 === 0 ? "buy" : "sell";
    const result = openPosition(s, s.admin.symbol, side, s.admin.lot, now, true);
    s = { ...result.state, positions: result.state.positions.map((p) => p.ticket === result.ticket ? {
      ...p, remoteSequence: sequence, markPrice: p.openPrice, swap: cfg.swap ?? 0, commission: cfg.commission ?? 0,
    } : p) };
    if (result.ticket !== null) sequence++;
  }
  return { ...s, remote: { ...remote, tradeSequence: sequence } };
}