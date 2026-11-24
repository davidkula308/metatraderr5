import { createContext, useContext, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CircleHelp,
  History,
  Info,
  Mail,
  Menu,
  MessagesSquare,
  Newspaper,
  Send,
  Settings,
  Users,
} from "lucide-react";
import { ChartsIcon, Mt5Logo, QuotesIcon, TradeIcon } from "./icons";
import { useTerminal } from "@/lib/trading/store";
import { summarize } from "@/lib/trading/calc";
import { cn } from "@/lib/utils";
import { useMailUnread } from "./mail";

const DrawerCtx = createContext<{ open: boolean; setOpen: (v: boolean) => void }>({
  open: false,
  setOpen: () => {},
});

export function useDrawer() {
  return useContext(DrawerCtx);
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <DrawerCtx.Provider value={{ open, setOpen }}>
      <div className="relative mx-auto flex h-dvh w-full max-w-[480px] flex-col overflow-hidden bg-background shadow-xl">
        {children}
        {open && <SideDrawer onClose={() => setOpen(false)} />}
      </div>
    </DrawerCtx.Provider>
  );
}

export function TopBar({
  title,
  subtitle,
  subtitleClass,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode | undefined;
  subtitleClass?: string | undefined;
  actions?: ReactNode | undefined;
  back?: boolean | undefined;
}) {
  const { setOpen } = useDrawer();
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 bg-background px-1">
      {back ? (
        <button
          aria-label="Back"
          onClick={() => window.history.back()}
          className="grid h-11 w-11 place-items-center rounded-full text-icon press"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
      ) : (
        <button
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="grid h-11 w-11 place-items-center rounded-full text-icon press"
        >
          <Menu className="h-6 w-6" />
        </button>
      )}
      <div className="min-w-0 flex-1 leading-tight">
        {subtitle !== undefined ? (
          <>
            <div className="truncate font-condensed text-[15px] text-foreground">{title}</div>
            <div className={cn("truncate font-condensed text-[19px] text-muted-foreground", subtitleClass)}>
              {subtitle}
            </div>
          </>
        ) : (
          <div className="truncate font-condensed text-[21px] text-foreground">{title}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1 pr-1 text-icon">{actions}</div>
    </header>
  );
}

export function IconBtn({
  label,
  onClick,
  children,
  active,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={cn("grid h-11 w-11 place-items-center rounded-full press", active && "text-primary")}
    >
      {children}
    </button>
  );
}

export function BottomNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const s = useTerminal();
  const sum = summarize(s.account.balance, s.positions, s.display, s.account.leverage);
  const hasPos = s.positions.length > 0;
  const tabs = [
    { to: "/", label: "Quotes", icon: QuotesIcon },
    { to: "/charts", label: "Charts", icon: ChartsIcon },
    { to: "/trade", label: "trade", icon: TradeIcon },
    { to: "/history", label: "History", icon: History },
    { to: "/messages", label: "Messages", icon: MessagesSquare },
  ] as const;
  return (
    <nav className="grid h-[68px] shrink-0 grid-cols-5 border-t border-border/60 bg-background">
      {tabs.map((t) => {
        const active = path === t.to;
        const Icon = t.icon;
        const isTrade = t.to === "/trade";
        return (
          <Link
            key={t.to}
            to={t.to}
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-[13px] font-medium tracking-wide",
              active ? "text-primary" : "text-foreground",
            )}
          >
            <Icon className={cn("h-6 w-6", !active && "text-icon")} />
            {isTrade ? (
              <span
                className={cn(
                  "font-num rounded-full px-3 py-0.5 text-[13px]",
                  !hasPos && "bg-pill text-icon",
                  hasPos && sum.profit < 0 && "bg-pill-loss text-down",
                  hasPos && sum.profit >= 0 && "bg-pill-profit text-up",
                )}
              >
                {hasPos ? sum.profit.toFixed(2) : s.account.balance.toFixed(2)}
              </span>
            ) : (
              <span>{t.label}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function SideDrawer({ onClose }: { onClose: () => void }) {
  const s = useTerminal();
  const unread = useMailUnread();
  const items = [
    { to: "/trade", label: "Trade", icon: TradeIcon },
    { to: "/news", label: "News", icon: Newspaper },
    { to: "/mailbox", label: "Mailbox", icon: Mail, badge: unread },
    { to: "/journal", label: "Journal", icon: BookOpen },
    { to: "/settings", label: "Settings", icon: Settings },
    { to: "/calendar", label: "Economic calendar", icon: CalendarDays, ads: true },
    { to: "/community", label: "Traders Community", icon: Users },
    { to: "/algo", label: "MQL5 Algo Trading", icon: Send },
    { to: "/guide", label: "User guide", icon: CircleHelp },
    { to: "/about", label: "About", icon: Info },
  ] as const;
  return (
    <div className="absolute inset-0 z-50">
      <button aria-label="Close menu" className="absolute inset-0 bg-overlay animate-fade" onClick={onClose} />
      <aside className="absolute inset-y-0 left-0 flex w-[75%] max-w-[340px] flex-col overflow-hidden bg-background animate-drawer">
        <div className="pointer-events-none absolute -right-9 top-4 w-36 rotate-45 bg-demo py-0.5 text-center font-condensed text-[13px] text-demo-foreground">
          Demo
        </div>
        <div className="flex gap-4 border-b border-border px-4 pb-4 pt-6">
          <Mt5Logo size={48} />
          <div className="min-w-0 pr-6">
            <div className="truncate text-[17px] text-foreground">{s.account.name}</div>
            <div className="truncate text-[15px] text-muted-foreground">
              {s.account.login} - {s.account.server}
            </div>
            <Link to="/accounts" onClick={onClose} className="mt-3 inline-block text-[16px] text-primary">
              Manage accounts
            </Link>
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto py-2 no-scrollbar">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <li key={it.to}>
                <Link
                  to={it.to}
                  onClick={onClose}
                  className="flex h-[54px] items-center gap-5 px-5 text-[16px] font-medium text-foreground press"
                >
                  <Icon className="h-6 w-6 shrink-0 text-icon" />
                  <span className="truncate">{it.label}</span>
                  {"ads" in it && (
                    <span className="rounded-full border border-primary px-2 text-[12px] text-primary">Ads</span>
                  )}
                  {"badge" in it && it.badge > 0 && (
                    <span className="ml-auto grid h-6 min-w-6 place-items-center rounded-full bg-badge px-1.5 text-[12px] text-background">
                      {it.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}

export function Page({ children, nav = true }: { children: ReactNode; nav?: boolean }) {
  return (
    <>
      {children}
      {nav && <BottomNav />}
    </>
  );
}

export function Scroll({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn("min-h-0 flex-1 overflow-y-auto no-scrollbar", className)}>{children}</main>;
}

/** Centered popup list, like MT5's long-press menus. */
export function PopupMenu({
  title,
  items,
  onClose,
}: {
  title?: ReactNode;
  items: { label: ReactNode; onClick: () => void; danger?: boolean }[];
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 grid place-items-center px-8">
      <button aria-label="Close" className="absolute inset-0 bg-overlay animate-fade" onClick={onClose} />
      <div className="relative w-full max-w-[320px] overflow-hidden rounded-2xl bg-popover py-2 shadow-2xl animate-pop">
        {title && <div className="px-5 pb-2 pt-2 font-condensed text-[18px] text-foreground">{title}</div>}
        {items.map((it, i) => (
          <button
            key={i}
            onClick={() => {
              it.onClick();
              onClose();
            }}
            className={cn("block w-full px-5 py-3.5 text-left text-[16px] press", it.danger && "text-down")}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Bottom sheet for details and forms. */
export function BottomSheet({
  title,
  children,
  onClose,
}: {
  title?: ReactNode;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <button aria-label="Close" className="absolute inset-0 bg-overlay animate-fade" onClick={onClose} />
      <div className="relative max-h-[85%] overflow-y-auto rounded-t-2xl bg-popover pb-6 shadow-2xl animate-sheet no-scrollbar">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
        {title && <div className="px-5 pb-1 pt-3 font-condensed text-[19px] text-foreground">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function Row({ label, value, valueClass }: { label: ReactNode; value: ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-end py-[5px]">
      <span className="shrink-0 font-condensed text-[17px] font-semibold text-foreground">{label}</span>
      <span className="dotted-leader" />
      <span className={cn("font-num shrink-0 text-[17px] font-semibold text-foreground", valueClass)}>{value}</span>
    </div>
  );
}

export function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <div className="text-border">{icon}</div>
      <div className="text-[16px]">{text}</div>
    </div>
  );
}
