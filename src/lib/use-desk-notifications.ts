import { useEffect } from "react";
import { useDesk } from "@/lib/desk-store";
import { useSniper } from "@/lib/sniper/store";
import { useFeedHealth } from "@/lib/feeds/status";
import { useNotifications } from "@/lib/notifications";
import { equity } from "@/lib/paper";

const DOWN_DRAWDOWN = 0.08;

/**
 * Watches the desk + sniper stores and raises platform notifications on the
 * transitions that matter to an operator: entries, closes, turbo, drawdown,
 * feed outages and learning-DB degradation. Read-only: never mutates stores.
 */
export function useDeskNotifications() {
  useEffect(() => {
    const seenPositions = new Set<string>();
    const seenTrades = new Set<string>();
    let ready = false;
    let power = false;
    let turbo = "off";
    let dbOk = true;
    let drawdownAlerted = false;
    const downFeeds = new Set<string>();

    const fire = useNotifications.getState().notify;

    const evaluate = () => {
      const desk = useDesk.getState();
      const book = desk.mode === "live" ? desk.live : desk.demo;

      const posIds = new Set(book.positions.map((p) => p.id));
      const tradeIds = new Set(book.trades.map((t) => t.id));

      const feeds = useFeedHealth.getState().rows;

      if (!ready) {
        ready = true;
        book.positions.forEach((p) => seenPositions.add(p.id));
        book.trades.forEach((t) => seenTrades.add(t.id));
        power = desk.power;
        turbo = desk.turboPhase;
        dbOk = desk.dbOk;
        feeds.forEach((f) => {
          if (f.state === "down") downFeeds.add(f.id);
        });
        return;
      }

      book.positions.forEach((p) => {
        if (!seenPositions.has(p.id)) {
          seenPositions.add(p.id);
          fire({
            severity: "success",
            title: `Entry · ${p.symbol}`,
            body: `${p.notional.toFixed(2)} USD notional${p.venue ? ` · ${p.venue}` : ""} · stop ${p.stop.toFixed(4)}`,
            tag: `entry:${p.id}`,
          });
        }
      });

      book.trades.forEach((t) => {
        if (!seenTrades.has(t.id)) {
          seenTrades.add(t.id);
          const win = t.pnl >= 0;
          fire({
            severity: win ? "success" : "danger",
            title: `${win ? "Win" : "Loss"} · ${t.symbol}`,
            body: `${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)} USD · ${t.reason.toLowerCase()}`,
            tag: `close:${t.id}`,
          });
        }
      });

      if (desk.power !== power) {
        power = desk.power;
        fire(
          power
            ? { severity: "success", title: "Sniper armed", body: "Engine is scanning and may open demo positions." }
            : { severity: "info", title: "Sniper on standby", body: "Engine paused; open positions still ride to exits." },
        );
      }

      if (desk.turboPhase !== turbo) {
        turbo = desk.turboPhase;
        if (turbo === "running") {
          fire({ severity: "warn", title: "Turbo engaged", body: "34-minute max-aggression run. Safety gates stay armed." });
        } else if (turbo === "cooling") {
          fire({ severity: "info", title: "Turbo cooling", body: "New entries halted during the cooldown." });
        }
      }

      if (desk.dbOk !== dbOk) {
        dbOk = desk.dbOk;
        fire(
          dbOk
            ? { severity: "success", title: "Learning DB online", body: `Durable store: ${desk.dbSource}` }
            : { severity: "warn", title: "Learning DB degraded", body: "Trades keep learning locally until the link recovers." },
        );
      }

      feeds.forEach((f) => {
        if (f.state === "down" && !downFeeds.has(f.id)) {
          downFeeds.add(f.id);
          fire({ severity: "warn", title: `${f.label} feed down`, body: f.detail, tag: `feed:${f.id}` });
        } else if (f.state !== "down" && downFeeds.has(f.id)) {
          downFeeds.delete(f.id);
          fire({ severity: "success", title: `${f.label} feed recovered`, body: f.detail, tag: `feedup:${f.id}` });
        }
      });

      const eq = equity(book);
      const openEquity = eq - book.dayPnl;
      const drawdown = openEquity > 0 ? book.dayPnl / openEquity : 0;
      if (drawdown <= -DOWN_DRAWDOWN && !drawdownAlerted) {
        drawdownAlerted = true;
        fire({
          severity: "danger",
          title: "Daily drawdown alert",
          body: `Session P&L at ${(drawdown * 100).toFixed(1)}% of the day-open book.`,
        });
      } else if (drawdown > -DOWN_DRAWDOWN / 2) {
        drawdownAlerted = false;
      }
    };

    evaluate();
    const un1 = useDesk.subscribe(evaluate);
    const un2 = useSniper.subscribe(evaluate);
    const un3 = useFeedHealth.subscribe(evaluate);
    return () => {
      un1();
      un2();
      un3();
    };
  }, []);
}
