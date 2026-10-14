import { useEffect, useRef, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";

function format(value: number, kind: "delta" | "balance", decimals: number): string {
  const body = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (kind === "delta") return `${value < 0 ? "−" : "+"}$${body}`;
  return `$${body}`;
}

export type CapitalMood = "win" | "loss" | "flat";

/** Standing capital mood from the bot's day trend: blue flat, green win, red loss. */
export function capitalMood(dayPnl: number): CapitalMood {
  if (!Number.isFinite(dayPnl) || dayPnl === 0) return "flat";
  return dayPnl > 0 ? "win" : "loss";
}

export function capitalMoodClass(dayPnl: number): string {
  const mood = capitalMood(dayPnl);
  return mood === "win" ? "text-gain" : mood === "loss" ? "text-loss" : "text-sky-400";
}

/**
 * Money with a pulse: delta values carry sign color + trend icon, balances
 * flash on every move so a live book visibly breathes.
 */
export function Money({
  value,
  kind = "balance",
  decimals = 2,
  showTrend = true,
  className,
}: {
  value: number;
  kind?: "delta" | "balance";
  decimals?: number;
  showTrend?: boolean;
  className?: string;
}) {
  const prev = useRef(value);
  const [pulse, setPulse] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (value > prev.current) setPulse("up");
    else if (value < prev.current) setPulse("down");
    prev.current = value;
    const timer = window.setTimeout(() => setPulse(null), 900);
    return () => window.clearTimeout(timer);
  }, [value]);

  const Icon = pulse === "down" || (pulse === null && kind === "delta" && value < 0) ? TrendingDown : TrendingUp;
  const showIcon = showTrend && (kind === "delta" || pulse !== null);
  const tone =
    kind === "delta"
      ? value > 0
        ? "text-gain"
        : value < 0
          ? "text-loss"
          : "text-faint"
      : "text-cream";

  return (
    <span
      className={cn(
        "num inline-flex items-center gap-1 rounded px-1 -mx-1 transition-colors duration-500",
        tone,
        pulse === "up" && "bg-gain/15",
        pulse === "down" && "bg-loss/15",
        className,
      )}
    >
      {showIcon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
      {format(value, kind, decimals)}
    </span>
  );
}
