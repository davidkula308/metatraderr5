import { useSyncExternalStore } from "react";

export interface MailItem {
  id: number;
  from: string;
  subject: string;
  date: string;
  body: string;
}

export const MAILS: MailItem[] = [
  {
    id: 1,
    from: "MetaQuotes Ltd.",
    subject: "Welcome to MetaTrader 5!",
    date: "today",
    body: "Thank you for choosing MetaTrader 5. The platform gives you real-time quotes, interactive charts, 30 technical indicators, full trading history and the complete set of trade orders.",
  },
  {
    id: 2,
    from: "MetaQuotes Ltd.",
    subject: "Trade from anywhere with MetaTrader 5 mobile",
    date: "today",
    body: "Control your account from your phone: open and close positions, set Stop Loss and Take Profit, and watch your floating profit in real time.",
  },
  {
    id: 3,
    from: "MetaQuotes Ltd.",
    subject: "Built-in Economic Calendar",
    date: "today",
    body: "Follow upcoming macroeconomic events and their impact on currencies directly in the platform.",
  },
  {
    id: 4,
    from: "MetaQuotes Ltd.",
    subject: "Trading signals and copy trading",
    date: "today",
    body: "Subscribe to signals of successful traders and copy their deals to your account automatically.",
  },
  {
    id: 5,
    from: "MetaQuotes Ltd.",
    subject: "Secure your account with OTP",
    date: "today",
    body: "Enable one-time passwords in Settings to add an extra layer of protection to your trading account.",
  },
  {
    id: 6,
    from: "MetaQuotes Ltd.",
    subject: "Chats and channels",
    date: "today",
    body: "Register an MQL5.community account to chat with other traders and join channels with trading ideas.",
  },
  {
    id: 7,
    from: "MetaQuotes Ltd.",
    subject: "MQL5 Algo Trading",
    date: "today",
    body: "Thousands of trading robots and indicators are available in the MQL5 Market. Rent or buy them in a couple of clicks.",
  },
  {
    id: 8,
    from: "Headway",
    subject: "Your demo account is ready",
    date: "today",
    body: "Your demo account has been opened with a virtual balance. Practise trading with no risk to your own funds.",
  },
];

const KEY = "mt5sim:mailRead";
const subs = new Set<() => void>();
let cache: number[] | null = null;

function read(): number[] {
  if (typeof window === "undefined") return [];
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "[]") as number[];
  } catch {
    cache = [];
  }
  return cache;
}

export function markRead(id: number) {
  const cur = read();
  if (cur.includes(id)) return;
  cache = [...cur, id];
  localStorage.setItem(KEY, JSON.stringify(cache));
  subs.forEach((f) => f());
}

const EMPTY: number[] = [];

export function useMailRead(): number[] {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    read,
    () => EMPTY,
  );
}

export function useMailUnread(): number {
  const r = useMailRead();
  return MAILS.filter((m) => !r.includes(m.id)).length;
}
