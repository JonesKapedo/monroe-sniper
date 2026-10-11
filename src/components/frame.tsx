import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Brain,
  LayoutDashboard,
  Radar,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { catchUpTicks } from "@/lib/sniper/catchup";
import { sessionClock } from "@/lib/sniper/format";
import { snapshot } from "@/lib/sniper/risk";
import { hashPin } from "@/lib/sniper/wallet";
import { useSniper } from "@/lib/sniper/store";
import { Button } from "@/components/ui";

const NAV = [
  { to: "/", label: "Desk", short: "Desk", icon: LayoutDashboard },
  { to: "/tape", label: "Tape", short: "Tape", icon: Activity },
  { to: "/signals", label: "Signals", short: "Feed", icon: Radar },
  { to: "/learn", label: "Learning", short: "Learn", icon: Brain },
  { to: "/wallet", label: "Wallet", short: "Funds", icon: Wallet },
  { to: "/settings", label: "Settings", short: "Setup", icon: SlidersHorizontal },
] as const;

export function Frame({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancel = false;
    let timer = 0;
    const loop = () => {
      if (cancel) return;
      const book = useSniper.getState().book;
      const interval = Math.max(1, book.settings.scanSeconds) * 1000;
      const due = catchUpTicks(Date.now(), book.lastWall, book.settings.scanSeconds);
      if (due > 0) useSniper.getState().runTicks(due);
      timer = window.setTimeout(loop, interval);
    };
    void (async () => {
      await useSniper.persist.rehydrate();
      if (cancel) return;
      setReady(true);
      loop();
    })();
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col justify-between bg-ink px-6 py-8 text-cream">
        <p className="text-sm tracking-widest text-brass uppercase">Monroe</p>
        <p className="max-w-sm text-2xl font-medium">Opening the paper desk…</p>
      </div>
    );
  }

  return <Shell>{children}</Shell>;
}

function Shell({ children }: { children: ReactNode }) {
  const book = useSniper((s) => s.book);
  const unlocked = useSniper((s) => s.unlocked);
  const locked = Boolean(book.pinHash) && !unlocked;
  const snap = snapshot(book);
  const clock = sessionClock(book.minute);
  const updateSettings = useSniper((s) => s.updateSettings);

  return (
    <div className="min-h-screen bg-ink text-cream md:pl-56">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-line bg-panel md:flex">
        <div className="border-b border-line px-5 py-5">
          <p className="text-xs tracking-widest text-brass uppercase">Monroe</p>
          <p className="mt-1 text-lg font-medium">Sniper</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {NAV.map((item) => (
            <NavLink key={item.to} {...item} />
          ))}
        </nav>
        <p className="px-5 py-4 text-xs text-faint">Paper book. Not a broker. No promised profit.</p>
      </aside>

      <div className="flex min-h-screen flex-col pb-20 md:pb-0">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-ink/95 px-4 py-3 backdrop-blur md:px-8">
          <div className="min-w-0">
            <p className="text-xs text-faint md:hidden">Monroe Sniper</p>
            <p className="truncate font-mono text-sm text-cream">{clock.label}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <p className="hidden font-mono text-sm sm:block">{moneyShort(snap.equity)}</p>
            <button
              type="button"
              onClick={() => updateSettings({ autoTrade: !book.settings.autoTrade })}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-3 text-sm"
            >
              <span
                className={cn("size-2 rounded-full", book.settings.autoTrade ? "bg-gain pulse-dot" : "bg-faint")}
              />
              {book.settings.autoTrade ? "Armed" : "Paused"}
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 py-4 md:px-8 md:py-6">{locked ? <LockScreen /> : children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-panel md:hidden">
        {NAV.map((item) => (
          <NavLink key={item.to} {...item} compact />
        ))}
      </nav>
    </div>
  );
}

function moneyShort(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function NavLink({
  to,
  label,
  short,
  icon: Icon,
  compact = false,
}: {
  to: (typeof NAV)[number]["to"];
  label: string;
  short: string;
  icon: (typeof NAV)[number]["icon"];
  compact?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const on = to === "/" ? pathname === "/" : pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={cn(
        compact
          ? "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-xs"
          : "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm",
        on ? "bg-panel-2 text-cream" : "text-faint",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {compact ? short : label}
    </Link>
  );
}

function LockScreen() {
  const book = useSniper((s) => s.book);
  const unlock = useSniper((s) => s.unlock);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [misses, setMisses] = useState(0);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-10">
      <p className="text-xs tracking-widest text-brass uppercase">Desk locked</p>
      <h1 className="text-3xl font-medium">Enter the PIN</h1>
      <p className="text-sm text-faint">
        The simulator keeps stepping behind this lock. The PIN only guards this browser. It is not a bank login.
      </p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (wait > 0) return;
          void hashPin(pin).then((hash) => {
            if (hash === book.pinHash) {
              setError("");
              unlock();
              return;
            }
            const next = misses + 1;
            setMisses(next);
            setPin("");
            if (next >= 5) {
              setWait(20);
              setMisses(0);
              setError("Too many tries. Wait 20 seconds.");
              return;
            }
            setError("That PIN does not match.");
          });
        }}
      >
        <input
          className="field"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={pin}
          aria-label="Desk PIN"
          onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
        />
        {error ? <p className="text-sm text-loss">{error}</p> : null}
        <Button type="submit" disabled={pin.length < 4 || wait > 0}>
          {wait > 0 ? `Wait ${wait}s` : "Unlock"}
        </Button>
      </form>
    </div>
  );
}
