import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Download, ExternalLink, Loader2, MessageCircle, Plus, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { getCalendar, getNews } from "@/lib/market/market.functions";
import { fmtMoney } from "@/lib/trading/calc";
import { APK_URL, applyUpdate, fetchLatestUpdate, isAndroidApp } from "@/lib/app-update";
import { useHydrated } from "@/hooks/use-hydrated";
import { setState, unlockAdmin, useTerminal } from "@/lib/trading/store";
import type { UiSettings } from "@/lib/trading/types";
import { fmtDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { MAILS, markRead, useMailRead } from "../mail";
import { Mt5Logo } from "../icons";
import { BottomSheet, EmptyState, IconBtn, Page, Scroll, TopBar } from "../Shell";

export function MessagesScreen() {
  return (
    <Page>
      <TopBar
        title="Messages"
        actions={
          <>
            <span className="rounded bg-icon px-1 font-condensed text-[12px] font-bold text-background">MQID</span>
            <IconBtn label="Search" onClick={() => toast("No messages to search")}>
              <Search className="h-6 w-6" strokeWidth={1.8} />
            </IconBtn>
          </>
        }
      />
      <Scroll>
        <EmptyState icon={<MessageCircle className="h-32 w-32 fill-muted text-muted" />} text="No messages" />
      </Scroll>
      <div className="flex shrink-0 gap-4 px-3 pb-3">
        <Link
          to="/mql5"
          search={{ mode: "register" }}
          className="grid h-14 flex-1 place-items-center rounded-full bg-primary text-[17px] font-semibold text-primary-foreground"
        >
          REGISTER
        </Link>
        <Link
          to="/mql5"
          search={{ mode: "signin" }}
          className="grid h-14 w-36 place-items-center rounded-full bg-secondary text-[17px] font-semibold text-primary shadow"
        >
          SIGN IN
        </Link>
      </div>
    </Page>
  );
}

export function Mql5Screen({ mode }: { mode: "register" | "signin" }) {
  const [login, setLogin] = useState("");
  const [pwd, setPwd] = useState("");
  return (
    <Page nav={false}>
      <TopBar back title={mode === "register" ? "Register" : "Sign in"} />
      <Scroll className="px-5 py-4">
        <div className="mb-6 text-[15px] text-muted-foreground">
          {mode === "register"
            ? "Create an MQL5.community account to chat with traders and receive messages."
            : "Sign in with your MQL5.community account."}
        </div>
        <label className="mb-4 block text-[14px] text-muted-foreground">
          {mode === "register" ? "Email" : "Login"}
          <input value={login} onChange={(e) => setLogin(e.target.value)} className="mt-1 block h-12 w-full border-b border-input bg-transparent text-[17px] text-foreground outline-none focus:border-primary" />
        </label>
        <label className="mb-8 block text-[14px] text-muted-foreground">
          Password
          <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} className="mt-1 block h-12 w-full border-b border-input bg-transparent text-[17px] text-foreground outline-none focus:border-primary" />
        </label>
        <button
          onClick={() => toast.error("MQL5.community messaging isn't available in this app")}
          className="h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground"
        >
          {mode === "register" ? "REGISTER" : "SIGN IN"}
        </button>
      </Scroll>
    </Page>
  );
}

function ago(ms: number) {
  const m = Math.max(1, Math.round((Date.now() - ms) / 60000));
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return fmtDateTime(ms).slice(0, 10);
}

export function NewsScreen() {
  const fetchNews = useServerFn(getNews);
  const q = useQuery({ queryKey: ["news"], queryFn: () => fetchNews(), refetchInterval: 300_000 });
  return (
    <Page nav={false}>
      <TopBar back title="News" />
      <Scroll>
        {q.isLoading && <div className="p-8 text-center text-muted-foreground">Loading news…</div>}
        {q.data?.news.length === 0 && <div className="p-8 text-center text-muted-foreground">No news right now</div>}
        {q.data?.news.map((n) => (
          <a key={n.id} href={n.link} target="_blank" rel="noreferrer" className="block border-b border-border px-4 py-3 press">
            <div className="text-[16px] font-medium leading-snug text-foreground">{n.title}</div>
            <div className="mt-1 flex justify-between text-[13px] text-muted-foreground">
              <span>{n.publisher}</span>
              <span>{ago(n.time)}</span>
            </div>
          </a>
        ))}
      </Scroll>
    </Page>
  );
}

