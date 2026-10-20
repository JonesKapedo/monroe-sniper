import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { useDesk } from "@/lib/desk-store";
import { equity, exposure } from "@/lib/paper";
import { stakeBudgetFor } from "@/lib/sniper/tier-config";
import { money } from "@/lib/sniper/format";
import {
  MAX_PRESET_INDEX,
  SIZE_PRESETS,
  useWorkspace,
  type OrderType,
} from "@/lib/workspace-store";
import { Segmented, WorkspacePanel } from "@/components/terminal/panel";

const FEE_RATE = 0.003;

export function OrderTicket() {
  const tape = useDesk((s) => s.tape);
  const mode = useDesk((s) => s.mode);
  const demo = useDesk((s) => s.demo);
  const live = useDesk((s) => s.live);
  const manualEnter = useDesk((s) => s.manualEnter);
  const flatten = useDesk((s) => s.flatten);
  const placeWorkingOrder = useDesk((s) => s.placeWorkingOrder);
  const cancelWorkingOrder = useDesk((s) => s.cancelWorkingOrder);
  const workingOrders = useDesk((s) => s.workingOrders);
  const addAlert = useDesk((s) => s.addAlert);
  const removeAlert = useDesk((s) => s.removeAlert);
  const alerts = useDesk((s) => s.alerts);
  const [result, setResult] = useState<string | null>(null);
  const [alertPrice, setAlertPrice] = useState("");

  const symbolId = useWorkspace((s) => s.symbolId);
  const side = useWorkspace((s) => s.side);
  const setSide = useWorkspace((s) => s.setSide);
  const orderType = useWorkspace((s) => s.orderType);
  const setOrderType = useWorkspace((s) => s.setOrderType);
  const sizePreset = useWorkspace((s) => s.sizePreset);
  const setSizePreset = useWorkspace((s) => s.setSizePreset);
  const limit = useWorkspace((s) => s.limit);
  const stop = useWorkspace((s) => s.stop);
  const target = useWorkspace((s) => s.target);
  const tif = useWorkspace((s) => s.tif);
  const setLimit = useWorkspace((s) => s.setLimit);
  const setStop = useWorkspace((s) => s.setStop);
  const setTarget = useWorkspace((s) => s.setTarget);
  const setTif = useWorkspace((s) => s.setTif);

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

  const mark = candidate?.priceUsd ?? 0;
  const triggerRaw = orderType === "limit" ? limit : orderType === "stop" ? stop : "";
  const trigger = Number.parseFloat(triggerRaw);
  const stopNum = Number.parseFloat(stop);
  const targetNum = Number.parseFloat(target);
  const entry = orderType === "market" ? mark : Number.isFinite(trigger) ? trigger : mark;

  const fee = notional * FEE_RATE;
  const pctEq = eq > 0 ? (notional / eq) * 100 : 0;
  const rr = useMemo(() => {
    if (!Number.isFinite(entry) || entry <= 0) return null;
    const risk = Number.isFinite(stopNum) ? Math.abs(entry - stopNum) : 0;
    const reward = Number.isFinite(targetNum) ? Math.abs(targetNum - entry) : 0;
    if (risk <= 0 || reward <= 0) return null;
    return reward / risk;
  }, [entry, stopNum, targetNum]);

  const needTrigger = orderType !== "market";
  const triggerOk = !needTrigger || (Number.isFinite(trigger) && trigger > 0);
  const canBuy = Boolean(candidate) && notional > 0 && triggerOk;
  const canSell = Boolean(position);
  const myOrders = useMemo(
    () => workingOrders.filter((o) => o.status === "WORKING" && (o.symbol === candidate?.symbol || !candidate)),
    [workingOrders, candidate],
  );
  const myAlerts = useMemo(
    () => alerts.filter((a) => !a.fired && (a.tokenId === symbolId || !symbolId)),
    [alerts, symbolId],
  );

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
    const sl = Number.isFinite(stopNum) ? stopNum : undefined;
    const tp = Number.isFinite(targetNum) ? targetNum : undefined;
    if (orderType === "market") {
      const res = manualEnter(candidate, { notionalUsd: notional, stop: sl, target: tp });
      setResult(res.note);
      return;
    }
    const res = placeWorkingOrder({
      tokenId: candidate.id,
      symbol: candidate.symbol,
      side: "buy",
      type: orderType,
      notionalUsd: notional,
      trigger,
      stop: orderType === "limit" ? sl : undefined,
      target: tp,
      tif,
    });
    setResult(res.note);
  };

  const setAlert = () => {
    if (!candidate) return;
    const p = Number.parseFloat(alertPrice);
    if (!Number.isFinite(p) || p <= 0) {
      setResult("Enter a valid alert price.");
      return;
    }
    const res = p >= mark
      ? addAlert({ tokenId: candidate.id, symbol: candidate.symbol, above: p })
      : addAlert({ tokenId: candidate.id, symbol: candidate.symbol, below: p });
    setResult(res.note);
    setAlertPrice("");
  };

  const typeLabel = orderType === "market" ? "Market" : orderType === "limit" ? "Limit" : "Stop";

  return (
    <WorkspacePanel
      title="Order Ticket"
      hint={<span className="font-mono text-[10px] uppercase">{mode}</span>}
      actions={<span className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-faint uppercase">{typeLabel}</span>}
      bodyClassName="flex flex-col gap-3 overflow-y-auto p-3"
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

      <Segmented
        className="w-full [&>button]:flex-1"
        value={orderType}
        onChange={(v) => setOrderType(v as OrderType)}
        options={[
          { value: "market" as const, label: "Market" },
          { value: "limit" as const, label: "Limit" },
          { value: "stop" as const, label: "Stop" },
        ]}
      />

      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-wider text-faint uppercase">Symbol</span>
        <span className="flex items-baseline gap-2 font-mono text-xs font-medium text-cream">
          {candidate?.symbol ?? "—"}
          {mark > 0 ? <span className="text-[10px] text-faint">${mark.toFixed(4)}</span> : null}
        </span>
      </div>

      {side === "buy" && orderType === "limit" ? (
        <Field label="Limit price" value={limit} onChange={setLimit} placeholder={mark > 0 ? mark.toFixed(4) : "0.00"} />
      ) : null}
      {side === "buy" && orderType === "stop" ? (
        <Field label="Stop trigger" value={stop} onChange={setStop} placeholder={mark > 0 ? mark.toFixed(4) : "0.00"} />
      ) : null}
      {side === "buy" && orderType === "market" ? (
        <Field label="Stop-loss (opt.)" value={stop} onChange={setStop} placeholder="—" />
      ) : null}
      {side === "buy" && orderType === "limit" ? (
        <Field label="Stop-loss (opt.)" value={stop} onChange={setStop} placeholder="—" />
      ) : null}
      {side === "buy" && orderType !== "market" ? (
        <Field label="Take-profit (opt.)" value={target} onChange={setTarget} placeholder="—" />
      ) : null}

      {side === "buy" && orderType !== "market" ? (
        <div>
          <span className="mb-1 block text-[10px] tracking-wider text-faint uppercase">Time in force</span>
          <Segmented
            className="w-full [&>button]:flex-1"
            value={tif}
            onChange={(v) => setTif(v)}
            options={[
              { value: "GTC" as const, label: "GTC" },
              { value: "IOC" as const, label: "IOC" },
              { value: "FOK" as const, label: "FOK" },
            ]}
          />
        </div>
      ) : null}

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
        {rr !== null ? <Row label="Reward : risk" value={`${rr.toFixed(2)} : 1`} tone={rr >= 2 ? "gain" : undefined} /> : null}
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
        {side === "buy"
          ? `${orderType === "market" ? "BUY" : orderType === "limit" ? "LIMIT BUY" : "STOP BUY"} ${candidate?.symbol ?? ""}`
          : `FLATTEN ${position?.symbol ?? ""}`}
      </button>

      <div className="flex items-center gap-2">
        <input
          value={alertPrice}
          onChange={(e) => setAlertPrice(e.target.value)}
          inputMode="decimal"
          placeholder="Alert price"
          className="h-8 flex-1 rounded border border-line bg-panel-2 px-2 font-mono text-[11px] text-cream placeholder:text-faint/60 focus:border-brass/60 focus:outline-none"
        />
        <button
          type="button"
          disabled={!candidate}
          onClick={setAlert}
          className="h-8 rounded border border-line bg-panel-2 px-3 text-[10px] font-semibold tracking-wider text-faint uppercase hover:text-cream disabled:opacity-40"
        >
          Alert
        </button>
      </div>

      {myOrders.length ? (
        <div className="space-y-1">
          <span className="text-[10px] tracking-wider text-faint uppercase">Working</span>
          {myOrders.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded border border-line/70 bg-panel-2/40 px-2 py-1 font-mono text-[10px]">
              <span className="text-cream/90">
                {o.type.toUpperCase()} {o.side} {o.symbol} @ ${o.trigger}
                <span className="text-faint"> · {o.tif}</span>
              </span>
              <button type="button" onClick={() => cancelWorkingOrder(o.id)} className="text-loss hover:underline">
                cancel
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {myAlerts.length ? (
        <div className="space-y-1">
          <span className="text-[10px] tracking-wider text-faint uppercase">Alerts</span>
          {myAlerts.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded border border-line/70 bg-panel-2/40 px-2 py-1 font-mono text-[10px]">
              <span className="text-cream/90">
                {a.symbol} {a.above !== undefined ? "≥" : "≤"} ${a.above ?? a.below}
              </span>
              <button type="button" onClick={() => removeAlert(a.id)} className="text-faint hover:text-cream">
                remove
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {result ? (
        <p className="rounded border border-line/60 bg-panel-2/40 p-2 text-[10px] leading-relaxed text-faint">{result}</p>
      ) : (
        <p className="text-[10px] leading-relaxed text-faint/70">
          Market orders fill at mark; limit/stop orders rest in the book and fill when the tape crosses. Risk engine caps every size.
        </p>
      )}
    </WorkspacePanel>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] tracking-wider text-faint uppercase">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder={placeholder}
        className="h-8 w-full rounded border border-line bg-panel-2 px-2 font-mono text-[11px] text-cream placeholder:text-faint/60 focus:border-brass/60 focus:outline-none"
      />
    </label>
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
