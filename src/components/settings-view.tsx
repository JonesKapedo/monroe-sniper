import { useState } from "react";
import { money, pct } from "@/lib/sniper/format";
import { isSoundEnabled, playHawkCry, setSoundEnabled } from "@/lib/sound";
import { kellyFraction } from "@/lib/sniper/risk";
import { useSniper } from "@/lib/sniper/store";
import { defaultSettings, SOURCE_META, type SourceId, type ThemeId } from "@/lib/sniper/types";
import { useDesk } from "@/lib/desk-store";
import { Button, Card, Label } from "@/components/ui";
import { cn } from "@/lib/cn";

const THEMES: { id: ThemeId; label: string; detail: string }[] = [
  { id: "MONROE", label: "Monroe", detail: "Olive & brass" },
  { id: "PAPER", label: "Paper", detail: "Warm light" },
  { id: "MIDNIGHT", label: "Pitch Black", detail: "True black backgrounds" },
];

export function SettingsView() {
  const resetDemo = useDesk((s) => s.resetDemo);
  const riskSettings = useDesk((s) => s.riskSettings);
  const updateRiskSettings = useDesk((s) => s.updateRiskSettings);
  const setSelectedModel = useDesk((s) => s.setSelectedModel);
  const selectedModel = useDesk((s) => s.selectedModel);
  const startTurbo = useDesk((s) => s.startTurbo);
  const stopTurbo = useDesk((s) => s.stopTurbo);
  const turboPhase = useDesk((s) => s.turboPhase);
  const turboRunMinutes = useDesk((s) => s.turboRunMinutes);
  const turboCooldownMinutes = useDesk((s) => s.turboCooldownMinutes);
  const setTurboRunMinutes = useDesk((s) => s.setTurboRunMinutes);
  const setTurboCooldownMinutes = useDesk((s) => s.setTurboCooldownMinutes);
  const entrySources = useDesk((s) => s.entrySources);
  const setEntrySource = useDesk((s) => s.setEntrySource);
  const equityGuardConfig = useDesk((s) => s.equityGuardConfig);
  const updateEquityGuardConfig = useDesk((s) => s.updateEquityGuardConfig);
  const equityGuardHalted = useDesk((s) => s.equityGuardState.isHalted);
  const manualHalt = useDesk((s) => s.manualHalt);
  const manualResume = useDesk((s) => s.manualResume);
  const engineCycle = useDesk((s) => s.engineCycle);
  const setEngineCycle = useDesk((s) => s.setEngineCycle);
  const whaleSettings = useDesk((s) => s.whaleSettings);
  const updateWhaleSettings = useDesk((s) => s.updateWhaleSettings);
  const profitLockConfig = useDesk((s) => s.profitLockConfig);
  const updateProfitLockConfig = useDesk((s) => s.updateProfitLockConfig);
  const readinessTargets = useDesk((s) => s.readinessTargets);
  const setReadinessTargets = useDesk((s) => s.setReadinessTargets);
  const disciplineRules = useDesk((s) => s.disciplineRules);
  const updateDisciplineRules = useDesk((s) => s.updateDisciplineRules);
  const deskMode = useDesk((s) => s.mode);
  const deskBook = useDesk((s) => s[s.mode]);
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());

  const book = useSniper((s) => s.book);
  const update = useSniper((s) => s.updateSettings);
  const setSource = useSniper((s) => s.setSource);
  const runTicks = useSniper((s) => s.runTicks);
  const newSession = useSniper((s) => s.newSession);
  const restore = useSniper((s) => s.restoreOpeningBalance);
  const settings = book.settings;
  const appearance = settings.appearance ?? defaultSettings.appearance;
  const [phrase, setPhrase] = useState("");
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [purgeNote, setPurgeNote] = useState<string | null>(null);
  const kelly = kellyFraction(book.trades, settings.kellyCap);

  const runPurge = async () => {
    if (phrase !== "PURGE" || purgeBusy) return;
    if (
      !window.confirm(
        "Purge ALL learning history (persisted closes, readiness, adaptive thresholds)? Open positions and cash are kept. This cannot be undone.",
      )
    ) {
      return;
    }
    setPurgeBusy(true);
    setPurgeNote(null);
    try {
      const mod = await import("@/lib/trade-memory.functions");
      const res = await mod.purgeTradeLearning();
      useDesk.getState().purgeLearningHistory();
      await useDesk.getState().refreshDbStats();
      setPurgeNote(res.note);
      setPhrase("");
    } catch (error) {
      try {
        useDesk.getState().purgeLearningHistory();
      } catch {
        // best-effort
      }
      setPurgeNote(error instanceof Error ? error.message : "Purge failed — database link required.");
    } finally {
      setPurgeBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold md:text-3xl">Professional Trader Settings</h1>
          <span className="rounded-full bg-brass/20 px-2.5 py-0.5 text-xs font-semibold text-brass">
            EAT GMT(+3) Nairobi Desk
          </span>
        </div>
        <p className="mt-1 text-sm text-faint">
          Fine-tune the quantitative sniper engine, dynamic position sizing corridors, capital preservation circuits, and academic research safeguards.
        </p>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <Label>Quantitative Risk Engine & Position Sizing Profile</Label>
          <span className="text-xs text-brass font-medium">Outperformance Architecture</span>
        </div>
        <p className="mt-1 text-xs text-faint">
          Selects the dynamic compounding corridor. Sizes positions wisely based on current balance—never starved in micro $1 pennies, nor reckless with capital.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => { setSelectedModel("[paranoid]"); updateRiskSettings({ sizingProfile: "CONSERVATIVE", riskPerTrade: 0.015, maxIdeaExposure: 0.18, rewardMultiple: 2.5 }); }}
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
            onClick={() => { setSelectedModel("gradient"); updateRiskSettings({ sizingProfile: "OPTIMUM_SWEET_SPOT", riskPerTrade: 0.025, maxIdeaExposure: 0.28, rewardMultiple: 3.0 }); }}
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
            onClick={() => { setSelectedModel("[elvis]"); updateRiskSettings({ sizingProfile: "AGGRESSIVE", riskPerTrade: 0.035, maxIdeaExposure: 0.35, rewardMultiple: 3.5 }); }}
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

          <button
            type="button"
            onClick={() => startTurbo()}
            disabled={turboPhase === "cooling"}
            className={cn(
              "flex flex-col items-start rounded-xl border p-3 text-left transition-all relative",
              turboPhase !== "off"
                ? "border-loss bg-loss/10 text-loss ring-1 ring-loss/50"
                : "border-line bg-panel-2 text-faint hover:text-cream",
            )}
          >
            <span className="absolute -top-2 right-2 rounded bg-loss px-1.5 py-0.2 text-[10px] font-bold text-ink uppercase">
              {turboPhase === "running" ? "Running" : turboPhase === "cooling" ? "Cooling" : "27-min runs"}
            </span>
            <span className="font-bold text-sm">🔥 Turbo Gambler</span>
            <span className="text-xs mt-1">5% Risk · 45% Max Slot · 5 slots</span>
            <span className="text-[11px] text-faint mt-1">Max aggression · safety gates stay armed</span>
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
            label="Max Concurrent Open slots"
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

      {/* Rest of settings unchanged below — bot interoperability, capital, discipline, appearance, sound */}
      <Card>
        <div className="flex items-center justify-between">
          <Label>Bot Interoperability</Label>
          <span className="text-xs text-brass font-medium">
            {equityGuardHalted ? "Shared halt ACTIVE" : "All gates armed"}
          </span>
        </div>
        <p className="mt-1 text-xs text-faint">
          Each bot trades through the same risk engine, stake budget, and kill switch.
          Pausing a source stops its entries only — open positions still ride to exits. Manual entries always stay available.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {(
            [
              ["avenues", "Avenue bot", "Live Hyperliquid funding setups"],
              ["tape", "Tape sniper", "Scored candidates off the live tape"],
              ["whale", "Whale copy", "Followed wallets through the pre-copy gate"],
            ] as const
          ).map(([key, label, detail]) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel-2 p-3">
              <div>
                <p className="text-sm font-semibold text-cream">{label}</p>
                <p className="text-[11px] text-faint">{detail}</p>
              </div>
              <button
                type="button"
                aria-pressed={entrySources[key]}
                className={cn(
                  "min-h-11 rounded-full border px-3 text-sm",
                  entrySources[key] ? "border-brass text-brass" : "border-line text-faint",
                )}
                onClick={() => setEntrySource(key, !entrySources[key])}
              >
                {entrySources[key] ? "On" : "Paused"}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {equityGuardHalted ? (
            <Button variant="solid" onClick={() => manualResume()} className="font-semibold">
              Resume all bots
            </Button>
          ) : (
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm("Halt all new entries for 60 minutes? Open positions ride to exits.")) {
                  manualHalt("Operator global halt from Settings", 60);
                }
              }}
            >
              Halt all bots
            </Button>
          )}
          <span className="text-[11px] text-faint">Shared kill switch — one halt governs every bot.</span>
        </div>
        <div className="mt-4 border-t border-line/60 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-cream">Background engine cycle</p>
              <p className="text-[11px] text-faint">Market + whale refresh, guard checks, profit lock, DB persist — even on standby.</p>
            </div>
            <button
              type="button"
              aria-pressed={engineCycle.enabled}
              className={cn(
                "min-h-11 rounded-full border px-3 text-sm",
                engineCycle.enabled ? "border-brass text-brass" : "border-line text-faint",
              )}
              onClick={() => setEngineCycle({ enabled: !engineCycle.enabled })}
            >
              {engineCycle.enabled ? "On" : "Off"}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[5, 15, 30, 60].map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={engineCycle.minutes === m}
                onClick={() => setEngineCycle({ minutes: m })}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold",
                  engineCycle.minutes === m ? "bg-brass text-ink" : "bg-panel-2 text-faint hover:text-cream",
                )}
              >
                {m} min
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 border-t border-line/60 pt-3">
          <p className="text-sm font-semibold text-cream">Turbo schedule</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Slider label="Turbo run length" value={turboRunMinutes} min={5} max={120} step={1} format={(v) => `${Math.round(v)} min`} onChange={(v) => setTurboRunMinutes(v)} />
            <Slider label="Turbo cooldown" value={turboCooldownMinutes} min={2} max={60} step={1} format={(v) => `${Math.round(v)} min`} onChange={(v) => setTurboCooldownMinutes(v)} />
          </div>
          {turboPhase === "running" && (
            <Button variant="danger" onClick={() => stopTurbo()} className="mt-2 w-fit">
              Stop turbo now
            </Button>
          )}
        </div>
        <div className="mt-4 border-t border-line/60 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-cream">Whale copy</p>
              <p className="text-[11px] text-faint">Master switch plus the qualification floors from the pre-copy gate.</p>
            </div>
            <button
              type="button"
              aria-pressed={whaleSettings.enabled}
              className={cn(
                "min-h-11 rounded-full border px-3 text-sm",
                whaleSettings.enabled ? "border-brass text-brass" : "border-line text-faint",
              )}
              onClick={() => updateWhaleSettings({ enabled: !whaleSettings.enabled })}
            >
              {whaleSettings.enabled ? "On" : "Paused"}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Slider label="Min tracked moves" value={whaleSettings.minMoves} min={5} max={50} step={1} format={(v) => `${Math.round(v)}`} onChange={(v) => updateWhaleSettings({ minMoves: v })} />
            <Slider label="Min win rate" value={whaleSettings.minWinRate} min={50} max={80} step={1} format={(v) => `${Math.round(v)}%`} onChange={(v) => updateWhaleSettings({ minWinRate: v })} />
            <Slider label="Min confidence" value={whaleSettings.minConfidence} min={50} max={90} step={1} format={(v) => `${Math.round(v)}`} onChange={(v) => updateWhaleSettings({ minConfidence: v })} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-sm">
            <span>Block stablecoin entries</span>
            <button
              type="button"
              aria-pressed={riskSettings.blockStablecoins}
              className={cn("min-h-11 rounded-full border px-3", riskSettings.blockStablecoins ? "border-brass text-brass" : "border-line text-faint")}
              onClick={() => updateRiskSettings({ blockStablecoins: !riskSettings.blockStablecoins })}
            >
              {riskSettings.blockStablecoins ? "On" : "Off"}
            </button>
          </div>
          <Slider label="Re-entry cooldown" value={disciplineRules.reentryCooldownMinutes} min={5} max={120} step={5} format={(v) => `${Math.round(v)} min`} onChange={(v) => updateDisciplineRules({ reentryCooldownMinutes: v })} />
        </div>
      </Card>

      <Card>
        <Label>Appearance</Label>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => update({ appearance: { ...appearance, theme: t.id } })}
              className={cn(
                "rounded-xl border p-3 text-left",
                appearance.theme === t.id ? "border-brass bg-brass/10 text-brass" : "border-line bg-panel-2 text-faint",
              )}
            >
              <p className="text-sm font-semibold">{t.label}</p>
              <p className="text-[11px] text-faint">{t.detail}</p>
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Show mascot</p>
            <p className="text-xs text-faint">Desk companion</p>
          </div>
          <button
            type="button"
            aria-pressed={appearance.showMascot}
            className={cn(
              "min-h-11 rounded-full border px-3 text-sm",
              appearance.showMascot ? "border-brass text-brass" : "border-line text-faint",
            )}
            onClick={() => update({ appearance: { ...appearance, showMascot: !appearance.showMascot } })}
          >
            {appearance.showMascot ? "On" : "Off"}
          </button>
        </div>
      </Card>

      <Card>
        <Label>Sound</Label>
        <p className="mt-1 text-xs text-faint">
          A hawk cries when Live trading engages; a soft chirp answers the return to paper.
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Mode sounds</p>
            <p className="text-xs text-faint">Synthesized on-device, no audio files</p>
          </div>
          <button
            type="button"
            aria-pressed={soundOn}
            className={cn(
              "min-h-11 rounded-full border px-3 text-sm",
              soundOn ? "border-brass text-brass" : "border-line text-faint",
            )}
            onClick={() => {
              const next = !soundOn;
              setSoundEnabled(next);
              setSoundOn(next);
            }}
          >
            {soundOn ? "On" : "Off"}
          </button>
        </div>
        <div className="mt-2">
          <Button variant="ghost" onClick={() => playHawkCry()} className="text-xs">
            Preview hawk cry
          </Button>
        </div>
      </Card>

      <Card>
        <Label>Safety — purge learning</Label>
        <p className="mt-1 text-xs text-faint">Type PURGE to clear learning history. Open positions and cash stay.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="PURGE"
            className="min-h-11 rounded-lg border border-line bg-panel-2 px-3 font-mono text-sm"
          />
          <Button variant="danger" disabled={phrase !== "PURGE" || purgeBusy} onClick={() => void runPurge()}>
            {purgeBusy ? "Purging…" : "Purge learning"}
          </Button>
          <Button variant="ghost" onClick={() => resetDemo()}>
            Reset demo book
          </Button>
        </div>
        {purgeNote && <p className="mt-2 text-xs text-faint">{purgeNote}</p>}
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
