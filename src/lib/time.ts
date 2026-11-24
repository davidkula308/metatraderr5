/** Offset (ms) of `tz` from UTC at the given instant. */
export function tzOffsetMs(utcMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, number> = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  const asUTC = Date.UTC(
    parts["year"]!,
    parts["month"]! - 1,
    parts["day"]!,
    parts["hour"]! % 24,
    parts["minute"]!,
    parts["second"]!,
  );
  return asUTC - (utcMs - (utcMs % 1000));
}

/** Convert a wall-clock date/time in `tz` ("2026-11-24", "14:30") to a UTC timestamp. */
export function zonedToUtc(date: string, time: string, tz: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y!, m! - 1, d!, hh!, mm!);
  const off = tzOffsetMs(guess, tz);
  let res = guess - off;
  const off2 = tzOffsetMs(res, tz);
  if (off2 !== off) res = guess - off2;
  return res;
}

export function formatInZone(utcMs: number, tz: string, withSeconds = true): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hourCycle: "h23",
  }).format(new Date(utcMs));
}

export function dateInZone(utcMs: number, tz: string): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(new Date(utcMs));
}

export type TimeUnit = "seconds" | "minutes" | "hours";

export function unitMs(value: number, unit: TimeUnit): number {
  const v = Number.isFinite(value) ? Math.max(0, value) : 0;
  return v * (unit === "hours" ? 3_600_000 : unit === "minutes" ? 60_000 : 1000);
}

export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** MT5 style "2026.11.24 10:05:07" in local time. */
export function fmtDateTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export const POPULAR_ZONES: { label: string; tz: string }[] = [
  { label: "Kenya (Nairobi)", tz: "Africa/Nairobi" },
  { label: "UK (London)", tz: "Europe/London" },
  { label: "USA (New York)", tz: "America/New_York" },
  { label: "USA (Chicago)", tz: "America/Chicago" },
  { label: "USA (Los Angeles)", tz: "America/Los_Angeles" },
  { label: "UAE (Dubai)", tz: "Asia/Dubai" },
  { label: "Japan (Tokyo)", tz: "Asia/Tokyo" },
  { label: "Australia (Sydney)", tz: "Australia/Sydney" },
  { label: "UTC", tz: "UTC" },
];