export function MailboxScreen() {
  const read = useMailRead();
  const [open, setOpen] = useState<number | null>(null);
  const mail = MAILS.find((m) => m.id === open);
  return (
    <Page nav={false}>
      <TopBar back title="Mailbox" />
      <Scroll>
        {MAILS.map((m) => {
          const unread = !read.includes(m.id);
          return (
            <button
              key={m.id}
              onClick={() => {
                setOpen(m.id);
                markRead(m.id);
              }}
              className="flex w-full gap-3 border-b border-border px-4 py-3 text-left press"
            >
              <span className={cn("mt-2 h-2.5 w-2.5 shrink-0 rounded-full", unread ? "bg-primary" : "bg-transparent")} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between text-[14px] text-muted-foreground">
                  <span>{m.from}</span>
                  <span>{m.date}</span>
                </div>
                <div className={cn("truncate text-[16px] text-foreground", unread && "font-semibold")}>{m.subject}</div>
              </div>
            </button>
          );
        })}
      </Scroll>
      {mail && (
        <BottomSheet title={mail.subject} onClose={() => setOpen(null)}>
          <div className="px-5 pb-2 text-[13px] text-muted-foreground">{mail.from}</div>
          <div className="px-5 text-[15px] leading-relaxed text-foreground">{mail.body}</div>
        </BottomSheet>
      )}
    </Page>
  );
}

export function JournalScreen() {
  const s = useTerminal();
  return (
    <Page nav={false}>
      <TopBar back title="Journal" />
      <Scroll>
        {s.journal.length === 0 && <div className="p-8 text-center text-muted-foreground">Journal is empty</div>}
        {s.journal.map((j, i) => (
          <div key={i} className="border-b border-border px-4 py-2">
            <div className="font-num flex gap-3 text-[13px] text-muted-foreground">
              <span>{fmtDateTime(j.time).slice(11)}</span>
              <span>{j.source}</span>
            </div>
            <div className="font-num text-[15px] text-foreground">{j.message}</div>
          </div>
        ))}
      </Scroll>
    </Page>
  );
}

