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

/**
 * relaxStep lowers the EVIDENCE thresholds (momentum size, participation,
 * score cutoffs) so a starved desk admits near-miss setups. It can NEVER
 * bypass: hard risk flags, the $10k book floor, or the +edge bias itself.
 */
export function assessEdge(input: EdgeInput, relaxStep = 0): Edge {
  const relax = Math.max(0, Math.min(3, relaxStep));
  const scoreCutoff = 4 * relax; // 0 / 4 / 8 / 12
  const changeFloor = 0.15 * relax; // 0.0 / 0.15 / 0.30 / 0.45 off the majors bar
  const partFloor = 0.015 * relax; // participation floor relief
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
  const participation = input.liquidityUsd > 0 ? input.volume24h / input.liquidityUsd : 0;
  let edge = input.score;
  const notes: string[] = [];

  // Quality guards. These are NOT evidence thresholds: no relax step may
  // loosen them, because no amount of starvation makes a fresh pump safe.
  // Every losing entry this desk has taken came through one of these holes.
  if (age != null && age < 1) {
    return {
      act: false,
      edge: Math.max(0, edge),
      stance: "SKIP",
      why: `Pair is ${age.toFixed(1)}h old — no reliable book to trade.`,
    };
  }
  if (change >= 25) {
    return {
      act: false,
      edge: Math.max(0, edge),
      stance: "SKIP",
      why: `Vertical move (+${change.toFixed(1)}%) — chasing a blow-off, not an edge.`,
    };
  }
  if (!depthUnknown && participation >= 1.2) {
    return {
      act: false,
      edge: Math.max(0, edge),
      stance: "SKIP",
      why: `Turnover ${participation.toFixed(2)}× the pool — distribution risk.`,
    };
  }

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
    const moving = Math.abs(change) >= Math.max(0.3, 0.55 - changeFloor) && input.score >= 48 - scoreCutoff;
    const solid = input.score >= Math.max(44, 58 - scoreCutoff) && Math.abs(change) >= Math.max(0.12, 0.25 - changeFloor);
    if (moving || solid) {
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

  const quiet = Math.abs(change) < Math.max(0.15, 0.35 - changeFloor);
  const mature = age == null || age > 48;
  if (quiet && mature && input.score < Math.max(46, 58 - scoreCutoff)) {
    return {
      act: false,
      edge: Math.max(0, edge),
      stance: "SKIP",
      why: "Efficient quote. No fresh information edge.",
    };
  }

  const young = age != null && age >= 0 && age < 12;
  if (young && input.score >= Math.max(43, 55 - scoreCutoff) && input.liquidityUsd >= 12_000 && change > -5) {
    return {
      act: true,
      edge: Math.min(100, edge + 8),
      stance: "EARLY",
      why: `Early print (${age.toFixed(1)}h). ${notes.join(". ")}`.trim(),
    };
  }

  const trending = change >= Math.max(0.3, 0.7 - changeFloor) && participation >= Math.max(0.03, 0.08 - partFloor) && input.score >= Math.max(42, 52 - scoreCutoff);
  // A high score on a dead book is not an information edge: prove it with
  // turnover before calling it a trend.
  const strongBook = input.score >= Math.max(52, 68 - scoreCutoff) && change > -0.5 && participation >= Math.max(0.03, 0.08 - partFloor);
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
