import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { TradeScreen } from "@/components/mt5/screens/Trade";

export const Route = createFileRoute("/trade")({
  head: () => pageHead("Trade – MetaTrader 5", "Account balance, equity, margin and open positions."),
  component: TradeScreen,
});
