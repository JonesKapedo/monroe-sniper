import { useState } from "react";
import { money, pct } from "@/lib/sniper/format";
import { kellyFraction } from "@/lib/sniper/risk";
import { useSniper } from "@/lib/sniper/store";
import { SOURCE_META, type SourceId } from "@/lib/sniper/types";
import { Button, Card, Label } from "@/components/ui";
import { cn } from "@/lib/cn";

export function SettingsView() {
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
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium md:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-faint">
          These knobs change the next minute, not the past tape. Tighter confidence means fewer, pickier fills.
        </p>
      </div>

      <Card>
        <Label>Execution</Label>
        <Slider label="Minimum confidence" value={settings.minConfidence} min={0.35} max={0.9} step={0.01} format={(v) => pct(v)} onChange={(v) => update({ minConfidence: v })} />
        <Slider label="Minutes before a time stop" value={settings.timeStop} min={8} max={120} step={1} format={(v) => `${Math.round(v)} min`} onChange={(v) => update({ timeStop: v })} />
        <Slider label="Seconds per market minute" value={settings.scanSeconds} min={1} max={20} step={1} format={(v) => `${Math.round(v)}s`} onChange={(v) => update({ scanSeconds: v })} />
        <div className="mt-4">
          <Button variant="ghost" onClick={() => runTicks(30)}>
            Advance 30 minutes
          </Button>
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
          <label className="text-sm">
            Type RESET to restore the $25,000 opening book
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
