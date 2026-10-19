import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useDesk } from "@/lib/desk-store";
import { useDyorStore } from "@/lib/dyor/store";
import { useFeedHealth } from "@/lib/feeds/status";
import { toCsv, downloadText } from "@/lib/csv";
import { WorkspacePanel } from "@/components/terminal/panel";

export function IntegrationsPanel() {
  const mode = useDesk((s) => s.mode);
  const liveStatus = useDesk((s) => s.liveStatus);
  const executions = useDesk((s) => s.executions);
  const ledger = useDesk((s) => s.tradingLedger);
  const profiles = useDyorStore((s) => s.connectedProfiles);
  const telegramCreds = useDyorStore((s) => s.telegramCreds);
  const discordWebhook = useDyorStore((s) => s.discordWebhook);
  const rows = useFeedHealth((s) => s.rows);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const telegramOn = profiles.some((p) => p.provider === "TELEGRAM" && p.verified);
  const discordOn = profiles.some((p) => p.provider === "DISCORD" && p.verified);
  const endpoint = typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/tradingview` : "/api/webhooks/tradingview";

  const testAlerts = async () => {
    const text = `Monroe test alert — ${new Date().toLocaleTimeString()}`;
    const results: string[] = [];
    try {
      const mod = await import("@/lib/integrations.functions");
      const tg = telegramCreds();
      if (tg) {
        const r = await mod.sendTelegramAlert({ data: { ...tg, text } });
        results.push(`Telegram: ${r.ok ? "sent" : r.note}`);
      }
      const dc = discordWebhook();
      if (dc) {
        const r = await mod.sendDiscordAlert({ data: { url: dc, text } });
        results.push(`Discord: ${r.ok ? "sent" : r.note}`);
      }
    } catch (error) {
      results.push(error instanceof Error ? error.message : "send failed");
    }
    setNote(results.length ? results.join(" · ") : "No alert channels connected — add Telegram or Discord in the vault.");
  };

  const copyEndpoint = () => {
    void navigator.clipboard?.writeText(endpoint).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined,
    );
  };

  const exportFills = () => {
    const csv = toCsv([
      ["time", "side", "symbol", "venue", "price", "qty", "notional", "slippage_bps", "type", "note"],
      ...executions.map((e) => [
        new Date(e.ts).toISOString(),
        e.side,
        e.symbol,
        e.venue,
        e.price,
        e.qty,
        e.notional,
        e.slippageBps,
        e.type,
        e.note,
      ]),
    ]);
    downloadText(`monroe-fills-${Date.now()}.csv`, csv);
    setNote(`Exported ${executions.length} fills.`);
  };

  const exportLedger = () => {
    const csv = toCsv([
      ["time", "symbol", "side", "qty", "price_usd", "fee_usd", "notional_usd", "engine"],
      ...ledger.fills.map((f) => [
        new Date(f.filledAt).toISOString(),
        f.symbol,
        f.side,
        f.qty,
        f.priceUsd,
        f.feeUsd,
        f.notionalUsd,
        f.engine,
      ]),
    ]);
    downloadText(`monroe-ledger-${Date.now()}.csv`, csv);
    setNote(`Exported ${ledger.fills.length} ledger fills.`);
  };

  return (
    <WorkspacePanel
      title="Integrations"
      hint={<span className="font-mono text-[10px] uppercase">{mode}</span>}
      bodyClassName="flex flex-col gap-3 overflow-y-auto p-3"
    >
      <Section title="Live execution">
        {liveStatus ? (
          <div className="space-y-1 font-mono text-[10px]">
            <Line label="Venue" value={liveStatus.venueLabel} />
            <Line label="Armed" value={liveStatus.configured ? "yes" : "no"} tone={liveStatus.configured ? "gain" : undefined} />
            <Line label="Max notional" value={`$${liveStatus.caps.maxNotionalUsd}`} />
            <Line label="Daily loss stop" value={`$${liveStatus.caps.dailyLossLimitUsd}`} />
            <Line label="Max positions" value={String(liveStatus.caps.maxOpenPositions)} />
            {!liveStatus.configured && liveStatus.note ? (
              <p className="pt-1 leading-relaxed text-faint">{liveStatus.note}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-[10px] leading-relaxed text-faint">
            Live status not loaded. Credentials are set on the server; the desk stays inert until they are.
          </p>
        )}
      </Section>

      <Section title="Alert routing">
        <div className="space-y-1 font-mono text-[10px]">
          <Line label="Telegram" value={telegramOn ? "connected" : "off"} tone={telegramOn ? "gain" : undefined} />
          <Line label="Discord" value={discordOn ? "connected" : "off"} tone={discordOn ? "gain" : undefined} />
        </div>
        <button
          type="button"
          onClick={() => void testAlerts()}
          className="mt-2 h-7 rounded border border-line bg-panel-2 px-3 text-[10px] font-semibold tracking-wider text-faint uppercase transition-colors hover:text-cream"
        >
          Send test alert
        </button>
      </Section>

      <Section title="Webhook intake">
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded border border-line/70 bg-panel-2/50 px-2 py-1 font-mono text-[10px] text-cream/90">
            {endpoint}
          </code>
          <button
            type="button"
            onClick={copyEndpoint}
            className="h-7 shrink-0 rounded border border-line bg-panel-2 px-2 text-[10px] tracking-wider text-faint uppercase hover:text-cream"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-faint">
          POST JSON or plain text (“BUY BTCUSDT @ 64000”). Normalized signals return immediately; the desk stays in control of execution.
        </p>
      </Section>

      <Section title="Data feeds">
        {rows.length ? (
          <div className="space-y-1 font-mono text-[10px]">
            {rows.map((r) => (
              <Line
                key={r.id}
                label={r.label}
                value={r.state}
                tone={r.state === "live" ? "gain" : r.state === "down" ? "loss" : undefined}
              />
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-faint">Feeds report once the desk starts polling.</p>
        )}
      </Section>

      <Section title="Exports">
        <div className="flex gap-2">
          <ExportButton label={`Fills (${executions.length})`} onClick={exportFills} />
          <ExportButton label={`Ledger (${ledger.fills.length})`} onClick={exportLedger} />
        </div>
      </Section>

      {note ? <p className="rounded border border-line/60 bg-panel-2/40 p-2 text-[10px] leading-relaxed text-faint">{note}</p> : null}
    </WorkspacePanel>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded border border-line/70 bg-panel-2/30 p-2">
      <span className="mb-1.5 block text-[10px] tracking-wider text-faint uppercase">{title}</span>
      {children}
    </div>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: "gain" | "loss" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-faint">{label}</span>
      <span className={cn("text-cream/85", tone === "gain" && "text-gain", tone === "loss" && "text-loss")}>{value}</span>
    </div>
  );
}

function ExportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-7 flex-1 rounded border border-line bg-panel-2 px-2 text-[10px] font-semibold tracking-wider text-faint uppercase transition-colors hover:text-cream"
    >
      {label}
    </button>
  );
}
