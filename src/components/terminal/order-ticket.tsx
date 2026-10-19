import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { useDesk } from "@/lib/desk-store";
import { equity, exposure } from "@/lib/paper";
import { stakeBudgetFor } from "@/lib/sniper/tier-config";
import { money } from "@/lib/sniper/format";
import { MAX_PRESET_INDEX, SIZE_PRESETS, useWorkspace } from "@/lib/workspace-store";
import { Segmented, WorkspacePanel } from "@/components/terminal/panel";

const FEE_RATE = 0.003;

export function OrderTicket() {
  const tape = useDesk((s) => s.tape);
  const mode = useDesk((s) => s.mode);
  const demo = useDesk((s) => s.demo);
  const live = useDesk((s) => s.live);
  const manualEnter = useDesk((s) => s.manualEnter);
  const flatten = useDesk((s) => s.flatten);
  const [result, setResult] = useState<string | null>(null);

  const symbolId = useWorkspace((s) => s.symbolId);
  const side = useWorkspace((s) => s.side);
  const setSide = useWorkspace((s) => s.setSide);
  const sizePreset = useWorkspace((s) => s.sizePreset);
  const setSizePreset = useWorkspace((s) => s.setSizePreset);

  const candidate = useMemo(() => tape.find((c) => c.id === symbolId) ?? null, [tape, symbolId]);
  const book = mode === "live" ? live : demo;
  const eq = equity(book);
  const locked = exposure(book);
  const budget = stakeBudgetFor(eq).budget;
  const available = Math.max(0, budget - locked);

  const notional = sizePreset === MAX_PRESET_INDEX
    ? available
    : Math.min(SIZE_PRESETS[sizePreset] ?? SIZE_PRESETS[0], available);

  const position = useMemo(
    () => (candidate ? book.positions.find((p) => p.symbol === candidate.symbol) ?? null : null),
    [book.positions, candidate],
  );

  const fee = notional * FEE_RATE;
  const pctEq = eq > 0 ? (notional / eq) * 100 : 0;
  const canBuy = Boolean(candidate) && notional > 0;
  const canSell = Boolean(position);

  const submit = () => {
    if (!candidate) return;
    if (side === "sell") {
      if (!position) {
        setResult("No open position on this symbol to flatten.");
        return;
      }
      flatten(position.id);
      setResult(`Flattened ${position.symbol} at market.`);
      return;
    }
    const res = manualEnter(candidate, { notionalUsd: notional });
    setResult(res.note);
  };

  return (
    <WorkspacePanel
      title="Order Ticket"
      hint={<span className="font-mono text-[10px] uppercase">{mode}</span>}
      actions={<span className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-faint uppercase">Market</span>}
      bodyClassName="flex flex-col gap-3 p-3"
    >
      <Segmented
        className="w-full [&>button]:flex-1 [&>button]:py-1.5 [&>button]:text-xs"
        size="md"
        value={side}
        onChange={setSide}
        options={[
          { value: "buy" as const, label: "Buy / Long", tone: "gain" as const },
          { value: "sell" as const, label: "Sell / Flatten", tone: "loss" as const },
        ]}
      />

      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-wider text-faint uppercase">Symbol</span>
        <span className="font-mono text-xs font-medium text-cream">{candidate?.symbol ?? "—"}</span>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] tracking-wider text-faint uppercase">Size</span>
          <span className="font-mono text-[10px] text-faint">{pctEq.toFixed(1)}% of equity</span>
        </div>
        <Segmented
          className="w-full [&>button]:flex-1"
          value={sizePreset}
          onChange={setSizePreset}
          options={[
            ...SIZE_PRESETS.map((v, i) => ({ value: i, label: `$${v}` })),
            { value: MAX_PRESET_INDEX, label: "MAX", title: `Available ${money(available)}` },
          ]}
        />
      </div>

      <div className="space-y-1 rounded border border-line/70 bg-panel-2/50 p-2 font-mono text-[10px]">
        <Row label="Notional" value={money(notional)} strong />
        <Row label="Est. fee (30 bps)" value={money(fee)} />
        <Row label="Available" value={money(available)} />
        {position ? (
          <>
            <Row label="Open qty" value={position.qty.toFixed(4)} />
            <Row
              label="Unrealised"
              value={`${position.mark >= position.entryPrice ? "+" : ""}${money((position.mark - position.entryPrice) * position.qty)}`}
              tone={position.mark >= position.entryPrice ? "gain" : "loss"}
            />
          </>
        ) : null}
      </div>

      <button
        type="button"
        disabled={side === "buy" ? !canBuy : !canSell}
        onClick={submit}
        className={cn(
          "h-10 rounded font-semibold tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40",
          side === "buy"
            ? "bg-gain/20 text-gain hover:bg-gain/30"
            : "bg-loss/20 text-loss hover:bg-loss/30",
        )}
      >
        {side === "buy" ? `BUY ${candidate?.symbol ?? ""}` : `FLATTEN ${position?.symbol ?? ""}`}
      </button>

      {result ? (
        <p className="rounded border border-line/60 bg-panel-2/40 p-2 text-[10px] leading-relaxed text-faint">{result}</p>
      ) : (
        <p className="text-[10px] leading-relaxed text-faint/70">
          Sized by the risk engine; a manual size can never exceed the approved stake.
        </p>
      )}
    </WorkspacePanel>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "gain" | "loss" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-faint">{label}</span>
      <span className={cn(strong ? "text-cream" : "text-cream/80", tone === "gain" && "text-gain", tone === "loss" && "text-loss")}>
        {value}
      </span>
    </div>
  );
}
