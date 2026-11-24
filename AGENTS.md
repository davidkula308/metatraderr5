<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- The account, positions, admin settings and simulation engine are shared across all devices: the server (`src/lib/trading/terminal.server.ts`) is the only place that advances and saves them; clients send commands and poll snapshots. Why: every phone must show the same account, and trading must continue while no phone is open (a per-minute scheduled call to `/api/public/tick` drives it).
- Per-device view preferences (quotes list, chart symbol/timeframe/lot, UI switches) stay in localStorage. Why: they are personal and must not overwrite other phones.
- The Android app is a thin WebView wrapper around the published site, built from `android/` by `android/build.sh` into `public/downloads/`. Why: the app updates itself whenever the site is republished; only a wrapper change needs a new APK.
