import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { MailboxScreen } from "@/components/mt5/screens/Menu";

export const Route = createFileRoute("/mailbox")({
  head: () => pageHead("Mailbox – MetaTrader 5", "Messages from your broker and MetaQuotes."),
  component: MailboxScreen,
});
