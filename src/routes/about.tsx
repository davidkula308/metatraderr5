import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { AboutScreen } from "@/components/mt5/screens/Menu";

export const Route = createFileRoute("/about")({
  head: () => pageHead("About – MetaTrader 5", "About MetaTrader 5 mobile."),
  component: AboutScreen,
});
