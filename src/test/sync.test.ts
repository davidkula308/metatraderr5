import { describe, expect, it } from "vitest";
import { advanceTo, applyCommand, collectLogs, fromShared, mergeLogs, toShared, withRealQuotes, type LogEntry } from "@/lib/trading/commands";
import { startEngine } from "@/lib/trading/engine";
import { DEFAULT_ADMIN, initialState } from "@/lib/trading/ops";

const gold = [{ symbol: "XAUUSD", price: 3620, prevClose: 3620, high: 3630, low: 3610 }];

describe("shared account", () => {
  it("keeps trading while every phone is closed: one-minute catch-ups finish a batch in profit", () => {
    let s = withRealQuotes({ ...initialState(0), hydrated: true, lastTick: 1_000_000 }, gold, 1_000_000);
    s = { ...s, admin: { ...DEFAULT_ADMIN, trades: 6, mode: "once", targetValue: 2, firstPhase: { value: 30, unit: "seconds" } } };
    s = startEngine(s, 1_000_000);
    let t = 1_000_000;
    for (let i = 0; i < 30 && s.engine.status !== "finished"; i++) {
      t += 60_000;
      s = advanceTo(withRealQuotes(s, gold, t), t);
    }
    expect(s.engine.status).toBe("finished");
    expect(s.positions.length).toBe(0);
    expect(s.history.length).toBe(6);
    expect(s.account.balance - 1000).toBeGreaterThanOrEqual(2);
  });

  it("a reset sets the new balance and starts a fresh history", () => {
    const s = { ...initialState(0), hydrated: true };
    const r = applyCommand(s, { t: "reset", value: 5000 }, 10).state;
    expect(r.account.balance).toBe(5000);
    expect(r.epoch).toBe(s.epoch + 1);
    expect(r.deals[0]?.profit).toBe(5000);
  });

  it("history saved on the server shows up once, newest first, on every phone", () => {
    let s = withRealQuotes(fromShared(toShared({ ...initialState(0), hydrated: true }), 0), gold, 0);
    s = applyCommand(s, { t: "open", symbol: "XAUUSD", side: "buy", volume: 0.01 }, 1).state;
    const rows: LogEntry[] = collectLogs(s).map((r, i) => ({ ...r, id: i + 1 }));
    const lists = mergeLogs({ deals: [], orders: [], history: [], journal: [] }, rows);
    expect(lists.deals.length).toBe(1);
    expect(lists.orders.length).toBe(1);
    const again = mergeLogs(lists, []);
    expect(again.deals.length).toBe(1);
  });
});

describe("live refresh", () => {
  it("a refresh with no new history still returns only the history lists (so new prices are not overwritten)", () => {
    const s = { ...initialState(0), hydrated: true };
    const merged = mergeLogs(s, []);
    expect(Object.keys(merged).sort()).toEqual(["deals", "history", "journal", "orders"]);
  });
});
