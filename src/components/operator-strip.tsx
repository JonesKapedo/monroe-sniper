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
  const turboPhase = useDesk((s) => s.turboPhase);
  const note = useDesk((s) => s.note);

  const activeBook = mode === "live" ? live : demo;
  const activeEq = equity(activeBook);
  const activeLocked = exposure(activeBook);
  const stakeInfo = stakeBudgetFor(activeEq);
  const stakeRemaining = Math.max(0, stakeInfo.budget - activeLocked);
  const dayPnl = activeBook.dayPnl ?? 0;
  const readiness = getReadiness ? getReadiness() : null;
  const cash = activeBook.cash ?? 0;
  const turbo = turboPhase === "running";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-panel-2/95 px-4 py-1.5 font-mono text-[11px] backdrop-blur md:px-8",
        power && "desk-tick",
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          className={cn(
            "size-1.5 rounded-full",
            turbo ? "bg-loss live-pulse" : power ? "bg-gain live-pulse" : "bg-faint",
          )}
        />
        <span className="font-semibold tracking-wide text-brass">
          {selectedModel?.name ?? "Sweet Spot"}
        </span>
        {turbo && <span className="rounded bg-loss/20 px-1 text-[10px] font-bold text-loss">TURBO</span>}
      </span>

      <span className="text-line/80">│</span>

      <span className="text-cream" title="Portfolio stake vs tier budget">
        STK{" "}
        <span className={activeLocked > 0 ? "text-cream" : "text-faint"}>
          ${activeLocked.toFixed(0)}
        </span>
        <span className="text-faint">/</span>
        ${stakeInfo.budget.toFixed(0)}
        <span className="ml-1 text-faint">({stakeRemaining.toFixed(0)} free)</span>
      </span>

      <span className="text-line/80">│</span>

      <span title="Cash available for new entries">
        CSH <span className="text-cream">${cash.toFixed(0)}</span>
      </span>

      <span className="text-line/80">│</span>

      <span>
        {activeBook.positions.length}
        <span className="text-faint"> open</span>
      </span>

      <span className="text-line/80">│</span>

      <span className={cn("font-semibold", dayPnl > 0 ? "text-gain" : dayPnl < 0 ? "text-loss" : "text-faint")}>
        DAY {dayPnl >= 0 ? "+" : ""}
        ${dayPnl.toFixed(2)}
      </span>

      {readiness && (
        <>
          <span className="text-line/80">│</span>
          <span
            className={cn(
              "font-semibold",
              readiness.readinessScore >= 85 ? "text-gain" : "text-amber-400",
            )}
            title="Paper discipline readiness (qualifying trades only)"
          >
            RDY {readiness.readinessScore}%
            <span className="ml-1 font-normal text-faint">
              ({readiness.completedDemoTrades ?? 0}Q)
            </span>
          </span>
        </>
      )}

      {note && (
        <>
          <span className="hidden text-line/80 sm:inline">│</span>
          <span className="hidden max-w-[14rem] truncate text-faint sm:inline" title={note}>
            {note}
          </span>
        </>
      )}

      <span className="ml-auto tracking-wider text-faint">
        EQ ${activeEq.toFixed(0)} · {mode === "live" ? "LIVE·LOCKED" : "PAPER"} ·{" "}
        <span className={power ? "text-gain" : "text-faint"}>{power ? "ARMED" : "STANDBY"}</span>
      </span>
    </div>
  );
}