function SettingRow({ title, sub, right, onClick }: { title: string; sub?: string; right?: ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cn("flex min-h-[62px] items-center gap-3 border-b border-border px-4 py-2", onClick && "press cursor-pointer")}>
      <div className="min-w-0 flex-1">
        <div className="text-[16px] text-foreground">{title}</div>
        {sub && <div className="text-[13px] text-muted-foreground">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="bg-section px-4 pb-1 pt-4 text-[13px] font-medium uppercase tracking-wide text-primary">{children}</div>;
}

export function SettingsScreen() {
  const s = useTerminal();
  const navigate = useNavigate();
  const [pin, setPin] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const [checking, setChecking] = useState(false);
  const hydrated = useHydrated();
  const inApp = hydrated && isAndroidApp();
  const checkUpdates = async () => {
    if (checking) return;
    setChecking(true);
    const r = await fetchLatestUpdate();
    setChecking(false);
    if (r.kind === "updating") toast("New version found — updating…");
    else if (r.kind === "latest") toast("You have the latest version");
    else if (r.kind === "offline") toast("No connection. Try again later");
    else
      toast("A new version of the app is available", {
        action: { label: "Download", onClick: () => window.open(r.url, "_blank") },
        cancel: { label: "Refresh", onClick: () => void applyUpdate() },
      });
  };
  const toggle = (k: keyof UiSettings) => (v: boolean) => setState((st) => ({ ...st, settings: { ...st.settings, [k]: v } }));
  const sw = (k: keyof UiSettings) => <Switch checked={s.settings[k]} onCheckedChange={toggle(k)} />;
  return (
    <Page nav={false}>
      <TopBar back title="Settings" />
      <Scroll>
        <SectionTitle>Account</SectionTitle>
        <SettingRow title={s.account.name} sub={`${s.account.login} - ${s.account.server}`} right={<ChevronRight className="h-5 w-5 text-muted-foreground" />} onClick={() => navigate({ to: "/accounts" })} />
        <SettingRow title="OTP" sub="One-time password generator" right={<ShieldCheck className="h-5 w-5 text-muted-foreground" />} onClick={() => toast("OTP is not set up for this demo account")} />
        <SectionTitle>Trade</SectionTitle>
        <SettingRow title="Advanced mode" sub="Show high/low prices and spread in Quotes" right={sw("advancedMode")} />
        <SettingRow title="One click trading" sub="Trade from the chart without confirmation" right={sw("oneClick")} />
        <SectionTitle>Notifications</SectionTitle>
        <SettingRow title="Order sounds" right={sw("orderSounds")} />
        <SettingRow title="Vibration" right={sw("vibration")} />
        <SettingRow title="Push notifications" right={sw("notifications")} />
        <SectionTitle>Interface</SectionTitle>
        <SettingRow title="Language" sub="English" />
        <SettingRow title="Chart" sub="Candles, grid, bid and ask lines" />
        <SectionTitle>Service</SectionTitle>
        <SettingRow
          title="Admin"
          sub="Trade simulation panel"
          right={<ChevronRight className="h-5 w-5 text-muted-foreground" />}
          onClick={() => {
            setErr(false);
            setPin("");
          }}
        />
        {!inApp && (
          <a href={APK_URL} download="TradeSim5.apk" className="block">
            <SettingRow
              title="Install app"
              sub="Download the Android app (APK)"
              right={<Download className="h-5 w-5 text-primary" />}
              onClick={() => toast("Downloading the app… open the file to install it")}
            />
          </a>
        )}
        <SettingRow
          title="Fetch latest updates"
          sub={checking ? "Checking for updates…" : "Get the newest version of the app"}
          right={checking ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <RefreshCw className="h-5 w-5 text-primary" />}
          onClick={() => void checkUpdates()}
        />
        <SettingRow title="About" sub="MetaTrader 5" onClick={() => navigate({ to: "/about" })} right={<ChevronRight className="h-5 w-5 text-muted-foreground" />} />
      </Scroll>
      {pin !== null && (
        <div className="absolute inset-0 z-50 grid place-items-center px-8">
          <button aria-label="Close" className="absolute inset-0 bg-overlay animate-fade" onClick={() => setPin(null)} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (unlockAdmin(pin)) {
                setPin(null);
                navigate({ to: "/admin" });
              } else setErr(true);
            }}
            className="relative w-full max-w-[320px] rounded-2xl bg-popover p-5 shadow-2xl animate-pop"
          >
            <div className="font-condensed text-[19px]">Admin access</div>
            <div className="mt-1 text-[14px] text-muted-foreground">Enter the access code</div>
            <input
              autoFocus
              inputMode="numeric"
              type="password"
              value={pin}
              onChange={(e) => {
                setErr(false);
                setPin(e.target.value.replace(/\D/g, "").slice(0, 8));
              }}
              className={cn(
                "font-num mt-4 h-12 w-full border-b-2 bg-transparent text-center text-[24px] tracking-[0.5em] outline-none",
                err ? "border-down" : "border-primary",
              )}
            />
            {err && <div className="mt-2 text-[13px] text-down">Wrong code</div>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPin(null)} className="h-10 px-4 font-medium text-primary">
                CANCEL
              </button>
              <button type="submit" className="h-10 rounded-full bg-primary px-5 font-medium text-primary-foreground">
                OK
              </button>
            </div>
          </form>
        </div>
      )}
    </Page>
  );
}

const IMPACT: Record<string, string> = { High: "bg-down", Medium: "bg-chart-4", Low: "bg-chart-5", Holiday: "bg-muted-foreground" };

