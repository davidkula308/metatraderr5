import { webcrypto } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { applyCommand, advanceTo, fromShared, toShared, withRealQuotes } from "@/lib/trading/commands";
import { initialState } from "@/lib/trading/ops";
import { applyRemoteConfig, remoteTick } from "@/lib/trading/remote";
import { publicRemote, remoteConfigSchema } from "@/lib/trading/remote-config";
import { handleRemoteRequest } from "@/lib/trading/remote-receiver.server";
import { summarize } from "@/lib/trading/calc";

vi.stubGlobal("crypto", webcrypto);
const key = "fixture-only-not-a-deployment-key";
const now = Date.UTC(2026, 10, 24, 13, 0);
const gold = () => withRealQuotes({ ...initialState(now), deals: [] }, [{ symbol: "XAUUSD", price: 3620, prevClose: 3620, high: 3630, low: 3610 }], now);
const request = (body: unknown, authorization?: string) => new Request("https://example.test/api/public/remote-config", {
  method: "POST", headers: { "Content-Type": "application/json", ...(authorization ? { Authorization: authorization } : {}) }, body: JSON.stringify(body),
});

describe("remote receiver security", () => {
  it("rejects missing and incorrect Authorization with 401 before saving", async () => {
    const save = vi.fn();
    for (const header of [undefined, "Bearer incorrect", `bearer ${key}`, key]) {
      expect((await handleRemoteRequest(request({ botRunning: true }, header), key, save)).status).toBe(401);
    }
    expect(save).not.toHaveBeenCalled();
  });
  it("rejects all requests when the shared key is not configured", async () => {
    expect((await handleRemoteRequest(request({}, `Bearer ${key}`), undefined, vi.fn())).status).toBe(401);
  });
  it("accepts the exact bearer header, ignores unknown fields and replies 200 ok true", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const response = await handleRemoteRequest(request({ tradesPerWave: 6, unknown: "ignored" }, `Bearer ${key}`), key, save);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(save).toHaveBeenCalledWith({ tradesPerWave: 6 });
  });
  it("validates settings without applying invalid requests", async () => {
    const save = vi.fn();
    const response = await handleRemoteRequest(request({ tradesPerWave: 101, lot: -1 }, `Bearer ${key}`), key, save);
    expect(response.status).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });
  it("allows an authenticated empty connection test without changing settings", async () => {
    const save = vi.fn();
    expect((await handleRemoteRequest(request({}, `Bearer ${key}`), key, save)).status).toBe(200);
    expect(save).not.toHaveBeenCalled();
  });
});

describe("remote trading rules", () => {
  it("botRunning true opens six XAUUSD trades at 0.01; false stops new trades", () => {
    let s = applyRemoteConfig(gold(), { botRunning: true, tradesPerWave: 6, lot: 0.01, symbol: "XAUUSD", holdSec: 10 }, now);
    s = remoteTick(s, now + 1000);
    expect(s.positions).toHaveLength(6);
    expect(s.positions.every((p) => p.symbol === "XAUUSD" && p.volume === 0.01)).toBe(true);
    s = applyRemoteConfig(s, { botRunning: false }, now + 2000);
    expect(remoteTick(s, now + 3000).engine.status).toBe("idle");
    expect(s.remote?.active).toBe(false);
  });
  it("win closes every mixed buy/sell trade in net profit after holdSec", () => {
    let s = applyRemoteConfig(gold(), { botRunning: true, tradesPerWave: 6, execMode: "both", outcome: "win", holdSec: 10, entryPips: 20, continuity: "single", swap: -0.03, commission: -0.02 }, now);
    s = remoteTick(s, now + 1000);
    expect(new Set(s.positions.map((p) => p.type)).size).toBe(2);
    s = remoteTick(s, now + 10_999);
    expect(s.positions).toHaveLength(6);
    s = remoteTick(s, now + 11_000);
    expect(s.history).toHaveLength(6);
    expect(s.history.every((p) => p.profit + p.swap + p.commission > 0)).toBe(true);
    expect(s.account.balance).toBeCloseTo(1001.2, 2);
    s = remoteTick(s, now + 30_000);
    expect(s.engine.status).toBe("finished");
    expect(s.positions).toHaveLength(0);
  });
  it("winlose closes four winners and one loser per five trades across waves", () => {
    let s = applyRemoteConfig(gold(), { botRunning: true, tradesPerWave: 2, outcome: "winlose", holdSec: 0, cooldownSec: 0, continuity: "continuous" }, now);
    for (let i = 1; i <= 6; i++) s = remoteTick(s, now + i * 1000);
    const firstFive = [...s.history].reverse().slice(0, 5);
    expect(firstFive).toHaveLength(5);
    expect(firstFive.filter((p) => p.profit > 0)).toHaveLength(4);
    expect(firstFive.filter((p) => p.profit < 0)).toHaveLength(1);
  });
  it("continuous waves respect cooldownSec", () => {
    let s = applyRemoteConfig(gold(), { botRunning: true, tradesPerWave: 1, holdSec: 0, cooldownSec: 10, continuity: "continuous" }, now);
    s = remoteTick(remoteTick(s, now + 1000), now + 2000);
    expect(remoteTick(s, now + 11_999).positions).toHaveLength(0);
    expect(remoteTick(s, now + 12_000).positions).toHaveLength(1);
  });
  it("an increasing closeAllNonce closes all positions in profit only once", () => {
    let s = applyCommand(gold(), { t: "open", symbol: "XAUUSD", side: "sell", volume: 0.01 }, now).state;
    s = applyRemoteConfig(s, { closeAllNonce: 1 }, now + 1);
    expect(s.positions).toHaveLength(0);
    expect(s.history[0]?.profit).toBeGreaterThan(0);
    s = applyCommand(s, { t: "open", symbol: "XAUUSD", side: "buy", volume: 0.01 }, now + 2).state;
    expect(applyRemoteConfig(s, { closeAllNonce: 1 }, now + 3).positions).toHaveLength(1);
    expect(applyRemoteConfig(s, { closeAllNonce: 2 }, now + 4).positions).toHaveLength(0);
  });
  it("schedules HH:MM in the selected simulator timezone", () => {
    const s = applyRemoteConfig({ ...gold(), admin: { ...gold().admin, startTz: "Africa/Nairobi" } }, { botRunning: true, startTime: "17:00" }, now);
    expect(s.engine.startAt).toBe(Date.UTC(2026, 10, 24, 14, 0));
    expect(remoteTick(s, now + 1000).positions).toHaveLength(0);
  });
  it("remote simulation continues during a one-minute server catch-up", () => {
    const s = applyRemoteConfig(gold(), { botRunning: true, tradesPerWave: 6, holdSec: 5, continuity: "single" }, now);
    const finished = advanceTo(s, now + 60_000);
    expect(finished.history).toHaveLength(6);
    expect(finished.positions).toHaveLength(0);
    expect(finished.account.balance).toBeGreaterThan(1000);
  });
});

