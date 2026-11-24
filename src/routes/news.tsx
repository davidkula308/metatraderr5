import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { NewsScreen } from "@/components/mt5/screens/Menu";

export const Route = createFileRoute("/news")({
  head: () => pageHead("News – MetaTrader 5", "Latest forex and gold market news."),
  component: NewsScreen,
});
