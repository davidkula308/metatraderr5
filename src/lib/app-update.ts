/** Android app wrapper bridge (present only inside the installed app). */
interface AndroidBridge {
  versionCode: () => number;
  reload: () => void;
  clearCacheAndReload: () => void;
}

export const APK_URL = "/downloads/tradesim5.apk";

export function androidBridge(): AndroidBridge | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { AndroidApp?: AndroidBridge }).AndroidApp ?? null;
}

export function isAndroidApp(): boolean {
  return androidBridge() !== null;
}

/** Script and stylesheet files the page was built with; they change name whenever a new version is published. */
export function assetSignature(html: string): string {
  const re = /<(?:script|link)\b[^>]*?(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g;
  const out: string[] = [];
  for (const m of html.matchAll(re)) if (m[1]) out.push(m[1]);
  return [...new Set(out)].sort().join("|");
}

let baseline: Promise<{ path: string; sig: string } | null> | null = null;

async function pageSignature(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${path}${path.includes("?") ? "&" : "?"}update=${Date.now()}`, { cache: "no-store" });
    return res.ok ? assetSignature(await res.text()) : null;
  } catch {
    return null;
  }
}

/** Remember which version this page is running (call once when the app starts). */
export function captureBaseline() {
  if (baseline || typeof window === "undefined") return;
  const path = window.location.pathname;
  baseline = pageSignature(path).then((sig) => (sig ? { path, sig } : null));
}

export type UpdateResult =
  | { kind: "updating" }
  | { kind: "latest" }
  | { kind: "newApk"; url: string }
  | { kind: "offline" };

/**
 * Check the site for a newer version. When one exists the app clears its saved files and
 * reloads; when the Android wrapper itself is outdated, the caller offers the new APK.
 */
export async function fetchLatestUpdate(): Promise<UpdateResult> {
  captureBaseline();
  const base = await baseline;
  const fresh = await pageSignature(base?.path ?? "/");
  if (fresh === null) return { kind: "offline" };

  const bridge = androidBridge();
  if (bridge) {
    try {
      const info = (await (await fetch(`/downloads/app.json?t=${Date.now()}`, { cache: "no-store" })).json()) as {
        versionCode: number;
        url: string;
      };
      if (info.versionCode > bridge.versionCode()) return { kind: "newApk", url: info.url };
    } catch {
      /* no app info: just refresh the site */
    }
  }

  if (!base) {
    // Could not tell which version is running: refresh to be safe.
    await applyUpdate();
    return { kind: "updating" };
  }
  if (fresh === base.sig) return { kind: "latest" };
  await applyUpdate();
  return { kind: "updating" };
}

export async function applyUpdate() {
  try {
    if ("caches" in window) for (const k of await caches.keys()) await caches.delete(k);
  } catch {
    /* nothing cached */
  }
  const bridge = androidBridge();
  setTimeout(() => {
    if (bridge) bridge.clearCacheAndReload();
    else window.location.reload();
  }, 600);
}
