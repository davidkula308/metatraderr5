import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Command } from "./commands";

const ADMIN_CODE = "4030";

const duration = z.object({ value: z.number().min(0).max(100000), unit: z.enum(["seconds", "minutes", "hours"]) });

const adminPatch = z
  .object({
    symbol: z.string().min(3).max(12),
    trades: z.number().int().min(1).max(100),
    lot: z.number().min(0.01).max(100),
    direction: z.enum(["random", "buy", "sell"]),
    closeOn: z.enum(["profit", "loss"]),
    targetType: z.enum(["amount", "percent"]),
    targetValue: z.number().min(0).max(1_000_000),
    maxFloating: z.number().min(0).max(1_000_000),
    firstPhase: duration,
    mode: z.enum(["once", "auto"]),
    runFor: z.enum(["duration", "untilPaused"]),
    runDuration: duration,
    startMode: z.enum(["now", "relative", "clock"]),
    startRelative: duration,
    startTz: z.string().max(64),
    startDate: z.string().max(20),
    startTime: z.string().max(10),
    batchDelay: duration,
    useTpSl: z.boolean(),
  })
  .partial();

const command = z.discriminatedUnion("t", [
  z.object({ t: z.literal("open"), symbol: z.string().min(3).max(12), side: z.enum(["buy", "sell"]), volume: z.number().min(0.01).max(100) }),
  z.object({ t: z.literal("close"), tickets: z.array(z.number().int()).max(500) }),
  z.object({ t: z.literal("admin"), patch: adminPatch }),
  z.object({
    t: z.literal("account"),
    patch: z
      .object({ name: z.string().max(80), login: z.string().max(30), server: z.string().max(80), leverage: z.number().int().min(1).max(5000) })
      .partial(),
  }),
  z.object({ t: z.literal("start") }),
  z.object({ t: z.literal("pause") }),
  z.object({ t: z.literal("resume") }),
  z.object({ t: z.literal("stop") }),
  z.object({ t: z.literal("setBalance"), value: z.number().min(0).max(1_000_000_000) }),
  z.object({ t: z.literal("reset"), value: z.number().positive().max(1_000_000_000) }),
]);

const syncInput = z.object({ since: z.number().int().min(0), epoch: z.number().int().min(0) });

/** Refresh prices, advance the shared simulation and return the latest account. */
export const syncTerminal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => syncInput.parse(d))
  .handler(async ({ data }) => {
    const { runCycle } = await import("./terminal.server");
    return runCycle({ since: data.since, epoch: data.epoch });
  });

/** Run one trade or admin action on the shared account. */
export const sendCommand = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => syncInput.extend({ cmd: command, code: z.string().max(20).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { needsAdmin } = await import("./commands");
    const cmd = data.cmd as Command;
    if (needsAdmin(cmd) && data.code !== ADMIN_CODE) throw new Error("Admin code required");
    const { runCycle } = await import("./terminal.server");
    return runCycle({ cmd, since: data.since, epoch: data.epoch });
  });
