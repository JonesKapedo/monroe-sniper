/**
 * Fast pre-trade screen. Pure arithmetic, no I/O.
 * Efficient-market stance: do nothing unless price, liquidity, and age
 * disagree with a fully informed quote. Missing social data is not a vote.
 */
export type EdgeInput = {
  score: number;
  change24h: number;
  liquidityUsd: number;
  volume24h: number;
  pairAgeHours: number | null;
  flags?: string[];
  /** -1 bearish crowd, +1 bullish crowd. Omit when no social feed is connected. */
  sentiment?: number | null;
  /** True when depth is unpublished (e.g. CEX majors) — never fake-deep, never fake-thin. */
  liquidityUnknown?: boolean;
};

export type EdgeStance = "EARLY" | "TREND" | "SKIP";

export type Edge = {
  act: boolean;
  edge: number;
  stance: EdgeStance;
  why: string;
};

const HARD = ["HONEYPOT", "LP-UNLOCKED", "MINT-AUTHORITY", "FREEZE-AUTHORITY", "HIGH-TAX"];

export function assessEdge(input: EdgeInput): Edge {
  const flags = input.flags ?? [];
  if (flags.some((flag) => HARD.includes(flag))) {
    return { act: false, edge: 0, stance: "SKIP", why: "Hard risk flag. No trade." };
  }
  // Unknown depth (CEX majors) is neutral — same policy as every other gate.
  // It must not auto-skip: the entire Binance tape would be untradeable.
  const depthUnknown = input.liquidityUnknown === true;
  if (!depthUnknown && !(input.liquidityUsd >= 10_000)) {
    return { act: false, edge: 0, stance: "SKIP", why: "Book too thin to clear costs." };
  }

  const change = Number.isFinite(input.change24h) ? input.change24h : 0;
  const age = input.pairAgeHours;
  const sentiment = input.sentiment;
  let edge = input.score;
  const notes: string[] = [];

  if (typeof sentiment === "number" && Number.isFinite(sentiment)) {
    const sentimentDir = Math.sign(sentiment);
    const changeDir = Math.sign(change);
    if (sentimentDir !== 0 && changeDir !== 0 && sentimentDir !== changeDir) {
      if (Math.abs(sentiment) >= 0.35) {
        return {
          act: false,
          edge: Math.max(0, edge - 18),
          stance: "SKIP",
          why: "Social tone fights the tape. Stand aside.",
        };
      }
      edge -= 18;
      notes.push("Social tone fights the tape");
    } else if (Math.abs(sentiment) >= 0.35 && sentimentDir === changeDir) {
      edge += 6;
      notes.push("Social tone agrees");
    }
  } else {
    notes.push("No social feed");
  }

  if (depthUnknown) {
    notes.push("CEX depth unpublished");
  }

  // CEX majors: liquidity-weighted novelty filters are meaningless (depth
  // unpublished, pairs are never "fresh"), so the screen is purely momentum.
  // A major printing a real move is tradeable regardless of pool metrics.
  if (depthUnknown) {
    const moving = Math.abs(change) >= 1.2 && input.score >= 52;
    if (moving) {
      return {
        act: true,
        edge: Math.min(100, edge),
        stance: "TREND",
        why: `Major printing ${change.toFixed(1)}% on live CEX flow. ${notes.join(". ")}`.trim(),
      };
    }
    return {
      act: false,
      edge: Math.max(0, edge),
      stance: "SKIP",
      why: `Quiet major — efficient quote. ${notes.join(". ")}`.trim(),
    };
  }

  const quiet = Math.abs(change) < 0.45;
  const mature = age == null || age > 48;
  if (quiet && mature && input.score < 78) {
    return {
      act: false,
      edge: Math.max(0, edge),
      stance: "SKIP",
      why: "Efficient quote. No fresh information edge.",
    };
  }

  const young = age != null && age >= 0 && age < 8;
  if (young && input.score >= 68 && input.liquidityUsd >= 20_000 && change > -3) {
    return {
      act: true,
      edge: Math.min(100, edge + 8),
      stance: "EARLY",
      why: `Early print (${age.toFixed(1)}h). ${notes.join(". ")}`.trim(),
    };
  }

  const participation = input.liquidityUsd > 0 ? input.volume24h / input.liquidityUsd : 0;
  const trending = change >= 1.2 && participation >= 0.08 && input.score >= 62;
  const strongBook = input.score >= 80 && change > 0;
  if (trending || strongBook) {
    return {
      act: true,
      edge: Math.min(100, edge),
      stance: "TREND",
      why: `Statistical lean ${change.toFixed(1)}% with participation ${participation.toFixed(2)}. ${notes.join(". ")}`.trim(),
    };
  }

  return {
    act: false,
    edge: Math.max(0, edge),
    stance: "SKIP",
    why: "Edge does not clear the prior. Stand aside.",
  };
}
