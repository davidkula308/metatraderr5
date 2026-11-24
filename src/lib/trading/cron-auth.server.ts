import { createHash, timingSafeEqual } from "node:crypto";

/** Vercel Cron uses CRON_SECRET; legacy Lovable secrets remain valid for POST callers. */
export function authenticateTickRequest(request: Request): Response | null {
  const secrets = [
    process.env["CRON_SECRET"],
    process.env["LOVABLE_CRON_SECRET"],
    process.env["LOVABLE_CRON_SECRET_PREVIOUS"],
  ].filter((value): value is string => Boolean(value));

  if (!secrets.length) return new Response("Server configuration error", { status: 500 });
  const match = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "");
  if (!match) return new Response("Unauthorized", { status: 401 });

  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  const provided = digest(match[1]);
  let authenticated = false;
  for (const secret of secrets) authenticated = timingSafeEqual(provided, digest(secret)) || authenticated;

  return authenticated ? null : new Response("Unauthorized", { status: 401 });
}
