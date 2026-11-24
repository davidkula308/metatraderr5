import type { Side } from "./calc";
import type { TimeUnit } from "@/lib/time";
import type { Timeframe } from "@/lib/market/symbols";

export interface Position {
  ticket: number;
  symbol: string;
  type: Side;
  volume: number;
  openPrice: number;
  openTime: number;
  sl: number;
  tp: number;
  swap: number;
  commission: number;
  sim?: boolean;
}

export interface ClosedPosition extends Position {
  closePrice: number;
  closeTime: number;
  profit: number;
}

export interface Deal {
  ticket: number;
  order: number;
  time: number;
  symbol: string | null;
  type: Side | "balance";
  entry: "in" | "out" | null;
  volume: number;
  price: number;
  profit: number;
  comment: string;
}

export interface OrderRec {
  ticket: number;
  time: number;
  doneTime: number;
  symbol: string;
  type: Side;
  volume: number;
  price: number;
}

export interface JournalEntry {
  time: number;
  source: string;
  message: string;
}

export interface RealQuote {
  bid: number;
  prevClose: number;
  high: number;
  low: number;
  time: number;
}

export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  prevClose: number;
  high: number;
  low: number;
  time: number;
  dir: 1 | -1 | 0;
}

export interface Duration {
  value: number;
  unit: TimeUnit;
}

export interface AdminConfig {
  symbol: string;
  trades: number;
  lot: number;
  direction: "random" | "buy" | "sell";
  closeOn: "profit" | "loss";
  targetType: "amount" | "percent";
  targetValue: number;
  maxFloating: number;
  firstPhase: Duration;
  mode: "once" | "auto";
  runFor: "duration" | "untilPaused";
  runDuration: Duration;
  startMode: "now" | "relative" | "clock";
  startRelative: Duration;
  startTz: string;
  startDate: string;
  startTime: string;
  batchDelay: Duration;
  useTpSl: boolean;
}

export interface Batch {
  id: number;
  symbol: string;
  side: Side;
  toOpen: number;
  tickets: number[];
  openedAt: number;
  firstEndsAt: number;
  phase: "opening" | "first" | "second";
  F: number; // favourable floating P/L (positive = towards the close target)
  target: number;
  depth: number;
}

export interface EngineState {
  status: "idle" | "scheduled" | "running" | "stopping" | "finished";
  startAt: number | null;
  endAt: number | null;
  nextBatchAt: number | null;
  batch: Batch | null;
  batchesDone: number;
  totalProfit: number;
  config: AdminConfig;
}

export interface Account {
  name: string;
  login: string;
  server: string;
  leverage: number;
  balance: number;
}

export interface UiSettings {
  advancedMode: boolean;
  oneClick: boolean;
  orderSounds: boolean;
  vibration: boolean;
  notifications: boolean;
}

export interface TerminalState {
  hydrated: boolean;
  real: Record<string, RealQuote>;
  display: Record<string, Quote>;
  offsets: Record<string, number>;
  account: Account;
  positions: Position[];
  history: ClosedPosition[];
  deals: Deal[];
  orders: OrderRec[];
  journal: JournalEntry[];
  quotesList: string[];
  chart: { symbol: string; tf: Timeframe; lot: number };
  settings: UiSettings;
  admin: AdminConfig;
  engine: EngineState;
  nextTicket: number;
}
