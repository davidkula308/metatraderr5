import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Called on a schedule so the shared simulation keeps running while every phone is closed. */
export const Route = createFileRoute("/api/public/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { runCycle } = await import("@/lib/trading/terminal.server");
        const snap = await runCycle({ noLogs: true });
        return Response.json({ ok: true, status: snap.shared.engine.status, positions: snap.shared.positions.length });
      },
    },
  },
});
