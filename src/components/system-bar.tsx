import { useEffect, useState } from "react";
import { Database, Gauge, Radio, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { useDesk } from "@/lib/desk-store";
import { useSniper } from "@/lib/sniper/store";
import { useFeedHealth } from "@/lib/feeds/status";
import { useNotifications } from "@/lib/notifications";
import { equity, exposure } from "@/lib/paper";
import { stakeBudgetFor } from "@/lib/sniper/tier-config";

/**
 * Global system rail — feed health, learning DB, engine heartbeat, model
 * learning and book risk. Rendered by the shell, so it is present on every page.
 */
export function SystemBar() {
  const mode = useDesk((s) => s.mode);
  const power = useDesk((s) => s.power);
  const demo = useDesk((s) => s.demo);
  const live = useDesk((s) => s.live);
  const dbOk = useDesk((s) => s.dbOk);
  const dbSource = useDesk((s) => s.dbSource);
  const turboPhase = useDesk((s) => s.turboPhase);
  const rows = useFeedHealth((s) => s.rows);
  const unread = useNotifications((s) => s.items.filter((n) => !n.read).length);
  const model = useSniper((s) => s.book.model);
  const lastWall = useSniper((s) => s.book.lastWall);
  const scanSeconds = useSniper((s) => s.book.settings.scanSeconds);

  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const book = mode === "live" ? live : demo;
  const eq = equity(book);
  const locked = exposure(book);
  const budget = stakeBudgetFor(eq);
  const riskPct = eq > 0 ? (locked / eq) * 100 : 0;
  const liveFeeds = rows.filter((r) => r.state === "live").length;
  const feedsDown = rows.some((r) => r.state === "down");
  const acc = model.samples > 0 ? Math.round((model.correct / model.samples) * 100) : 0;
  const ageSec = lastWall ? Math.max(0, Math.round((Date.now() - lastWall) / 1000)) : null;
  const heartbeatFresh = ageSec !== null && ageSec <= scanSeconds * 2 + 5;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line/70 bg-panel-2/60 px-4 py-1 font-mono text-[10px] text-faint md:px-8">
      <span className="inline-flex items-center gap-1.5" title="Market & on-chain feed health">
        <Radio className={cn("size-3", feedsDown ? "text-amber-400" : "text-brass/80")} />
        <span className="uppercase tracking-wider">Feeds</span>
        <span className={cn("font-semibold", feedsDown ? "text-amber-400" : "text-cream")}>
          {rows.length ? `${liveFeeds}/${rows.length}` : "—"}
        </span>
      </span>

      <span className="text-line/70">│</span>

      <span className="inline-flex items-center gap-1.5" title={`Learning DB: ${dbSource}`}>
        <Database className={cn("size-3", dbOk ? "text-emerald-400" : "text-amber-400")} />
        <span className="uppercase tracking-wider">DB</span>
        <span className={cn("font-semibold", dbOk ? "text-cream" : "text-amber-400")}>
          {dbOk ? dbSource : "local"}
        </span>
      </span>

      <span className="text-line/70">│</span>

      <span className="inline-flex items-center gap-1.5" title="Engine heartbeat">
        <Gauge className={cn("size-3", power && heartbeatFresh ? "text-gain" : "text-faint")} />
        <span className="uppercase tracking-wider">Engine</span>
        <span className={cn("font-semibold", power ? "text-cream" : "text-faint")} suppressHydrationWarning>
          {power ? (ageSec === null ? "starting" : `${ageSec}s`) : "standby"}
        </span>
        {turboPhase === "running" && <span className="rounded bg-loss/20 px-1 font-bold text-loss">TURBO</span>}
      </span>

      <span className="text-line/70">│</span>

      <span className="inline-flex items-center gap-1.5" title="Model learning progress">
        <ShieldCheck className="size-3 text-brass/80" />
        <span className="uppercase tracking-wider">Model</span>
        <span className="font-semibold text-cream">{model.samples}</span>
        <span>learned{model.samples > 0 ? ` · ${acc}%` : ""}</span>
      </span>

      <span className="text-line/70">│</span>

      <span title="Open positions and stake usage">
        <span className="uppercase tracking-wider">Book</span>{" "}
        <span className="font-semibold text-cream">{book.positions.length}</span>
        <span> open · risk </span>
        <span className={cn("font-semibold", riskPct > 40 ? "text-amber-400" : "text-cream")}>
          {riskPct.toFixed(0)}%
        </span>
        <span className="hidden sm:inline"> of ${budget.budget.toFixed(0)}</span>
      </span>

      <span className="ml-auto inline-flex items-center gap-1.5">
        <span className="uppercase tracking-wider">Alerts</span>
        <span className={cn("font-semibold", unread > 0 ? "text-loss" : "text-faint")}>{unread}</span>
      </span>
    </div>
  );
}
