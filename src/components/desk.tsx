import { useEffect, useState } from "react";
import { Crosshair, Pause, Play, RotateCcw, Search, Shield } from "lucide-react";
import { scanMarket } from "@/lib/market.functions";
import { equity, entryVerdict, exposure, portfolioLines, sampleTape, type Candidate } from "@/lib/paper";
import { useDesk } from "@/lib/desk-store";

type Tab = "scan" | "book" | "risk" | "later";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const px = (n: number) => {
  if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `$${n.toPrecision(3)}`;
};

export function Desk() {
  const book = useDesk((s) => s.book);
  const tape = useDesk((s) => s.tape);
  const note = useDesk((s) => s.note);
  const enterName = useDesk((s) => s.enterName);
  const flatten = useDesk((s) => s.flatten);
  const halt = useDesk((s) => s.halt);
  const applyMarks = useDesk((s) => s.applyMarks);
  const setTape = useDesk((s) => s.setTape);
  const reset = useDesk((s) => s.reset);
  const markHydrated = useDesk((s) => s.markHydrated);
  const [tab, setTab] = useState<Tab>("scan");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Candidate | null>(null);

  useEffect(() => {
    void useDesk.persist.rehydrate();
    markHydrated();
  }, [markHydrated]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const prices: Record<string, number> = {};
      for (const p of useDesk.getState().book.positions) {
        const drift = 1 + (Math.random() - 0.48) * 0.012;
        prices[p.tokenId] = p.mark * drift;
      }
      if (Object.keys(prices).length) applyMarks(prices);
    }, 4000);
    return () => window.clearInterval(id);
  }, [applyMarks]);

  async function scan(q: string) {
    setBusy(true);
    try {
      const res = await scanMarket({ data: { query: q } });
      if (res.candidates.length) setTape(res.candidates, res.note);
      else setTape(sampleTape(), `${res.note}. Showing the built-in sample tape.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Scan failed";
      setTape(sampleTape(), `${message}. Showing the built-in sample tape.`);
    } finally {
      setBusy(false);
    }
  }

  const eq = equity(book);
  const exp = exposure(book);
  const dd = book.peakEquity > 0 ? Math.max(0, (book.peakEquity - eq) / book.peakEquity) : 0;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="num text-xs tracking-widest text-accent uppercase">Paper desk</p>
          <h1 className="mt-1 text-4xl leading-none text-fg">Monroe Sniper</h1>
          <p className="mt-2 max-w-xl text-base text-muted">
            Public tape, fail-closed gates, simulated fills. Nothing here sends a live order.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Stat label="Equity" value={money(eq)} />
          <Stat label="Cash" value={money(book.cash)} />
          <Stat label="Open" value={`${book.positions.length}/3`} />
          <button
            type="button"
            onClick={() => halt(!book.kill)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm text-fg"
          >
            {book.kill ? <Play className="size-4" /> : <Pause className="size-4" />}
            {book.kill ? "Clear halt" : "Kill switch"}
          </button>
        </div>
      </header>

      <p className="num mt-4 text-sm text-muted">{note}</p>

      <nav className="mt-4 flex gap-2 overflow-x-auto">
        {(
          [
            ["scan", "Scanner"],
            ["book", "Book"],
            ["risk", "Risk"],
            ["later", "Needs keys"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={
              "min-h-11 rounded-full px-4 text-sm " +
              (tab === id ? "bg-accent text-accent-ink" : "bg-surface text-muted")
            }
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "scan" && (
        <section className="mt-6">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              void scan(query);
            }}
          >
            <label className="sr-only" htmlFor="q">
              Search tokens
            </label>
            <div className="flex min-h-11 flex-1 items-center gap-2 rounded-card border border-line bg-surface px-3">
              <Search className="size-4 text-muted" />
              <input
                id="q"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Symbol, name, or contract"
                className="w-full bg-transparent py-3 text-fg outline-none placeholder:text-muted"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 rounded-card bg-accent px-5 text-sm font-medium text-accent-ink disabled:opacity-60"
            >
              {busy ? "Scanning…" : "Scan live tape"}
            </button>
            <button
              type="button"
              onClick={() => setTape(sampleTape(), "Sample tape loaded. Scores are heuristics, not a promise.")}
              className="min-h-11 rounded-card border border-line px-4 text-sm text-fg"
            >
              Sample tape
            </button>
          </form>

          <ul className="mt-5 grid gap-3">
            {tape.length === 0 && (
              <li className="rounded-card border border-dashed border-line p-6 text-muted">
                No names yet. Scan DexScreener or load the sample tape.
              </li>
            )}
            {tape.map((c) => {
              const v = entryVerdict(book, c);
              return (
                <li key={c.id} className="rounded-card border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl">{c.symbol}</span>
                        <span className="text-sm text-muted">{c.chain}</span>
                      </div>
                      <p className="text-sm text-muted">{c.name}</p>
                      <p className="mt-2 max-w-xl text-sm text-fg">{c.rationale[0]}</p>
                    </div>
                    <div className="text-right">
                      <p className="num text-3xl text-accent">{c.score}</p>
                      <p className="num text-sm text-muted">{px(c.priceUsd)}</p>
                      <p className="num text-sm text-muted">Liq {money(c.liquidityUsd)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {c.flags.map((f) => (
                      <span key={f} className="num rounded-full border border-line px-2 py-1 text-xs text-loss">
                        {f}
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPicked(picked?.id === c.id ? null : c)}
                      className="ml-auto min-h-11 rounded-full border border-line px-4 text-sm"
                    >
                      Gate
                    </button>
                    <button
                      type="button"
                      disabled={!v.allowed}
                      onClick={() => enterName(c)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm text-accent-ink disabled:opacity-40"
                    >
                      <Crosshair className="size-4" />
                      Paper buy
                    </button>
                  </div>
                  {picked?.id === c.id && (
                    <ul className="mt-3 grid gap-1 border-t border-line pt-3">
                      {v.lines.map((line) => (
                        <li key={line.id} className="flex justify-between gap-3 text-sm">
                          <span className={line.pass ? "text-ok" : "text-loss"}>{line.label}</span>
                          <span className="num text-muted">{line.detail}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {tab === "book" && (
        <section className="mt-6 grid gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl">Open paper</h2>
            <button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted">
              <RotateCcw className="size-4" /> Reset book
            </button>
          </div>
          {book.positions.length === 0 && (
            <p className="rounded-card border border-dashed border-line p-6 text-muted">No open paper positions.</p>
          )}
          {book.positions.map((p) => {
            const pnl = (p.mark - p.entryPrice) * p.qty;
            return (
              <article key={p.id} className="rounded-card border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-2xl">{p.symbol}</h3>
                    <p className="num text-sm text-muted">
                      {p.chain} · qty {p.qty.toPrecision(4)} · stop {px(p.stop)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={"num text-xl " + (pnl >= 0 ? "text-ok" : "text-loss")}>
                      {pnl >= 0 ? "+" : ""}
                      {money(pnl)}
                    </p>
                    <p className="num text-sm text-muted">Mark {px(p.mark)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => flatten(p.id)}
                  className="mt-3 min-h-11 rounded-full border border-line px-4 text-sm"
                >
                  Flatten
                </button>
              </article>
            );
          })}
          <h2 className="mt-2 text-2xl">Closed</h2>
          <ul className="grid gap-2">
            {book.trades.length === 0 && <li className="text-muted">No closes yet.</li>}
            {book.trades.map((t) => (
              <li key={t.id} className="flex justify-between rounded-card bg-surface-2 px-4 py-3 text-sm">
                <span>
                  {t.symbol} · {t.reason}
                </span>
                <span className={"num " + (t.pnl >= 0 ? "text-ok" : "text-loss")}>{money(t.pnl)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "risk" && (
        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <article className="rounded-card border border-line bg-surface p-5">
            <div className="flex items-center gap-2 text-accent">
              <Shield className="size-4" />
              <h2 className="text-2xl text-fg">Portfolio gates</h2>
            </div>
            <ul className="mt-4 grid gap-2">
              {portfolioLines(book).map((line) => (
                <li key={line.id} className="flex justify-between text-sm">
                  <span className={line.pass ? "text-ok" : "text-loss"}>{line.label}</span>
                  <span className="num text-muted">{line.detail}</span>
                </li>
              ))}
            </ul>
          </article>
          <article className="rounded-card border border-line bg-surface p-5">
            <h2 className="text-2xl">Exposure</h2>
            <p className="mt-2 text-muted">
              Idea cap 5% of equity. Book cap 15%. Hard stop 8% under fill. Six-hour time stop. Three-loss cooldown.
            </p>
            <p className="num mt-4 text-3xl">{money(exp)}</p>
            <p className="num text-sm text-muted">Drawdown {(dd * 100).toFixed(1)}% · streak {book.consecutiveLosses}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-accent" style={{ width: `${Math.min(100, (exp / Math.max(eq, 1)) * 100 * (100 / 15))}%` }} />
            </div>
          </article>
        </section>
      )}

      {tab === "later" && (
        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          <Later
            title="Chain RPC"
            body="Swap this desk's mark loop for a websocket of pool logs. One chain first. Interface: subscribe(pair) → price, liquidity."
          />
          <Later
            title="Wallet signing"
            body="Keep keys on a server signer, never in the browser. Strategy proposes; a separate signer checks notional, chain, and router before it signs."
          />
          <Later
            title="DEX router"
            body="Plug a quote → simulate → submit adapter behind the same Gate. Testnet only until fills reconcile to the ledger."
          />
          <Later
            title="Alerts"
            body="Operator channel for halt, failed exit, and stale feed. The desk already has the events; it only needs a destination."
          />
        </section>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className="num text-lg">{value}</p>
    </div>
  );
}

function Later({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-card border border-line bg-surface p-5">
      <p className="num text-xs text-accent uppercase">Not connected</p>
      <h2 className="mt-1 text-2xl">{title}</h2>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </article>
  );
}
