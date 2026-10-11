import { pct } from "@/lib/sniper/format";
import { useSniper } from "@/lib/sniper/store";
import { SOURCE_META, type QuoteSignal, type Side } from "@/lib/sniper/types";
import { Card, Label } from "@/components/ui";
import { cn } from "@/lib/cn";

export function SignalsView() {
  const book = useSniper((s) => s.book);
  const rows = book.symbols.map((sym) => ({ sym, set: book.signals[sym.symbol] }));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium md:text-3xl">Signal desks</h1>
        <p className="mt-1 max-w-2xl text-sm text-faint">
          Three models stand in for the three reference sites. Monroe does not log into them and does not send live orders.
          Agreement has to clear the confidence gate in Settings before a fill.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {(Object.keys(SOURCE_META) as Array<keyof typeof SOURCE_META>).map((id) => {
          const meta = SOURCE_META[id];
          const src = book.settings.sources[id];
          return (
            <Card key={id}>
              <Label>{meta.label}</Label>
              <p className="mt-2 text-sm text-cream">{meta.role}</p>
              <p className="mt-2 text-xs text-faint">{src.enabled ? `Weight ${src.weight.toFixed(1)}` : "Off"}</p>
              <a className="mt-3 inline-flex min-h-11 items-center text-sm text-brass" href={meta.href} target="_blank" rel="noreferrer">
                Open {meta.label}
              </a>
            </Card>
          );
        })}
      </div>
      <Card>
        <Label>This minute</Label>
        <ul className="mt-2">
          {rows.map(({ sym, set }) => (
            <li key={sym.symbol} className="border-t border-line py-3 first:border-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium">
                  {sym.symbol} <span className="text-xs font-normal text-faint">{sym.sector}</span>
                </p>
                <p className="font-mono text-sm">{sym.price.toFixed(2)}</p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                <Sig label="Invo" sig={set?.invo} />
                <Sig label="Finviz" sig={set?.finviz} />
                <Sig label="Simul8or" sig={set?.simul8or} />
                <Sig label="Ensemble" sig={set?.ensemble} strong />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Sig({ label, sig, strong = false }: { label: string; sig?: QuoteSignal; strong?: boolean }) {
  if (!sig) return <span className="text-faint">—</span>;
  return (
    <div>
      <p className="text-xs text-faint">{label}</p>
      <p className={cn("font-mono text-xs", tone(sig.action), strong && "text-sm")}>
        {sig.action} {pct(sig.confidence)}
      </p>
      <p className="text-xs text-faint">{sig.note}</p>
    </div>
  );
}

function tone(action: Side) {
  if (action === "BUY") return "text-gain";
  if (action === "SELL") return "text-loss";
  return "text-faint";
}