describe("shared settings and accounting", () => {
  it("local edits win next, then a higher remote version wins without refresh", () => {
    let s = applyRemoteConfig(gold(), { lot: 0.01, tradesPerWave: 6, version: 1 }, now);
    s = applyCommand(s, { t: "admin", patch: { trades: 3, lot: 0.02 } }, now + 1).state;
    expect(fromShared(toShared(s), now + 2).admin.trades).toBe(3);
    expect(s.admin.lot).toBe(0.02);
    expect(applyRemoteConfig(s, { tradesPerWave: 6, version: 1 }, now + 3).admin.trades).toBe(3);
    expect(applyRemoteConfig(s, { tradesPerWave: 8, version: 2 }, now + 4).admin.trades).toBe(8);
  });
  it("saves balance, history deposit and charge without repeating adjustments", () => {
    const config = { balance: 1000, historyDeposit: 500, charge: 10, version: 1 };
    let s = applyRemoteConfig(gold(), config, now);
    expect(s.account.balance).toBe(990);
    expect(s.deals.find((d) => d.comment === "Remote history deposit")?.profit).toBe(500);
    const count = s.deals.length;
    s = applyRemoteConfig(s, { ...config, version: 2 }, now + 1);
    expect(s.account.balance).toBe(990);
    expect(s.deals).toHaveLength(count);
  });
  it("fees and marked prices are included in equity and free margin", () => {
    let s = applyRemoteConfig(gold(), { botRunning: true, tradesPerWave: 1, holdSec: 10, swap: -1, commission: -2 }, now);
    s = remoteTick(s, now + 1000);
    expect(summarize(s.account.balance, s.positions, s.display, s.account.leverage).equity).toBe(997);
  });
  it("saves remote identity and appearance but never exposes email or phone in snapshots", () => {
    const s = applyRemoteConfig(gold(), { accountName: "Remote account", company: "Chess Bot", login: "12345", server: "Demo", email: "test@example.test", phone: "123", simTheme: "dark", logoText: "HFC", logoBg: "#112233", logoFg: "#FFFFFF" }, now);
    expect(s.account).toMatchObject({ name: "Remote account", company: "Chess Bot", login: "12345", server: "Demo" });
    expect(s.remote?.config.email).toBe("test@example.test");
    expect(publicRemote(s.remote)?.config).not.toHaveProperty("email");
    expect(publicRemote(s.remote)?.config).not.toHaveProperty("phone");
  });
  it("validates clock time, colours and image schemes", () => {
    expect(remoteConfigSchema.safeParse({ startTime: "25:99" }).success).toBe(false);
    expect(remoteConfigSchema.safeParse({ logoBg: "red" }).success).toBe(false);
    expect(remoteConfigSchema.safeParse({ logoImage: "javascript:alert(1)" }).success).toBe(false);
    expect(remoteConfigSchema.safeParse({ logoImage: "data:image/svg+xml,<svg/>" }).success).toBe(false);
    expect(remoteConfigSchema.safeParse({ startTime: "", logoImage: "https://example.test/logo.png" }).success).toBe(true);
  });
});