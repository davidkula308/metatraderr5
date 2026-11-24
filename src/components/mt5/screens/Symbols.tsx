import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { SYMBOLS } from "@/lib/market/symbols";
import { setState, useTerminal } from "@/lib/trading/store";
import { Page, Scroll, TopBar } from "../Shell";
import { SymbolIcon } from "../SymbolIcon";

export function SymbolsScreen() {
  const s = useTerminal();
  const [q, setQ] = useState("");
  const list = SYMBOLS.filter((x) => (x.name + x.description).toLowerCase().includes(q.toLowerCase()));
  return (
    <Page nav={false}>
      <TopBar back title="Add symbol" />
      <div className="px-4 pb-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find symbols"
          className="h-11 w-full rounded-full bg-muted px-4 text-[16px] outline-none"
        />
      </div>
      <Scroll>
        {list.map((x) => {
          const added = s.quotesList.includes(x.name);
          return (
            <button
              key={x.name}
              onClick={() =>
                setState((st) => ({
                  ...st,
                  quotesList: added ? st.quotesList.filter((n) => n !== x.name) : [...st.quotesList, x.name],
                }))
              }
              className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left press"
            >
              <SymbolIcon symbol={x.name} size={30} />
              <div className="min-w-0 flex-1">
                <div className="font-condensed text-[17px] font-semibold">{x.name}</div>
                <div className="truncate text-[13px] text-muted-foreground">{x.description}</div>
              </div>
              {added ? <Check className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-icon" />}
            </button>
          );
        })}
      </Scroll>
    </Page>
  );
}
