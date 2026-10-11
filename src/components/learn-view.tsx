import { useEffect, useState, type ComponentType } from "react";
import { pct } from "@/lib/sniper/format";
import { WEIGHT_LABELS } from "@/lib/sniper/model";
import { useSniper } from "@/lib/sniper/store";
import type { HitPoint } from "@/lib/sniper/types";
import { Button, Card, Label } from "@/components/ui";

export function LearnView() {
  const model = useSniper((s) => s.book.model);
  const reset = useSniper((s) => s.resetLearning);
  const Chart = useHitChart();
  const rate = model.samples ? model.correct / model.samples : 0;
  const rolling = model.recent.length ? model.recent.filter(Boolean).length / model.recent.length : 0;
  const maxAbs = Math.max(0.2, ...model.weights.map((w) => Math.abs(w)));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium md:text-3xl">Learning</h1>
          <p className="mt-1 max-w-2xl text-sm text-faint">
            After every close the model takes one gradient step. A regime shift speeds that step for a while. It can get sharper. It can also be wrong.
          </p>
        </div>
        <Button variant="ghost" onClick={() => reset()}>
          Reset weights
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card>
          <Label>Closes learned</Label>
          <p className="mt-2 font-mono text-2xl">{model.samples}</p>
        </Card>
        <Card>
          <Label>All-time direction</Label>
          <p className="mt-2 font-mono text-2xl">{model.samples ? pct(rate) : "—"}</p>
        </Card>
        <Card className="col-span-2 lg:col-span-1">
          <Label>Last 40</Label>
          <p className="mt-2 font-mono text-2xl">{model.recent.length ? pct(rolling) : "—"}</p>
        </Card>
      </div>
      <Card>
        <Label>Rolling hit rate</Label>
        {Chart && model.hits.length > 1 ? (
          <Chart data={model.hits} />
        ) : (
          <p className="flex h-52 items-center text-sm text-faint">The curve starts after a handful of closes.</p>
        )}
      </Card>
      <Card>
        <Label>Weights</Label>
        <ul className="mt-4 flex flex-col gap-3">
          {WEIGHT_LABELS.map((label, i) => {
            const weight = model.weights[i] ?? 0;
            const width = `${Math.round((Math.abs(weight) / maxAbs) * 100)}%`;
            return (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 text-xs text-faint">{label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-panel-2">
                  <span className="block h-full rounded-full bg-brass" style={{ width }} />
                </span>
                <span className="w-12 text-right font-mono text-xs">{weight.toFixed(2)}</span>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card>
        <Label>Journal</Label>
        <ul className="mt-3 flex flex-col gap-3">
          {model.notes.map((note) => (
            <li key={`${note.m}-${note.text}`} className="text-sm">
              <span className="font-mono text-xs text-faint">m{note.m}</span>
              <p>{note.text}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function useHitChart() {
  const [Chart, setChart] = useState<ComponentType<{ data: HitPoint[] }> | null>(null);
  useEffect(() => {
    let live = true;
    void import("@/components/equity-chart").then((mod) => {
      if (live) setChart(() => mod.HitChart);
    });
    return () => {
      live = false;
    };
  }, []);
  return Chart;
}
