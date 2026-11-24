import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { QuotesScreen } from "@/components/mt5/screens/Quotes";

export const Route = createFileRoute("/")({
  head: () => pageHead("Quotes – MetaTrader 5", "Live bid and ask prices for gold, forex pairs and crypto."),
  component: QuotesScreen,
});
