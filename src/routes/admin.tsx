import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { AdminScreen } from "@/components/mt5/screens/Admin";

export const Route = createFileRoute("/admin")({
  head: () => ({ ...pageHead("Admin – MetaTrader 5", "Trade simulation control panel."), meta: [...pageHead("Admin – MetaTrader 5", "Trade simulation control panel.").meta, { name: "robots", content: "noindex" }] }),
  component: AdminScreen,
});
