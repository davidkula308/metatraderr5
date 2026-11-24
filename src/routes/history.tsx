import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { HistoryScreen } from "@/components/mt5/screens/History";

export const Route = createFileRoute("/history")({
  head: () => pageHead("History – MetaTrader 5", "Closed positions, orders, deals and balance operations."),
  component: HistoryScreen,
});
