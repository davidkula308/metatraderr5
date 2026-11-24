import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { ChartsScreen } from "@/components/mt5/screens/Charts";

export const Route = createFileRoute("/charts")({
  head: () => pageHead("Charts – MetaTrader 5", "Live candlestick charts with one-click trading."),
  component: ChartsScreen,
});
