import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { CommunityScreen } from "@/components/mt5/screens/Menu";

export const Route = createFileRoute("/community")({
  head: () => pageHead("Traders Community – MetaTrader 5", "Forums, signals and articles for traders."),
  component: CommunityScreen,
});
