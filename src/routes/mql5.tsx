import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { pageHead } from "@/lib/head";
import { Mql5Screen } from "@/components/mt5/screens/Menu";

export const Route = createFileRoute("/mql5")({
  validateSearch: z.object({ mode: z.enum(["register", "signin"]).optional() }),
  head: () => pageHead("MQL5.community – MetaTrader 5", "Register or sign in to MQL5.community."),
  component: Mql5Page,
});

function Mql5Page() {
  const { mode } = Route.useSearch();
  return <Mql5Screen mode={mode ?? "signin"} />;
}
