/**
 * Professional multi-slot entry strategy.
 *
 * Goals:
 * - Diversify across symbols so one loser does not define the book
 * - Size and rank perps from live funding + open interest regime (not vibes)
 * - Keep learning: post-loss cools that symbol, not the whole desk
 */

export type OpenSlot = {
  tokenId: string;
  symbol: string;
};

export type RankedOpportunity = {
  id: string;
  symbol: string;
  anchorSymbol: string;
  category: string;
  confidenceScore: number;
  /** Strategy score after regime adjustments (0–100). */
  entryScore: number;
  perpSide?: "LONG" | "SHORT";
  fundingRate8h?: number | null;
  openInterest?: number | null;
  disciplineApproved: boolean;
};

export type PerpRegime = {
  /** Positive = longs pay shorts; negative = shorts pay longs. */
  funding8h: number;
  openInterest: number | null;
  side: "LONG" | "SHORT";
  /** 0–1 quality of the carry trade (funding magnitude + OI presence). */
  carryQuality: number;
  /** True when funding is extreme and mean-reversion risk is elevated. */
  extremeFunding: boolean;
  notes: string[];
};

/**
 * Interpret Hyperliquid-style funding for a professional carry / fade decision.
 * - Mild negative funding → bias LONG (shorts pay longs; the long collects)
 * - Mild positive funding → bias SHORT (longs pay shorts; the short collects)
 * - Extreme |funding| → de-rate: crowded trade, squeeze risk
 * - Missing OI → still tradable but lower confidence
 */
export function interpretPerpRegime(
  funding1h: number | null,
  openInterest: number | null,
): PerpRegime | null {
  if (funding1h === null || !Number.isFinite(funding1h)) return null;
  const funding8h = funding1h * 8;
  const aprAbs = Math.abs(funding1h * 24 * 365 * 100);
  const side: "LONG" | "SHORT" = funding8h <= 0 ? "LONG" : "SHORT";
  const extremeFunding = Math.abs(funding8h) >= 0.0015;
  const oi = openInterest !== null && openInterest > 0 ? openInterest : null;
  let carryQuality = Math.min(1, aprAbs / 40);
  if (extremeFunding) carryQuality *= 0.55;
  if (oi === null) carryQuality *= 0.85;
  else if (oi < 50_000) carryQuality *= 0.7;
  else if (oi > 500_000) carryQuality = Math.min(1, carryQuality * 1.08);

  const notes: string[] = [];
  notes.push(
    side === "LONG"
      ? `Funding ${(funding8h * 100).toFixed(3)}%/8h — shorts pay longs (carry long)`
      : `Funding +${(funding8h * 100).toFixed(3)}%/8h — longs pay shorts (carry short)`,
  );
  if (extremeFunding) {
    notes.push("Extreme funding — size down; crowded side can squeeze");
  }
  if (oi === null) notes.push("Open interest unpublished — confidence haircut");
  else notes.push(`Open interest $${Math.round(oi).toLocaleString()}`);

  return { funding8h, openInterest: oi, side, carryQuality, extremeFunding, notes };
}

/** Blend avenue confidence with perp regime into a single entry score. */
export function scorePerpEntry(
  baseConfidence: number,
  regime: PerpRegime | null,
): number {
  if (!regime) return Math.max(0, Math.min(100, baseConfidence * 0.5));
  const carryBoost = Math.round(regime.carryQuality * 18);
  let score = baseConfidence + carryBoost;
  if (regime.extremeFunding) score -= 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Pick up to `slots` opportunities that diversify the book:
 * - never the same tokenId twice
 * - prefer different base symbols from what is already open
 * - prefer mixing LONG/SHORT when both are available (natural hedge)
 * - ranked by entryScore descending
 */
export function selectDiversifiedEntries(
  ranked: RankedOpportunity[],
  open: OpenSlot[],
  slots: number,
  minScore = 55,
): RankedOpportunity[] {
  if (slots <= 0) return [];
  const openIds = new Set(open.map((p) => p.tokenId));
  const openBases = new Set(
    open.map((p) => p.symbol.toUpperCase().split(/[/:_\-]/)[0]),
  );

  const eligible = ranked
    .filter(
      (r) =>
        r.disciplineApproved &&
        r.entryScore >= minScore &&
        !openIds.has(r.id),
    )
    .sort((a, b) => b.entryScore - a.entryScore);

  const picked: RankedOpportunity[] = [];
  const pickedBases = new Set<string>();
  let longCount = 0;
  let shortCount = 0;

  for (const r of eligible) {
    if (picked.length >= slots) break;
    const base = r.symbol.toUpperCase().split(/[/:_\-]/)[0];
    if (openBases.has(base) || pickedBases.has(base)) continue;
    if (r.perpSide === "LONG" && longCount > shortCount + 1) continue;
    if (r.perpSide === "SHORT" && shortCount > longCount + 1) continue;
    picked.push(r);
    pickedBases.add(base);
    if (r.perpSide === "LONG") longCount += 1;
    if (r.perpSide === "SHORT") shortCount += 1;
  }

  for (const r of eligible) {
    if (picked.length >= slots) break;
    if (picked.some((p) => p.id === r.id)) continue;
    const base = r.symbol.toUpperCase().split(/[/:_\-]/)[0];
    if (openBases.has(base) || pickedBases.has(base)) continue;
    picked.push(r);
    pickedBases.add(base);
  }

  return picked;
}

/**
 * Soft post-loss policy: that symbol cools; the desk keeps trading others.
 */
export function symbolReentryBlocked(
  symbol: string,
  lastCloseAt: Record<string, number>,
  cooldownMs: number,
  now = Date.now(),
): boolean {
  const last = lastCloseAt[symbol];
  if (!last) return false;
  return now - last < cooldownMs;
}
