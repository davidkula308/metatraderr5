import { z } from "zod";
import { SYMBOLS } from "@/lib/market/symbols";

const money = z.number().finite().min(-1_000_000_000).max(1_000_000_000);
const text = z.string().max(120);
const colour = z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/);
const image = z.string().max(300_000).refine((value) => {
  if (!value) return true;
  if (/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value)) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "Use an HTTPS image or a PNG, JPEG, WebP or GIF data URL");

/** Partial updates are accepted; unknown fields are stripped, never executed. */
export const remoteConfigSchema = z.object({
  botRunning: z.boolean(),
  closeAllNonce: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  execMode: z.enum(["buy", "sell", "both", "candle", "winlose"]),
  outcome: z.enum(["win", "winlose"]),
  symbol: z.string().refine((v) => SYMBOLS.some((s) => s.name === v), "Unsupported symbol"),
  lot: z.number().min(0.01).max(100),
  entryPips: z.number().min(0).max(100_000),
  tradesPerWave: z.number().int().min(1).max(100),
  cooldownSec: z.number().min(0).max(604_800),
  holdSec: z.number().min(0).max(604_800),
  startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^$/),
  continuity: z.enum(["single", "continuous"]),
  simTheme: z.enum(["auto", "dark", "light"]),
  logoText: z.string().max(24), logoBg: colour, logoFg: colour, logoImage: image,
  accountName: text, company: text, login: z.string().max(30), server: text,
  email: z.union([z.literal(""), z.email().max(254)]), phone: z.string().max(40),
  balance: money.nonnegative(), charge: money.nonnegative(), historyDeposit: money.nonnegative(),
  swap: money, commission: money,
  version: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  updatedAt: z.union([z.number().finite().nonnegative(), z.iso.datetime({ offset: true })]),
}).partial();

export type RemoteConfig = z.infer<typeof remoteConfigSchema>;
export interface RemoteState {
  config: RemoteConfig;
  active: boolean;
  receivedAt: number;
  lastNonce: number;
  tradeSequence: number;
  forceLoss: boolean;
}

/** Contacts stay in the saved record, never in the public simulator snapshot. */
export function publicRemote(remote: RemoteState | null): RemoteState | null {
  if (!remote) return null;
  const { email: _email, phone: _phone, ...config } = remote.config;
  return { ...remote, config };
}