import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { GuideScreen } from "@/components/mt5/screens/Menu";

export const Route = createFileRoute("/guide")({
  head: () => pageHead("User guide – MetaTrader 5", "How to use the mobile trading terminal."),
  component: GuideScreen,
});
