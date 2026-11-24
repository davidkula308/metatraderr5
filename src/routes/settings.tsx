import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { SettingsScreen } from "@/components/mt5/screens/Menu";

export const Route = createFileRoute("/settings")({
  head: () => pageHead("Settings – MetaTrader 5", "Terminal settings and preferences."),
  component: SettingsScreen,
});
