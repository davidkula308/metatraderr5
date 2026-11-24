import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/remote-config")({
  server: { handlers: {
    OPTIONS: async () => {
      const { remoteCors } = await import("@/lib/trading/remote-receiver.server");
      return new Response(null, { status: 204, headers: remoteCors });
    },
    POST: async ({ request }) => {
      const { handleRemoteRequest } = await import("@/lib/trading/remote-receiver.server");
      return handleRemoteRequest(request, process.env["REMOTE_CONTROL_KEY"], async (remoteConfig) => {
        const { runCycle } = await import("@/lib/trading/terminal.server");
        await runCycle({ remoteConfig, noLogs: true });
      });
    },
  } },
});