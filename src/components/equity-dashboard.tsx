import { useDesk } from "@/lib/desk-store";
import { equity, exposure } from "@/lib/paper";
import { getTierDisplayName, getTierColor, getTierBg, stakeBudgetFor } from "@/lib/sniper/tier-config";
import { formatGuardStatus } from "@/lib/sniper/equity-guard";
import { calculateTrailingStop } from "@/lib/sniper/profit-lock";
import { cn } from "@/lib/cn";

export function EquityDashboard() {
  const mode = useDesk((s) => s.mode);
  const demo = useDesk((s) => s.demo);
  const live = useDesk((s) => s.live);
  const profitLockState = useDesk((s) => s.profitLockState);
  const currentTier = useDesk((s) => s.currentTier);
  const tierConfig = useDesk((s) => s.tierConfig);
  const equityGuardState = useDesk((s) => s.equityGuardState);
  const selectedModel = useDesk((s) => s.selectedModel);

  const book = mode === "live" ? live : demo;
  const currentEquity = equity(book);
  const staked = exposure(book);
  const stake = stakeBudgetFor(currentEquity);
  const trailingStop = calculateTrailingStop(profitLockState.peakEquity, 0.1);
  const guard = formatGuardStatus(equityGuardState);
  const unrealized = currentEquity - profitLockState.baseEquity;

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
            Equity protection · {selectedModel?.name ?? "Sweet Spot"}
          </p>
          <p className="mt-0.5 text-xs text-faint">
            80% of gains lock automatically · 20% compounds (max $1000) · bot stays armed
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase",
            getTierBg(currentTier),
            getTierColor(currentTier),
          )}
          title={`${tierConfig.description} · Risk ${(tierConfig.maxRiskPerTrade * 100).toFixed(2)}%/trade · Max ${tierConfig.maxPositions} positions · Max ${(tierConfig.maxPortfolioExposure * 100).toFixed(0)}% exposure`}
        >
          {getTierDisplayName(currentTier)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg border border-line/60 bg-panel-2 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-faint">Equity</p>
          <p className="num mt-0.5 font-mono text-sm font-bold text-cream">
            ${currentEquity.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-line/60 bg-panel-2 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-faint">Protected base</p>
          <p className="num mt-0.5 font-mono text-sm font-bold text-gain">
            ${profitLockState.baseEquity.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-line/60 bg-panel-2 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-faint">Locked profit</p>
          <p className="num mt-0.5 font-mono text-sm font-bold text-brass">
            ${profitLockState.lockedProfits.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-line/60 bg-panel-2 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-faint">Compounding</p>
          <p className="num mt-0.5 font-mono text-sm font-bold text-cream">
            ${profitLockState.compoundingEquity.toFixed(2)} / $1000
          </p>
        </div>
        <div className="rounded-lg border border-line/60 bg-panel-2 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-faint">Trailing stop</p>
          <p className="num mt-0.5 font-mono text-sm font-bold text-loss">
            ${trailingStop.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-line/60 bg-panel-2 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-faint">Staked / budget</p>
          <p className="num mt-0.5 font-mono text-sm font-bold text-cream">
            ${staked.toFixed(2)} <span className="text-faint">/ ${stake.budget.toFixed(2)}</span>
          </p>
        </div>
        <div className="rounded-lg border border-line/60 bg-panel-2 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-faint">Guard</p>
          <p
            className={cn(
              "mt-0.5 font-mono text-sm font-bold",
              guard.status === "OK" && "text-gain",
              guard.status === "REDUCED" && "text-amber-400",
              (guard.status === "HALTED" || guard.status === "COOLDOWN") && "text-loss",
            )}
          >
            {guard.status} · {Math.round(equityGuardState.riskMultiplier * 100)}%
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-faint">
        <span>
          Unrealized:{" "}
          <strong className={unrealized >= 0 ? "text-gain" : "text-loss"}>
            {unrealized >= 0 ? "+" : ""}${unrealized.toFixed(2)}
          </strong>{" "}
          · Peak ${profitLockState.peakEquity.toFixed(2)} · Risk{" "}
          {(tierConfig.maxRiskPerTrade * 100).toFixed(2)}%/trade · {tierConfig.maxPositions} max
          positions
        </span>
        <span className="font-mono">{guard.summary}</span>
      </div>
    </div>
  );
}
