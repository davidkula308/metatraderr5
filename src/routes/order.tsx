import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { pageHead } from "@/lib/head";
import { OrderScreen } from "@/components/mt5/screens/Order";

export const Route = createFileRoute("/order")({
  validateSearch: z.object({ symbol: z.string().optional() }),
  head: () => pageHead("New order – MetaTrader 5", "Open a market buy or sell order."),
  component: OrderPage,
});

function OrderPage() {
  const { symbol } = Route.useSearch();
  return <OrderScreen symbol={symbol ?? "XAUUSD"} />;
}
