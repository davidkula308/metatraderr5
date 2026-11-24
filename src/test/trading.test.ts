import { describe, expect, it } from "vitest";
import { getSpec } from "@/lib/market/symbols";
import { fmtMoney, marginFor, summarize } from "@/lib/trading/calc";
import { batchTarget, engineTick, startEngine } from "@/lib/trading/engine";
import { computeDisplay, DEFAULT_ADMIN, initialState } from "@/lib/trading/ops";
import { unlockAdmin } from "@/lib/trading/store";
import { zonedToUtc } from "@/lib/time";
import type { TerminalState } from "@/lib/trading/types";

function withGold(price = 3620): TerminalState {
  const s = initialState(0);
  const ns = { ...s, hydrated: true, real: { XAUUSD: { bid: price, prevClose: price, high: price, low: price, time: 0 } } };
  return { ...ns, display: computeDisplay(ns) };
}

describe("account math", () => {
  it("6 x 0.01 XAUUSD at 1:2000 needs about 10.86 margin", () => {
    const m = marginFor(getSpec("XAUUSD"), 0.06, 3620, 2000, {});
    expect(m).toBeCloseTo(10.86, 2);
  });

  it("with no trades, equity and free margin equal the balance", () => {
    const sum = summarize(1000, [], {}, 2000);
    expect(sum.equity).toBe(1000);
    expect(sum.freeMargin).toBe(1000);
    expect(sum.marginLevel).toBeNull();
  });

  it("formats money with spaces like MT5", () => {
    expect(fmtMoney(1000)).toBe("1 000.00");
  });
});

describe("admin access", () => {
  it("opens only with code 4030", () => {
    expect(unlockAdmin("1234")).toBe(false);
    expect(unlockAdmin("4030")).toBe(true);
  });
});

describe("close target", () => {
  it("uses a fixed dollar amount", () => {
    expect(batchTarget({ ...DEFAULT_ADMIN, targetType: "amount", targetValue: 2 }, 1000)).toBe(2);
  });
  it("uses a percentage of the account", () => {
    expect(batchTarget({ ...DEFAULT_ADMIN, targetType: "percent", targetValue: 1 }, 1000)).toBe(10);
  });
});

describe("simulation", () => {
  it("opens the set number of trades, then closes them all in profit and grows the balance", () => {
    let s = withGold();
    s = { ...s, admin: { ...DEFAULT_ADMIN, trades: 6, lot: 0.01, mode: "once", targetValue: 2, firstPhase: { value: 5, unit: "seconds" } } };
    let t = 1_000_000;
    s = startEngine(s, t);
    let maxOpen = 0;
    for (let i = 0; i < 4000 && s.engine.status !== "finished"; i++) {
      t += 500;
      s = engineTick(s, t);
      maxOpen = Math.max(maxOpen, s.positions.length);
    }
    expect(maxOpen).toBe(6);
    expect(s.engine.status).toBe("finished");
    expect(s.positions.length).toBe(0);
    expect(s.history.length).toBe(6);
    expect(s.account.balance - 1000).toBeGreaterThanOrEqual(2);
    const total = s.history.reduce((a, h) => a + h.profit, 0);
    expect(Math.round(total * 100) / 100).toBeCloseTo(s.account.balance - 1000, 2);
  });

  it("waits until the scheduled start time", () => {
    let s = withGold();
    s = { ...s, admin: { ...DEFAULT_ADMIN, startMode: "relative", startRelative: { value: 30, unit: "seconds" } } };
    s = startEngine(s, 0);
    s = engineTick(s, 10_000);
    expect(s.engine.status).toBe("scheduled");
    s = engineTick(s, 31_000);
    expect(s.engine.status).toBe("running");
  });
});

describe("time zones", () => {
  it("14:00 in London on 24 Nov 2026 is 14:00 UTC", () => {
    expect(zonedToUtc("2026-11-24", "14:00", "Europe/London")).toBe(Date.UTC(2026, 10, 24, 14, 0));
  });
  it("14:00 in Nairobi is 11:00 UTC", () => {
    expect(zonedToUtc("2026-11-24", "14:00", "Africa/Nairobi")).toBe(Date.UTC(2026, 10, 24, 11, 0));
  });
  it("09:00 in New York is 14:00 UTC in November", () => {
    expect(zonedToUtc("2026-11-24", "09:00", "America/New_York")).toBe(Date.UTC(2026, 10, 24, 14, 0));
  });
});
