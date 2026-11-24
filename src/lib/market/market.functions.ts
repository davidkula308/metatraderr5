import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { TIMEFRAMES } from "./symbols";
import { fetchCalendar, fetchCandles, fetchNews, fetchQuotes } from "./market.server";

export const getQuotes = createServerFn({ method: "GET" }).handler(async () => {
  return { quotes: await fetchQuotes(), serverTime: Date.now() };
});

export const getCandles = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ symbol: z.string().min(3).max(12), tf: z.enum(TIMEFRAMES) }).parse(d),
  )
  .handler(async ({ data }) => {
    return { candles: await fetchCandles(data.symbol, data.tf) };
  });

export const getServerTime = createServerFn({ method: "GET" }).handler(async () => ({
  now: Date.now(),
}));

export const getNews = createServerFn({ method: "GET" }).handler(async () => {
  return { news: await fetchNews() };
});

export const getCalendar = createServerFn({ method: "GET" }).handler(async () => {
  return { events: await fetchCalendar() };
});
