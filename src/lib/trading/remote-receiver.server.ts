import { timingSafeEqual } from "node:crypto";
import { remoteConfigSchema, type RemoteConfig } from "./remote-config";

export const remoteCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Cache-Control": "no-store",
};

/** Hash before comparison so even malformed header lengths take the same comparison path. */
export async function handleRemoteRequest(request: Request, key: string | undefined, save: (config: RemoteConfig) => Promise<unknown>): Promise<Response> {
  const header = request.headers.get("Authorization");
  if (!key || !header) return Response.json({ ok: false }, { status: 401, headers: remoteCors });
  const encoder = new TextEncoder();
  const [actual, expected] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(header)),
    crypto.subtle.digest("SHA-256", encoder.encode(`Bearer ${key}`)),
  ]);
  if (!timingSafeEqual(new Uint8Array(actual), new Uint8Array(expected))) return Response.json({ ok: false }, { status: 401, headers: remoteCors });
  // Bound data URLs and all payloads before parsing or touching saved state.
  if (Number(request.headers.get("Content-Length")) > 350_000) return Response.json({ ok: false }, { status: 413, headers: remoteCors });
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > 350_000) return Response.json({ ok: false }, { status: 413, headers: remoteCors });
  let data: unknown;
  try { data = JSON.parse(body); } catch { return Response.json({ ok: false }, { status: 400, headers: remoteCors }); }
  const parsed = remoteConfigSchema.safeParse(data);
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid settings", fields: parsed.error.issues.map((issue) => issue.path.join(".")) }, { status: 400, headers: remoteCors });
  try {
    if (Object.keys(parsed.data).length) await save(parsed.data);
    return Response.json({ ok: true }, { headers: remoteCors });
  } catch {
    return Response.json({ ok: false, error: "Could not save settings; retry" }, { status: 503, headers: remoteCors });
  }
}