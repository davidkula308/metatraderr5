import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { MessagesScreen } from "@/components/mt5/screens/Menu";

export const Route = createFileRoute("/messages")({
  head: () => pageHead("Messages – MetaTrader 5", "Messages and MQL5.community chats."),
  component: MessagesScreen,
});
