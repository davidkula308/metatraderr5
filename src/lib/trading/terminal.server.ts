import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { fetchQuotes } from "@/lib/market/market.server";
import {
  advanceTo,
  applyCommand,
  collectLogs,
  fromShared,
  toShared,
  withRealQuotes,
  type Command,
  type CommandResult,
  type LogEntry,
  type LogData,
  type LogKind,
  type SharedState,
} from "./commands";
import { initialState } from "./ops";

export interface TerminalSnapshot {
  shared: SharedState;
  logs: LogEntry[];
  /** True when `logs` is the complete recent history (first load or after a reset). */
  full: boolean;
  serverTime: number;
  result: CommandResult | null;
}

async function load(): Promise<{ state: Partial<SharedState>; version: number } | null> {
  const { data, error } = await supabaseAdmin.from("terminal").select("state, version").eq("id", 1).maybeSingle();
  if (error) throw new Error(`Could not load terminal: ${error.message}`);
  if (!data) return null;
  return { state: data.state as unknown as Partial<SharedState>, version: data.version };
}

async function commit(expected: number, shared: SharedState, logs: unknown[], reset: boolean): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("terminal_commit", {
    p_expected: expected,
    p_state: shared as unknown as Json,
    p_logs: logs as unknown as Json,
    p_reset: reset,
  });
  if (error) throw new Error(`Could not save terminal: ${error.message}`);
  return typeof data === "number" && data > 0;
}

async function readLogs(since: number): Promise<LogEntry[]> {
  const { data, error } = await supabaseAdmin
    .from("terminal_log")
    .select("id, kind, data")
    .gt("id", since)
    .order("id", { ascending: false })
    .limit(since > 0 ? 1000 : 4000);
  if (error) throw new Error(`Could not load history: ${error.message}`);
  return (data ?? []).map((r) => ({ id: Number(r.id), kind: r.kind as LogKind, data: r.data as unknown as LogData }));
}

/**
 * Bring the shared terminal up to date (live prices + simulation), optionally run one command,
 * save it, and return what the phone needs to show.
 */
export async function runCycle(opts: { cmd?: Command; since?: number; epoch?: number; noLogs?: boolean }): Promise<TerminalSnapshot> {
  const quotes = await fetchQuotes();
  let result: CommandResult | null = null;
  let shared: SharedState | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const now = Date.now();
    const row = await load();
    let s = row ? fromShared(row.state, now) : { ...initialState(now), hydrated: true };
    const startEpoch = row ? s.epoch : 0;
    s = withRealQuotes(s, quotes, now);
    s = advanceTo(s, now);
    if (opts.cmd) {
      const r = applyCommand(s, opts.cmd, now);
      s = r.state;
      result = r.result;
    }
    const logs = collectLogs(s);
    const next = toShared(s);
    const ok = await commit(row?.version ?? 0, next, logs, s.epoch !== startEpoch && startEpoch !== 0);
    if (ok) {
      shared = next;
      break;
    }
    // Another phone saved first. A plain refresh can just show that; a command must retry.
    if (!opts.cmd && row) {
      const fresh = await load();
      if (fresh) {
        shared = toShared(fromShared(fresh.state, now));
        break;
      }
    }
  }
  if (!shared) throw new Error("The terminal is busy, try again");

  const full = !opts.since || opts.epoch !== shared.epoch;
  const logs = opts.noLogs ? [] : await readLogs(full ? 0 : (opts.since ?? 0));
  return { shared, logs, full, serverTime: Date.now(), result };
}