export function CalendarScreen() {
  const fetchCal = useServerFn(getCalendar);
  const q = useQuery({ queryKey: ["calendar"], queryFn: () => fetchCal() });
  const events = q.data?.events ?? [];
  let lastDay = "";
  return (
    <Page nav={false}>
      <TopBar back title="Economic calendar" />
      <Scroll>
        {q.isLoading && <div className="p-8 text-center text-muted-foreground">Loading events…</div>}
        {events.map((e, i) => {
          const d = new Date(e.date);
          const day = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
          const header = day !== lastDay;
          lastDay = day;
          return (
            <div key={i}>
              {header && <div className="bg-section px-4 py-1.5 text-[13px] font-medium text-muted-foreground">{day}</div>}
              <div className="flex items-center gap-3 border-b border-border px-4 py-2">
                <span className="font-num w-12 shrink-0 text-[14px] text-muted-foreground">
                  {d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className={cn("h-3 w-3 shrink-0 rounded-sm", IMPACT[e.impact] ?? "bg-muted")} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] text-foreground">
                    <span className="font-semibold">{e.country}</span> {e.title}
                  </div>
                  <div className="font-num text-[12px] text-muted-foreground">
                    Forecast: {e.forecast || "-"} · Previous: {e.previous || "-"}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </Scroll>
    </Page>
  );
}

function InfoPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Page nav={false}>
      <TopBar back title={title} />
      <Scroll className="px-5 py-4 text-[15px] leading-relaxed text-foreground">{children}</Scroll>
    </Page>
  );
}

function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-between rounded-xl border border-border px-4 py-3 text-primary press">
      {children}
      <ExternalLink className="h-4 w-4" />
    </a>
  );
}

export function CommunityScreen() {
  return (
    <InfoPage title="Traders Community">
      <p>Join the largest community of algorithmic traders: forums, articles, trading signals and freelance jobs.</p>
      <ExtLink href="https://www.mql5.com/en/forum">Forum</ExtLink>
      <ExtLink href="https://www.mql5.com/en/signals">Trading signals</ExtLink>
      <ExtLink href="https://www.mql5.com/en/articles">Articles</ExtLink>
    </InfoPage>
  );
}

export function AlgoScreen() {
  return (
    <InfoPage title="MQL5 Algo Trading">
      <p>Find trading robots and technical indicators for MetaTrader 5 in the MQL5 Market.</p>
      <ExtLink href="https://www.mql5.com/en/market/mt5">MQL5 Market</ExtLink>
      <ExtLink href="https://www.mql5.com/en/code/mt5">Code Base</ExtLink>
    </InfoPage>
  );
}

export function GuideScreen() {
  const topics = [
    ["Quotes", "Tap a symbol to open a new order, its chart, properties or market statistics. Use + to add symbols and the pencil to remove them."],
    ["Charts", "Pinch to zoom, drag to scroll. Change the timeframe from the top bar and trade with the SELL and BUY buttons."],
    ["Trade", "See balance, equity, margin and open positions. Tap a position for details, press and hold to close it."],
    ["History", "Review closed positions, orders and deals. Use the calendar to change the period."],
  ];
  return (
    <InfoPage title="User guide">
      {topics.map(([t, d]) => (
        <div key={t} className="mb-4">
          <div className="font-condensed text-[18px] font-semibold">{t}</div>
          <p className="text-muted-foreground">{d}</p>
        </div>
      ))}
    </InfoPage>
  );
}

export function AboutScreen() {
  return (
    <InfoPage title="About">
      <div className="flex flex-col items-center pt-8 text-center">
        <Mt5Logo size={88} />
        <div className="mt-4 font-condensed text-[24px]">MetaTrader 5</div>
        <div className="text-muted-foreground">Version 5.00 build 5370</div>
        <div className="mt-6 text-[13px] text-muted-foreground">Mobile trading terminal</div>
      </div>
    </InfoPage>
  );
}

export function AccountsScreen() {
  const s = useTerminal();
  return (
    <Page nav={false}>
      <TopBar
        back
        title="Accounts"
        actions={
          <IconBtn label="Add account" onClick={() => toast("Only one demo account is available")}>
            <Plus className="h-6 w-6" />
          </IconBtn>
        }
      />
      <Scroll className="p-4">
        <div className="relative overflow-hidden rounded-2xl border border-border p-4">
          <div className="pointer-events-none absolute -right-9 top-3 w-32 rotate-45 bg-demo py-0.5 text-center font-condensed text-[12px] text-demo-foreground">
            Demo
          </div>
          <div className="flex items-center gap-3">
            <Mt5Logo size={44} />
            <div>
              <div className="text-[17px]">{s.account.name}</div>
              <div className="text-[14px] text-muted-foreground">
                {s.account.login} - {s.account.server}
              </div>
            </div>
          </div>
          <div className="font-num mt-4 text-[26px]">{fmtMoney(s.account.balance)} USD</div>
          <div className="text-[13px] text-muted-foreground">Leverage 1:{s.account.leverage}</div>
        </div>
      </Scroll>
    </Page>
  );
}
