import { useEffect, useState } from "react";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import { useDesk } from "@/lib/desk-store";
import { usePriceHistory } from "@/lib/price-history";
import { MAX_PRESET_INDEX, useWorkspace } from "@/lib/workspace-store";
import { Watchlist } from "@/components/terminal/watchlist";
import { ChartPanel } from "@/components/terminal/chart-panel";
import { OrderTicket } from "@/components/terminal/order-ticket";
import { PositionsPanel } from "@/components/terminal/positions-panel";
import { Blotter } from "@/components/terminal/blotter";
import { IntegrationsPanel } from "@/components/terminal/integrations-panel";

const HEIGHT = "h-[calc(100dvh-10.5rem)] min-h-[560px]";

export function Terminal() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const tape = useDesk((s) => s.tape);
  const refreshTape = useDesk((s) => s.refreshTape);
  const record = usePriceHistory((s) => s.record);
  const symbolId = useWorkspace((s) => s.symbolId);
  const setSymbol = useWorkspace((s) => s.setSymbol);

  useEffect(() => {
    record(tape);
  }, [tape, record]);

  useEffect(() => {
    if (tape.length) return;
    let cancel = false;
    const load = () => {
      if (cancel) return;
      void refreshTape().catch(() => 0);
    };
    load();
    const timer = window.setInterval(() => {
      if (useDesk.getState().tape.length) {
        window.clearInterval(timer);
        return;
      }
      load();
    }, 15_000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [refreshTape, tape.length]);

  useEffect(() => {
    if (symbolId && tape.some((c) => c.id === symbolId)) return;
    if (!tape.length) return;
    const best = [...tape].sort((a, b) => b.score - a.score)[0];
    if (best) setSymbol(best.id);
  }, [symbolId, tape, setSymbol]);

  useHotkeys();
  const desktop = useIsDesktop();

  const horizontal = useDefaultLayout({ id: "monroe-terminal-h" });
  const vertical = useDefaultLayout({ id: "monroe-terminal-v" });

  if (!mounted) {
    return (
      <div className={`${HEIGHT} flex items-center justify-center text-[11px] text-faint`}>
        Opening workspace…
      </div>
    );
  }

  if (!desktop) {
    return (
      <div className="flex flex-col gap-3 pb-4">
        <div className="h-[280px]">
          <ChartPanel />
        </div>
        <div className="h-[360px]">
          <Watchlist />
        </div>
        <div>
          <OrderTicket />
        </div>
        <div className="h-[320px]">
          <PositionsPanel />
        </div>
        <div className="h-[300px]">
          <Blotter />
        </div>
        <div>
          <IntegrationsPanel />
        </div>
      </div>
    );
  }

  return (
    <div className={HEIGHT}>
      <Group
        orientation="horizontal"
        id="monroe-terminal-h"
        defaultLayout={horizontal.defaultLayout}
        onLayoutChanged={horizontal.onLayoutChanged}
        className="h-full gap-0"
      >
        <Panel id="watchlist" defaultSize="22%" minSize="14%" maxSize="38%" collapsible collapsedSize={0}>
          <Watchlist />
        </Panel>
        <Handle />
        <Panel id="center" minSize="34%">
          <Group
            orientation="vertical"
            id="monroe-terminal-v"
            defaultLayout={vertical.defaultLayout}
            onLayoutChanged={vertical.onLayoutChanged}
            className="h-full"
          >
            <Panel id="chart" defaultSize="60%" minSize="30%">
              <ChartPanel />
            </Panel>
            <Handle vertical />
            <Panel id="blotter" defaultSize="26%" minSize="14%" collapsible collapsedSize={0}>
              <Blotter />
            </Panel>
            <Handle vertical />
            <Panel id="integrations" defaultSize="22%" minSize="14%" collapsible collapsedSize={0}>
              <IntegrationsPanel />
            </Panel>
          </Group>
        </Panel>
        <Handle />
        <Panel id="side" defaultSize="27%" minSize="18%" maxSize="40%" collapsible collapsedSize={0}>
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-[1.1] border-b border-line">
              <OrderTicket />
            </div>
            <div className="min-h-0 flex-1">
              <PositionsPanel />
            </div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}

function Handle({ vertical }: { vertical?: boolean }) {
  return (
    <Separator
      className={
        vertical
          ? "h-px w-full bg-line transition-colors hover:bg-brass/70"
          : "w-px bg-line transition-colors hover:bg-brass/70"
      }
    />
  );
}

const PRESET_KEYS: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3, "5": MAX_PRESET_INDEX };

function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return desktop;
}

function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;

      const ws = useWorkspace.getState();
      const key = e.key;
      if (PRESET_KEYS[key] !== undefined) {
        ws.setSizePreset(PRESET_KEYS[key]);
        return;
      }
      switch (key.toLowerCase()) {
        case "b":
          ws.setSide("buy");
          break;
        case "s":
          ws.setSide("sell");
          break;
        case "m":
          ws.setSizePreset(MAX_PRESET_INDEX);
          break;
        case "d":
          ws.toggleDepth();
          break;
        case "l":
          ws.toggleBlotter();
          break;
        case "[":
        case "]": {
          const tape = useDesk.getState().tape;
          if (!tape.length) break;
          const idx = tape.findIndex((c) => c.id === useWorkspace.getState().symbolId);
          const dir = key === "]" ? 1 : -1;
          const next = tape[(idx + dir + tape.length) % tape.length];
          if (next) useWorkspace.getState().setSymbol(next.id);
          break;
        }
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
