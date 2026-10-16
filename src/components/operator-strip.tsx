import { cn } from "@/lib/cn";
import { useDesk } from "@/lib/desk-store";
import { equity, exposure } from "@/lib/paper";
import { stakeBudgetFor } from "@/lib/sniper/tier-config";

/** Tape-style operator strip — glanceable model, stake, day P&L, readiness. */
export function OperatorStrip() {
  const mode = useDesk((s) => s.mode);
  const power = useDesk((s) => s.power);
  const demo = useDesk((s) => s.demo);
  const live = useDesk((s) => s.live);
  const selectedModel = useDesk((s) => s.selectedModel);
  const getReadiness = useDesk((s) => s.getReadiness);

  const activeBook = mode === "live" ? live : demo;
  const activeEq = equity(activeBook);
  const activeLocked = exposure(activeBook);
  const stakeInfo = stakeBudgetFor(activeEq);
  const stakeRemaining = Math.max(0, stakeInfo.budget - activeLocked);
  const dayPnl = activeBook.dayPnl ?? 0;
  const readiness = getReadiness ? getReadiness() : null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-panel-2/90 px-4 py-1.5 font-mono text-[11px] backdrop-blur md:px-8">
      <span className="inline-flex items-center gap-1.5">
        <span className={cn("size-1.5 rounded-full", power ? "bg-gain live-pulse" : "bg-faint")} />
        <span className="font-semibold tracking-wide text-brass">
          {selectedModel?.name ?? "Sweet Spot"}
        </span>
      </span>
      <span className="text-line">│</span>
      <span className="text-cream">
        STK <span className="text-faint">${activeLocked.toFixed(0)}</span>
        <span className="text-faint">/</span>
        ${stakeInfo.budget.toFixed(0)}
        <span className="ml-1 text-faint">({stakeRemaining.toFixed(0)} free)</span>
      </span>
      <span className="text-line">│</span>
      <span>
        {activeBook.positions.length}
        <span className="text-faint"> open</span>
      </span>
      <span className="text-line">│</span>
      <span className={dayPnl >= 0 ? "text-gain" : "text-loss"}>
        DAY {dayPnl >= 0 ? "+" : ""}${dayPnl.toFixed(2)}
      </span>
      {readiness && (
        <>
          <span className="text-line">│</span>
          <span className={readiness.readinessScore >= 85 ? "text-gain" : "text-amber-400"}>
            RDY {readiness.readinessScore}%
            <span className="ml-1 text-faint">({readiness.completedDemoTrades ?? 0}Q)</span>
          </span>
        </>
      )}
      <span className="ml-auto tracking-wider text-faint">
        {mode === "live" ? "LIVE·LOCKED" : "PAPER"} · {power ? "ARMED" : "STANDBY"}
      </span>
    </div>
  );
}
