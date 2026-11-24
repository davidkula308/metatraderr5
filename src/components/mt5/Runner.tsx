import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { sendCommand, syncTerminal } from "@/lib/trading/terminal.functions";
import { captureBaseline } from "@/lib/app-update";
import { hydrate, setTransport, syncNow, type Snapshot } from "@/lib/trading/store";

/** Keeps this phone in step with the shared account: live prices, trades and admin settings. */
export function TerminalRunner() {
  const syncFn = useServerFn(syncTerminal);
  const sendFn = useServerFn(sendCommand);

  useEffect(() => {
    hydrate();
    captureBaseline();
    setTransport({
      sync: (d) => syncFn({ data: d }) as Promise<Snapshot>,
      send: (d) => sendFn({ data: d }) as Promise<Snapshot>,
    });
    let busy = false;
    const loop = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        await syncNow();
      } catch {
        /* keep last state, try again next round */
      } finally {
        busy = false;
      }
    };
    void loop();
    const id = setInterval(loop, 1000);
    const onVis = () => void loop();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [syncFn, sendFn]);

  return null;
}
