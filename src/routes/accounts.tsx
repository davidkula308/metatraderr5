import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { AccountsScreen } from "@/components/mt5/screens/Menu";

export const Route = createFileRoute("/accounts")({
  head: () => pageHead("Accounts – MetaTrader 5", "Manage your trading accounts."),
  component: AccountsScreen,
});
