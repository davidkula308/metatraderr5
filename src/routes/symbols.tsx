import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { SymbolsScreen } from "@/components/mt5/screens/Symbols";

export const Route = createFileRoute("/symbols")({
  head: () => pageHead("Add symbol – MetaTrader 5", "Add or remove symbols in Quotes."),
  component: SymbolsScreen,
});
