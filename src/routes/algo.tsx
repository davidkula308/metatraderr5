import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { AlgoScreen } from "@/components/mt5/screens/Menu";

export const Route = createFileRoute("/algo")({
  head: () => pageHead("MQL5 Algo Trading – MetaTrader 5", "Trading robots and indicators."),
  component: AlgoScreen,
});
