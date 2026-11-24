import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { CalendarScreen } from "@/components/mt5/screens/Menu";

export const Route = createFileRoute("/calendar")({
  head: () => pageHead("Economic calendar – MetaTrader 5", "This week's economic events and their impact."),
  component: CalendarScreen,
});
