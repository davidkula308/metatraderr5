import { useSyncExternalStore } from "react";
import { applyCommand, mergeLogs, type Command, type CommandResult, type LogEntry, type SharedState } from "./commands";
import { initialState } from "./ops";
import type { Account, AdminConfig, TerminalState } from "./types";

/**
 * Client copy of the shared terminal. The account, trades and admin settings come from the
 * server (shared by every phone); the quotes list, chart choice and UI switches stay on this phone.
 */

const LOCAL_KEY = "mt5sim:local:v2";
const ADMIN_KEY = "mt5sim:adminCode";
const ADMIN_CODE = "4030";

let state: TerminalState = initialState(0);
const serverState = state;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let clockSkew = 0;

export function nowMs() {
  return Date.now() + clockSkew;
}

export function setClockSkew(ms: number) {
  clockSkew = ms;
}

function persistLocal() {
  if (typeof window === "undefined") return;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify({ quotesList: state.quotesList, chart: state.chart, settings: state.settings }));
    } catch {
      /* storage full or disabled */
    }
  }, 500);
}

export function getState() {
  return state;
}

/** Change local view state (chart, quotes list, switches). */
export function setState(updater: (s: TerminalState) => TerminalState) {
  const next = updater(state);
  if (next === state) return;
  state = next;
  persistLocal();
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useTerminal(): TerminalState {
  return useSyncExternalStore(subscribe, getState, () => serverState);
}

/** Load this phone's own view preferences. */
export function hydrate() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return;
    const loaded = JSON.parse(raw) as Partial<Pick<TerminalState, "quotesList" | "chart" | "settings">>;
    setState((s) => ({
      ...s,
      quotesList: Array.isArray(loaded.quotesList) && loaded.quotesList.length ? loaded.quotesList : s.quotesList,
      chart: { ...s.chart, ...(loaded.chart ?? {}) },
      settings: { ...s.settings, ...(loaded.settings ?? {}) },
    }));
  } catch {
    /* ignore broken storage */
  }
}

/* ---------------- server sync ---------------- */

export interface Snapshot {
  shared: SharedState;
  logs: LogEntry[];
  full: boolean;
  serverTime: number;
  result: CommandResult | null;
}

interface Transport {
  sync: (d: { since: number; epoch: number }) => Promise<Snapshot>;
  send: (d: { since: number; epoch: number; cmd: Command; code?: string }) => Promise<Snapshot>;
}

let transport: Transport | null = null;
let cursor = 0;
let pending = 0;
let mutationSeq = 0;
let queue: Promise<unknown> = Promise.resolve();

export function setTransport(t: Transport) {
  transport = t;
}

export function applySnapshot(snap: Snapshot) {
  setState((s) => {
    const base = snap.full ? { deals: [], orders: [], history: [], journal: [] } : s;
    return { ...s, ...snap.shared, ...mergeLogs(base, snap.logs), hydrated: true };
  });
  let max = snap.full ? 0 : cursor;
  for (const r of snap.logs) if (r.id > max) max = r.id;
  cursor = max;
}

/** Pull the latest shared account from the server (skipped while this phone is saving a change). */
export async function syncNow() {
  if (!transport || pending > 0) return;
  const seq = mutationSeq;
  const sent = Date.now();
  const snap = await transport.sync({ since: cursor, epoch: state.epoch });
  if (pending > 0 || seq !== mutationSeq) return;
  setClockSkew(snap.serverTime - (sent + Date.now()) / 2);
  applySnapshot(snap);
}

function send(cmd: Command): Promise<CommandResult | null> {
  pending++;
  mutationSeq++;
  const run = async () => {
    try {
      if (!transport) throw new Error("Not connected");
      const code = getAdminCode();
      const snap = await transport.send({ since: cursor, epoch: state.epoch, cmd, ...(code ? { code } : {}) });
      mutationSeq++;
      applySnapshot(snap);
      return snap.result ?? {};
    } catch (e) {
      console.error(e);
      return null;
    } finally {
      pending--;
    }
  };
  const p = queue.then(run, run);
  queue = p;
  return p;
}

/** Apply a change on this phone right away and save it for every phone. */
export function dispatch(cmd: Command): Promise<CommandResult | null> {
  setState((s) => {
    const r = applyCommand(s, cmd, nowMs());
    // History lists only ever come from the server, so they never show twice.
    return { ...r.state, deals: s.deals, orders: s.orders, history: s.history, journal: s.journal };
  });
  return send(cmd);
}

let adminPatch: Partial<AdminConfig> = {};
let accountPatch: Partial<Account> = {};
let patchTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePatch() {
  if (patchTimer) clearTimeout(patchTimer);
  else pending++;
  patchTimer = setTimeout(() => {
    patchTimer = null;
    const a = adminPatch;
    const b = accountPatch;
    adminPatch = {};
    accountPatch = {};
    if (Object.keys(a).length) void send({ t: "admin", patch: a });
    if (Object.keys(b).length) void send({ t: "account", patch: b as Extract<Command, { t: "account" }>["patch"] });
    pending--;
  }, 600);
}

/** Edit admin settings (typing-friendly: saved shortly after the last change). */
export function patchAdmin(p: Partial<AdminConfig>) {
  setState((s) => applyCommand(s, { t: "admin", patch: p }, nowMs()).state);
  adminPatch = { ...adminPatch, ...p };
  schedulePatch();
}

export function patchAccount(p: Partial<Pick<Account, "name" | "login" | "server" | "leverage">>) {
  setState((s) => ({ ...s, account: { ...s.account, ...p } }));
  accountPatch = { ...accountPatch, ...p };
  schedulePatch();
}

/* ---------------- admin access ---------------- */

function getAdminCode(): string | null {
  return typeof window === "undefined" ? null : sessionStorage.getItem(ADMIN_KEY);
}

export function isAdminUnlocked() {
  return getAdminCode() === ADMIN_CODE;
}

export function unlockAdmin(code: string) {
  if (code === ADMIN_CODE) {
    if (typeof window !== "undefined") sessionStorage.setItem(ADMIN_KEY, code);
    return true;
  }
  return false;
}
