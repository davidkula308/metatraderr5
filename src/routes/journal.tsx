import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { JournalScreen } from "@/components/mt5/screens/Menu";

export const Route = createFileRoute("/journal")({
  head: () => pageHead("Journal – MetaTrader 5", "Log of trade operations on this account."),
  component: JournalScreen,
});
