import { createFileRoute } from "@tanstack/react-router";
import { authenticateTickRequest } from "@/lib/trading/cron-auth.server";

/** Called on a schedule so the shared simulation keeps running while every phone is closed. */
export const Route = createFileRoute("/api/public/tick")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authFailure = authenticateTickRequest(request);
        if (authFailure) return authFailure;
        const { runCycle } = await import("@/lib/trading/terminal.server");
        const snap = await runCycle({ noLogs: true });
        return Response.json({ ok: true, status: snap.shared.engine.status, positions: snap.shared.positions.length });
      },
      POST: async ({ request }) => {
        const authFailure = authenticateTickRequest(request);
        if (authFailure) return authFailure;
        const { runCycle } = await import("@/lib/trading/terminal.server");
        const snap = await runCycle({ noLogs: true });
        return Response.json({ ok: true, status: snap.shared.engine.status, positions: snap.shared.positions.length });
      },
    },
  },
});
