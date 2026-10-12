import { useState } from "react";
import { money, pct } from "@/lib/sniper/format";
import { kellyFraction } from "@/lib/sniper/risk";
import { useSniper } from "@/lib/sniper/store";
import { SOURCE_META, type SourceId } from "@/lib/sniper/types";
import { useDesk } from "@/lib/desk-store";
import { Button, Card, Label } from "@/components/ui";
import { cn } from "@/lib/cn";

export function SettingsView() {
  const resetDemo = useDesk((s) => s.resetDemo);
  const riskSettings = useDesk((s) => s.riskSettings);
  const updateRiskSettings = useDesk((s) => s.updateRiskSettings);
  const disciplineRules = useDesk((s) => s.disciplineRules);
  const updateDisciplineRules = useDesk((s) => s.updateDisciplineRules);
  const deskMode = useDesk((s) => s.mode);
  const deskBook = useDesk((s) => s[s.mode]);

  const book = useSniper((s) => s.book);
  const update = useSniper((s) => s.updateSettings);
  const setSource = useSniper((s) => s.setSource);
  const runTicks = useSniper((s) => s.runTicks);
  const newSession = useSniper((s) => s.newSession);
  const restore = useSniper((s) => s.restoreOpeningBalance);
  const settings = book.settings;
  const [phrase, setPhrase] = useState("");
  const kelly = kellyFraction(book.trades, settings.kellyCap);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold md:text-3xl">Professional Trader Settings</h1>
          <span className="rounded-full bg-brass/20 px-2.5 py-0.5 text-xs font-semibold text-brass">
            EAT GMT(+3) Nairobi Desk
          </span>
        </div>
        <p className="mt-1 text-sm text-faint">
          Fine-tune the quantitative sniper engine, dynamic position sizing corridors, capital preservation circuits, and academic research safeguards.
        </p>
      </div>

      {/* Dynamic Sizing Profile & Capital Grant Selector */}
      <Card>
        <div className="flex items-center justify-between">
          <Label>Quantitative Risk Engine & Position Sizing Profile</Label>
          <span className="text-xs text-brass font-medium">Outperformance Architecture</span>
        </div>
        <p className="mt-1 text-xs text-faint">
          Selects the dynamic compounding corridor. Sizes positions wisely based on current balance—never starved in micro $1 pennies, nor reckless with capital.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => updateRiskSettings({ sizingProfile: "CONSERVATIVE", riskPerTrade: 0.015, maxIdeaExposure: 0.18, rewardMultiple: 2.5 })}
            className={cn(
              "flex flex-col items-start rounded-xl border p-3 text-left transition-all",
              riskSettings.sizingProfile === "CONSERVATIVE"
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                : "border-line bg-panel-2 text-faint hover:text-cream",
            )}
          >
            <span className="font-bold text-sm">🛡️ Conservative</span>
            <span className="text-xs mt-1">1.5% Risk · 18% Max Slot</span>
            <span className="text-[11px] text-faint mt-1">Max capital preservation</span>
          </button>

          <button
            type="button"
            onClick={() => updateRiskSettings({ sizingProfile: "OPTIMUM_SWEET_SPOT", riskPerTrade: 0.025, maxIdeaExposure: 0.28, rewardMultiple: 3.0 })}
            className={cn(
              "flex flex-col items-start rounded-xl border p-3 text-left transition-all relative",
              riskSettings.sizingProfile === "OPTIMUM_SWEET_SPOT"
                ? "border-brass bg-brass/10 text-brass ring-1 ring-brass/40"
                : "border-line bg-panel-2 text-faint hover:text-cream",
            )}
          >
            <span className="absolute -top-2 right-2 rounded bg-brass px-1.5 py-0.2 text-[10px] font-bold text-ink uppercase">
              Recommended
            </span>
            <span className="font-bold text-sm">⭐ Optimum Sweet Spot</span>
            <span className="text-xs mt-1">2.5% Risk · 28% Max Slot</span>
            <span className="text-[11px] text-faint mt-1">Dynamic balance compounding</span>
          </button>

          <button
            type="button"
            onClick={() => updateRiskSettings({ sizingProfile: "AGGRESSIVE", riskPerTrade: 0.035, maxIdeaExposure: 0.35, rewardMultiple: 3.5 })}
            className={cn(
              "flex flex-col items-start rounded-xl border p-3 text-left transition-all",
              riskSettings.sizingProfile === "AGGRESSIVE"
                ? "border-amber-500 bg-amber-500/10 text-amber-300"
                : "border-line bg-panel-2 text-faint hover:text-cream",
            )}
          >
            <span className="font-bold text-sm">⚡ Aggressive Growth</span>
            <span className="text-xs mt-1">3.5% Risk · 35% Max Slot</span>
            <span className="text-[11px] text-faint mt-1">High-velocity compounding</span>
          </button>
        </div>

        <div className="mt-4 border-t border-line/60 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cream">Opening capital</span>
            <span className="usd text-xs">${deskBook.cash.toFixed(2)}</span>
          </div>
          <p className="mt-0.5 text-xs text-faint">
            The practice book opens at $500. Reset it from Safety if a session drifts. Do not treat other amounts as the starting bankroll.
          </p>
        </div>

        {/* Dynamic Knobs */}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Slider
            label="Equity Risk Per Trade"
            value={riskSettings.riskPerTrade}
            min={0.01}
            max={0.05}
            step={0.005}
            format={(v) => pct(v, 1)}
            onChange={(v) => updateRiskSettings({ riskPerTrade: v })}
          />
          <Slider
            label="Target Reward Multiple"
            value={riskSettings.rewardMultiple}
            min={2.0}
            max={4.5}
            step={0.1}
            format={(v) => `${v.toFixed(1)}R Floor`}
            onChange={(v) => updateRiskSettings({ rewardMultiple: v })}
          />
          <Slider
            label="Max Concurrent Open Slots"
            value={riskSettings.maxPositions}
            min={2}
            max={6}
            step={1}
            format={(v) => `${Math.round(v)} assets`}
            onChange={(v) => updateRiskSettings({ maxPositions: v })}
          />
          <Slider
            label="Max Single Position Exposure"
            value={riskSettings.maxIdeaExposure}
            min={0.1}
            max={0.4}
            step={0.02}
            format={(v) => pct(v)}
            onChange={(v) => updateRiskSettings({ maxIdeaExposure: v })}
          />
        </div>
      </Card>

      {/* Academic Research & Anti-Mistake Safeguards (The 7 Pillars) */}
      <Card>
        <div className="flex items-center justify-between">
          <Label>Academic Research & Anti-Mistake Safeguards</Label>
          <span className="text-xs text-emerald-400 font-medium">All 7 Shields Active</span>
        </div>
        <p className="mt-1 text-xs text-faint">
          Architectural rules synthesized from Investopedia, Medium Outperformance, ResearchGate, Binance, and AML Watcher:
        </p>

        <div className="mt-3 flex flex-col divide-y divide-line/60">
          <div className="py-2.5 flex items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-semibold text-cream">1 & 2. Anti-FOMO Green Candle Filter (Investopedia)</p>
              <p className="text-faint">Rejects buying extended tops with 24h &gt;75% pump and volume/liquidity &gt;2.0x</p>
            </div>
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300">PROTECTED</span>
          </div>

          <div className="py-2.5 flex items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-semibold text-cream">3. Trailing Breakeven Stop Ratchet (Medium Outperformance)</p>
              <p className="text-faint">Once position gains +3.0%, stop loss automatically lifts to +0.8% to guarantee a risk-free trade</p>
            </div>
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300">ARMED</span>
          </div>

          <div className="py-2.5 flex items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-semibold text-cream">5. Rug Pull & Mint Exploit Gate (AML Watcher)</p>
              <p className="text-faint">Enforces minimum $12,000 liquidity depth, verified lock, and verifies mint authority revoked</p>
            </div>
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300">ACTIVE</span>
          </div>

          <div className="py-2.5 flex items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-semibold text-cream">6 & 7. Insider Anticipated Purchases (IAP) Shield (ResearchGate & Binance)</p>
              <p className="text-faint">Flags abnormal pre-announcement volume rushes & order book skew typical of pump-and-dump rings</p>
            </div>
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300">ENFORCED</span>
          </div>

          <div className="py-2.5 flex items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-semibold text-cream">4. Fee & Slippage Erosion Guard (Investopedia Mistake #6)</p>
              <p className="text-faint">Guarantees potential profit exceeds round-trip gas and exchange fees by at least 4x</p>
            </div>
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300">ACTIVE</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-line/60">
          <Slider
            label="Intraday Drawdown Circuit Breaker"
            value={disciplineRules.maxDailyDrawdownPct}
            min={0.01}
            max={0.08}
            step={0.005}
            format={(v) => pct(v, 1)}
            onChange={(v) => updateDisciplineRules({ maxDailyDrawdownPct: v })}
          />
        </div>
      </Card>

      <Card>
        <Label>Risk</Label>
        <Slider label="Risk per trade" value={settings.riskPerTrade} min={0.005} max={0.05} step={0.005} format={(v) => pct(v, 1)} onChange={(v) => update({ riskPerTrade: v })} />
        <Slider label="Stop distance" value={settings.stopPct} min={0.005} max={0.05} step={0.001} format={(v) => pct(v, 1)} onChange={(v) => update({ stopPct: v })} />
        <Slider label="Reward multiple" value={settings.rewardMultiple} min={1} max={4} step={0.1} format={(v) => `${v.toFixed(1)}R`} onChange={(v) => update({ rewardMultiple: v })} />
        <Slider label="Max positions" value={settings.maxPositions} min={1} max={8} step={1} format={(v) => `${Math.round(v)}`} onChange={(v) => update({ maxPositions: v })} />
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span>Quarter-Kelly size cap</span>
          <button
            type="button"
            aria-pressed={settings.useKelly}
            className={cn("min-h-11 rounded-full border px-3", settings.useKelly ? "border-brass text-brass" : "border-line text-faint")}
            onClick={() => update({ useKelly: !settings.useKelly })}
          >
            {settings.useKelly ? "On" : "Off"}
          </button>
        </div>
        <Slider label="Kelly ceiling" value={settings.kellyCap} min={0.02} max={0.2} step={0.01} format={(v) => pct(v)} onChange={(v) => update({ kellyCap: v })} />
        <p className="mt-3 text-xs text-faint">Current size fraction {pct(kelly, 1)} of equity, and never more than free cash split across the open slots.</p>
      </Card>

      <Card>
        <Label>Sources</Label>
        <div className="mt-3 flex flex-col gap-4">
          {(Object.keys(SOURCE_META) as SourceId[]).map((id) => {
            const meta = SOURCE_META[id];
            const src = settings.sources[id];
            return (
              <div key={id} className="border-b border-line pb-4 last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{meta.label}</p>
                    <p className="text-xs text-faint">{meta.role}</p>
                  </div>
                  <button
                    type="button"
                    aria-pressed={src.enabled}
                    className={cn("min-h-11 rounded-full border px-3 text-sm", src.enabled ? "border-brass text-brass" : "border-line text-faint")}
                    onClick={() => setSource(id, { enabled: !src.enabled })}
                  >
                    {src.enabled ? "On" : "Off"}
                  </button>
                </div>
                <Slider label="Weight" value={src.weight} min={0} max={3} step={0.1} format={(v) => v.toFixed(1)} onChange={(v) => setSource(id, { weight: v })} />
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <Label>Safety</Label>
        <Slider label="Daily paper withdrawal cap" value={settings.dailyWithdrawCap} min={100} max={50000} step={100} format={(v) => money(v)} onChange={(v) => update({ dailyWithdrawCap: v })} />
        <div className="mt-4 flex flex-col gap-3">
          <Button variant="ghost" onClick={() => newSession()}>
            Start a flat session
          </Button>
          <p className="text-xs text-faint">Keeps cash, the PIN, and learned weights. Clears open risk and starts a new price path.</p>
          <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel-2 p-3">
            <span className="text-sm font-semibold text-cream">Demo Sandbox Reset</span>
            <p className="text-xs text-faint">Reset the Demo desk balance back to $500.00 and clear the adaptive learning memory.</p>
            <Button
              variant="ghost"
              onClick={() => {
                resetDemo();
              }}
              className="mt-1 w-fit"
            >
              Reset Demo Desk to $500.00
            </Button>
          </div>
          <label className="text-sm">
            Type RESET to restore the $500 opening book
            <input className="field mt-2" value={phrase} onChange={(e) => setPhrase(e.target.value)} aria-label="Type RESET to confirm" />
          </label>
          <Button
            variant="danger"
            disabled={phrase !== "RESET"}
            onClick={() => {
              restore();
              setPhrase("");
            }}
          >
            Restore opening balance
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="mt-4 flex flex-col gap-2 text-sm">
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="font-mono text-brass">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
