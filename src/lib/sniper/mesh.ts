import { clip } from "./format.ts";
import { features, predict } from "./model.ts";
import {
  SOURCE_ORDER,
  SOURCE_SPECS,
  type Board,
  type Health,
  type MeshSourceStatus,
  type MeshSymbolView,
  type MeshVote,
  type SourceId,
  type SourceReadout,
  type SourceSetting,
} from "./mesh-types.ts";
import type { ModelState, Settings, SymbolState } from "./types";

/**
 * One tick of the mesh.
 *
 * The thirteen readers run in the same pass — no round trips, no waiting on the
 * slowest one — and each returns the same normalized readout. The tally that
 * comes out the other end is what the order desk is allowed to act on; without
 * it the desk falls back to the legacy three-desk blend.
 *
 * Wake windows are measured in ticks: a source with latency 1.4 opens every
 * other minute. The readouts of the minute it did not open are carried forward
 * and marked with their age, and a dead feed inside its wake window is either
 * carried at reduced weight (DECAY) or dropped entirely (IGNORE).
 *
 * Pure and deterministic: same book in, same board out. The only mutation is the
 * caller's own mesh scratch state, and it is passed back explicitly.
 */

/** Cap on how long a stale read is carried before it is dropped outright. */
export const MAX_STALE_AGE = 6;

/** Where per-source wake windows, budgets and last readouts live between ticks. */
export type MeshScratch = {
  windows: Partial<Record<SourceId, number>>;
  airtime: Partial<Record<SourceId, number>>;
  last: Partial<Record<SourceId, SourceReadout>>;
  dispatched: number;
  spent: number;
  minute: number;
};

export function emptyScratch(minute = 0): MeshScratch {
  return { windows: {}, airtime: {}, last: {}, dispatched: 0, spent: 0, minute };
}

export function sourceLatencyTicks(id: SourceId) {
  return Math.max(1, Math.ceil(SOURCE_SPECS[id].latency));
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdev(values: number[]) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
}

function biasOf(sym: SymbolState) {
  return clip(sym.bias, -1, 1);
}

/** Volume-weighted mid drift over one bar of history, in basis points. */
function lastMoveBps(sym: SymbolState) {
  const hist = sym.hist;
  if (hist.length < 2) return 0;
  const prev = hist[hist.length - 2] ?? 1;
  const last = hist[hist.length - 1] ?? prev;
  if (!prev) return 0;
  return ((last - prev) / prev) * 10_000;
}

function readout(
  source: SourceId,
  sym: SymbolState,
  bias: number,
  strength: number,
  note: string,
  minute: number,
): SourceReadout {
  const spec = SOURCE_SPECS[source];
  return {
    source,
    symbol: sym.symbol,
    bias: clip(bias, -1, 1),
    strength: clip(strength, 0, 1),
    reliability: spec.reliability,
    note,
    at: minute,
  };
}

/**
 * Bounded, deterministic draw that stands in for a network round trip.
 * The value feeds the desk's slippage and venue choice, never the direction.
 */
function hashed(id: string, salt: number) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (const n of [salt]) {
    h ^= n >>> 0;
    h = Math.imul(h, 16777619);
  }
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

export type ReadContext = {
  symbols: SymbolState[];
  model: ModelState;
  /** Kept for the ordering rules downstream; readers use the ambient block. */
  settings: Settings;
  minute: number;
  symbol: SymbolState;
  /** Evergreen names for the cross-asset tone. */
  anchor: SymbolState | undefined;
  /** Risk-on proxy (index) and its sign. */
  riskOn: number;
  /** Full-universe participation of the last bar, a macro tide. */
  breadth: number;
  /** One-number macro tone for this minute, drifting over ~40 minutes. */
  macroTone: number;
  /** Headline tone over a rolling window. */
  newsTone: number;
  /** How one-sided the crowd is, 0 … 1. */
  crowdMood: number;
  /** The crowd's symbol-of-the-minute, if it is in this universe. */
  hotSymbol: string | null;
};

function readTape(ctx: ReadContext): SourceReadout {
  const sym = ctx.symbol;
  const bps = lastMoveBps(sym);
  const bias = clip(bps / 9 + biasOf(sym) * 0.25, -1, 1);
  const strength = clip(Math.abs(bps) / 14, 0.15, 1);
  return readout("TAPE", sym, bias, strength, `Last bar ${bps >= 0 ? "+" : ""}${bps.toFixed(0)} bps`, ctx.minute);
}

function readBook(ctx: ReadContext): SourceReadout {
  const sym = ctx.symbol;
  const glance = hashed(`${sym.symbol}:depth`, ctx.minute >> 1);
  const depth = clip(glance, 0, 1);
  const bias = biasOf(sym) * (0.35 + depth * 0.5);
  const strength = clip(0.2 + depth * 0.7, 0.15, 1);
  const thin = depth < 0.25;
  return readout(
    "BOOK",
    sym,
    thin ? bias * 0.4 : bias,
    thin ? strength * 0.5 : strength,
    thin ? "Depth is thin, stops are exposed" : `Depth ${(depth * 100).toFixed(0)}% of normal`,
    ctx.minute,
  );
}

function readFlow(ctx: ReadContext): SourceReadout {
  const sym = ctx.symbol;
  const glance = hashed(`${sym.symbol}:flow`, ctx.minute);
  const aggression = clip((lastMoveBps(sym) / 11) * 0.7 + (glance - 0.5) * 0.9, -1, 1);
  const block = Math.abs(aggression) > 0.45 ? "Block prints" : "Flow is balanced";
  return readout("FLOW", sym, aggression, clip(Math.abs(aggression) * 1.4, 0.1, 1), block, ctx.minute);
}

function readMomentum(ctx: ReadContext): SourceReadout {
  const sym = ctx.symbol;
  const f = features(sym);
  const impulse = clip((f[1] ?? 0) / 2.2 + (f[2] ?? 0) / 2.6, -1, 1);
  return readout(
    "MOMENTUM",
    sym,
    impulse,
    clip(Math.abs(impulse) * 1.3, 0.1, 1),
    `5-bar ${(f[1] ?? 0).toFixed(2)} · 20-bar ${(f[2] ?? 0).toFixed(2)}`,
    ctx.minute,
  );
}

function readMeanRev(ctx: ReadContext): SourceReadout {
  const sym = ctx.symbol;
  const f = features(sym);
  const revert = clip((f[5] ?? 0) / 2.2, -1, 1);
  const rsi = clip((f[3] ?? 0) * 25 + 50, 0, 100);
  const stretch = Math.abs(revert);
  return readout(
    "MEANREV",
    sym,
    revert,
    clip(stretch * 1.2, 0.08, 1),
    `RSI ${rsi.toFixed(0)} · ${rsi > 62 ? "stretched up" : rsi < 38 ? "stretched down" : "mid band"}`,
    ctx.minute,
  );
}

function readVol(ctx: ReadContext): SourceReadout {
  const sym = ctx.symbol;
  const f = features(sym);
  const vol = clip((f[4] ?? 0) / 2, 0, 1);
  const opinion = clip((ctx.macroTone - 0.5) * 0.8, -1, 1);
  return readout(
    "VOL",
    sym,
    opinion,
    clip(vol, 0.1, 1),
    vol > 0.62 ? "Range is wide, size down" : "Range is normal",
    ctx.minute,
  );
}

function readSector(ctx: ReadContext): SourceReadout {
  const sym = ctx.symbol;
  const cohort = ctx.symbols.filter((s) => s.sector === sym.sector);
  const own = features(sym)[2] ?? 0;
  const peers = mean(cohort.map((s) => features(s)[2] ?? 0));
  const relative = clip((own - peers) / 1.6, -1, 1);
  return readout(
    "SECTOR",
    sym,
    relative,
    clip(Math.abs(relative) * 1.2, 0.05, 1),
    `${sym.sector} relative ${relative >= 0 ? "+" : ""}${relative.toFixed(2)}`,
    ctx.minute,
  );
}

export function readLeadLag(ctx: ReadContext, leaderSymbol: string): SourceReadout {
  const sym = ctx.symbol;
  const leader = ctx.symbols.find((s) => s.symbol === leaderSymbol);
  const lead = leader ? features(leader)[1] ?? 0 : 0;
  const own = features(sym)[1] ?? 0;
  const lag = clip((lead - own) / 1.8, -1, 1);
  const aligned = Math.abs(lead - own) > 0.1;
  return readout(
    "LEADLAG",
    sym,
    lag,
    aligned ? clip(Math.abs(lag) * 1.3, 0.15, 1) : 0.1,
    aligned ? `${leaderSymbol} leads, this name lags` : `In step with ${leaderSymbol}`,
    ctx.minute,
  );
}

function readCross(ctx: ReadContext): SourceReadout {
  const sym = ctx.symbol;
  const beta = sym.sector === "Index" ? 1.2 : sym.sector === "Metal" ? -0.3 : 0.85;
  const bias = clip(ctx.riskOn * 2.2 * beta, -1, 1);
  return readout(
    "CROSS",
    sym,
    bias,
    clip(Math.abs(ctx.riskOn) * 3, 0.08, 1),
    `Index ${ctx.riskOn >= 0 ? "up" : "down"} ${(Math.abs(ctx.riskOn) * 100).toFixed(1)}%`,
    ctx.minute,
  );
}

function readMacro(ctx: ReadContext): SourceReadout {
  const sym = ctx.symbol;
  const bias = clip((ctx.macroTone - 0.5) * 2, -1, 1);
  return readout(
    "MACRO",
    sym,
    bias,
    clip(Math.abs(bias) * 0.9 + 0.1, 0.1, 1),
    bias >= 0 ? "Rates and dollar easing, tailwind" : "Rates and dollar firming, headwind",
    ctx.minute,
  );
}

function readNews(ctx: ReadContext): SourceReadout {
  const sym = ctx.symbol;
  const own = clip(ctx.newsTone + (hashed(`${sym.symbol}:headline`, ctx.minute >> 2) - 0.5) * 0.4, -1, 1);
  const fresh = hashed(`${sym.symbol}:fresh`, ctx.minute >> 2) > 0.6;
  return readout(
    "NEWS",
    sym,
    own,
    fresh ? clip(Math.abs(own) * 1.6, 0.1, 1) : 0.08,
    fresh ? (own >= 0 ? "Fresh supportive headline" : "Fresh risk headline") : "No fresh headline",
    ctx.minute,
  );
}

function readSocial(ctx: ReadContext): SourceReadout {
  const sym = ctx.symbol;
  const hot = ctx.hotSymbol === sym.symbol ? 1 : 0.35;
  const velocity = clip(ctx.crowdMood * hot, 0, 1);
  // Crowding confirms in the middle of a mood and is a fade at the extreme.
  const bias = velocity > 0.75 ? -0.6 : velocity < 0.4 ? 0.15 : velocity * 0.5;
  return readout(
    "SOCIAL",
    sym,
    bias * Math.sign(ctx.newsTone || 1),
    clip(velocity, 0.05, 1),
    velocity > 0.75 ? "Crowd is one-sided, fade risk" : "Crowd is quiet",
    ctx.minute,
  );
}

function readModel(ctx: ReadContext): SourceReadout {
  const sym = ctx.symbol;
  const f = features(sym);
  const p = predict(ctx.model.weights, f);
  const edge = clip((p - 0.5) * 4, -1, 1);
  const trained = ctx.model.samples > 0;
  return readout(
    "MODEL",
    sym,
    edge,
    trained ? clip(Math.abs(edge) * 1.2, 0.1, 1) : 0.2,
    trained ? `Walk-forward ${(p * 100).toFixed(0)}% long` : "Prior only, no closes learned",
    ctx.minute,
  );
}

/** The symbol each name is wired to follow, so lead/lag has a direction. */
export const LEADER_OF: Record<string, string> = {
  NVDA: "AMD",
  AMD: "NVDA",
  AAPL: "MSFT",
  MSFT: "AAPL",
  AMZN: "META",
  META: "AMZN",
  JPM: "SPY",
  XOM: "GLD",
  TSLA: "QQQ",
  QQQ: "SPY",
  GLD: "SPY",
  SPY: "QQQ",
};

function healthOf(id: SourceId, read: SourceReadout | undefined, minute: number): Health {
  if (!read) return "DARK";
  const age = minute - read.at;
  if (age <= 0) return "LIVE";
  if (age <= sourceLatencyTicks(id)) return "DELAYED";
  return "STALE";
}

/**
 * Whether a source opens on this tick.
 *
 * A pinned source is read every tick — it is watching one name, that is the
 * point. In auto mode a source wakes once per `ceil(latency)` ticks, and the
 * root tick is staggered by family so the mesh fans out instead of firing every
 * reader on the same minute.
 */
function opensThisTick(id: SourceId, tick: number) {
  const spec = SOURCE_SPECS[id];
  const window = sourceLatencyTicks(id);
  const stagger = { FLOW: 0, PRICE: 1, FILE: 2, SENT: 3, MODEL: 0 }[spec.family] ?? 0;
  if (window <= 1) return true;
  return (tick + stagger) % window === 0;
}

function budgetAllows(id: SourceId, scratch: MeshScratch) {
  const spec = SOURCE_SPECS[id];
  if (spec.quota <= 0) return true;
  const left = spec.quota - (scratch.spent ?? 0);
  return left >= spec.cost;
}

function targetOf(id: SourceId, settings: SourceSetting, symbols: SymbolState[]): SymbolState[] {
  if (settings.symbol) {
    const one = symbols.find((s) => s.symbol === settings.symbol);
    if (one) return [one];
  }
  // Slow, shared, priced feeds are read on the liquid names; the price and flow
  // readers cover the whole board.
  const shared = id === "NEWS" || id === "MACRO" || id === "SOCIAL";
  return shared ? symbols.slice(0, Math.min(6, symbols.length)) : symbols;
}

function readOne(id: SourceId, ctx: ReadContext): SourceReadout {
  switch (id) {
    case "TAPE":
      return readTape(ctx);
    case "BOOK":
      return readBook(ctx);
    case "FLOW":
      return readFlow(ctx);
    case "MOMENTUM":
      return readMomentum(ctx);
    case "MEANREV":
      return readMeanRev(ctx);
    case "VOL":
      return readVol(ctx);
    case "SECTOR":
      return readSector(ctx);
    case "LEADLAG":
      return readLeadLag(ctx, LEADER_OF[ctx.symbol.symbol] ?? "SPY");
    case "CROSS":
      return readCross(ctx);
    case "MACRO":
      return readMacro(ctx);
    case "NEWS":
      return readNews(ctx);
    case "SOCIAL":
      return readSocial(ctx);
    default:
      return readModel(ctx);
  }
}

export type MeshInput = {
  symbols: SymbolState[];
  model: ModelState;
  settings: Settings;
  minute: number;
  scratch: MeshScratch;
  /** Freshly generated sentiment hype consumed only by the crowd reader. */
  hypedSymbol: string | null;
};

/** `board.sources` — what the board is fed when a source stops answering. */
export type MeshFeeds = Partial<Record<SourceId, Record<string, SourceReadout>>>;

export type MeshOutput = {
  scratch: MeshScratch;
  statuses: MeshSourceStatus[];
  /** Every readout the pass produced this tick, fresh and carried alike. */
  reads: SourceReadout[];
  /** `cache[source][symbol]` — the board's only input. */
  cache: Partial<Record<SourceId, Record<string, SourceReadout>>>;
};

/** The readout a source last published for a name, if it had one. */
function matchHeld(
  held: SourceReadout | undefined,
  symbol: string,
  id: SourceId,
): SourceReadout | null {
  if (!held || held.symbol !== symbol) return null;
  return { ...held, source: id };
}

/** A carried readout, aged but never invented: same values, older stamp. */
function decay(
  held: SourceReadout | undefined,
  symbol: string,
  id: SourceId,
  minute: number,
): SourceReadout | null {
  if (!held || held.symbol !== symbol) return null;
  const age = minute - held.at;
  if (age > MAX_STALE_AGE) return null;
  return { ...held, source: id, reliability: clip(held.reliability * (1 - age / (MAX_STALE_AGE + 1)), 0, 1) };
}

/** The per-minute macro / sentiment primitives every read is allowed to see. */
export function meshAmbient(input: MeshInput) {
  const symbols = input.symbols;
  const spy = symbols.find((s) => s.symbol === "SPY");
  const qqq = symbols.find((s) => s.symbol === "QQQ");
  const gld = symbols.find((s) => s.symbol === "GLD");
  const indexMove = mean([
    spy ? lastMoveBps(spy) : 0,
    qqq ? lastMoveBps(qqq) : 0,
  ]);
  const riskOn = clip(indexMove / 9, -1, 1);
  const breadth = clip(
    symbols.filter((s) => lastMoveBps(s) > 0).length / Math.max(1, symbols.length),
    0,
    1,
  );
  const tone = clip((input.minute % 220) / 220, 0, 1);
  const macroTone = tone < 0.25 ? 0.62 : tone < 0.5 ? 0.44 : tone < 0.75 ? 0.58 : 0.5;
  const newsTone = clip(Math.sin(input.minute / 9) * 0.7 + (spy ? biasOf(spy) * 0.3 : 0), -1, 1);
  const mention = symbols.filter((s) => Math.abs(biasOf(s)) > 0.2).length;
  const crowdMood = clip(mention / Math.max(1, symbols.length) + (input.hypedSymbol ? 0.2 : 0), 0, 1);
  const hot =
    symbols
      .slice()
      .sort((a, b) => Math.abs(biasOf(b)) - Math.abs(biasOf(a)))[0]?.symbol ?? null;
  return {
    riskOn,
    breadth,
    macroTone,
    newsTone,
    crowdMood,
    hotSymbol: input.hypedSymbol ?? hot,
    anchors: { spy, gld },
  };
}

export function stepMesh(input: MeshInput): MeshOutput {
  const { settings, symbols, minute } = input;
  const scratch: MeshScratch = {
    ...input.scratch,
    windows: { ...input.scratch.windows },
    airtime: { ...input.scratch.airtime },
    last: { ...input.scratch.last },
  };
  scratch.minute = minute;
  scratch.spent = budgetLeft(scratch.spent, minute, input.scratch.minute);

  // Built once per tick and handed to every reader, so the whole fan-out is
  // looking at one coherent market rather than a per-reader paraphrase of it.
  const readContext = (sym: SymbolState): ReadContext => {
    const ambient = meshAmbient(input);
    return {
      symbols,
      model: input.model,
      settings,
      minute,
      symbol: sym,
      anchor: sym.symbol === "SPY" ? ambient.anchors.spy : ambient.anchors.gld,
      riskOn: ambient.riskOn,
      breadth: ambient.breadth,
      macroTone: ambient.macroTone,
      newsTone: ambient.newsTone,
      crowdMood: ambient.crowdMood,
      hotSymbol: ambient.hotSymbol,
    };
  };

  // The mesh's own settings map wins when the caller carries one (it is the
  // per-source registry); the legacy three-desk map is only a fallback so an
  // older persisted book still boots.
  const registry = (settings.mesh ?? settings.sources) as Record<SourceId, SourceSetting>;

  const due: SourceId[] = [];
  for (const id of SOURCE_ORDER) {
    const setting = registry[id];
    if (!setting || !setting.enabled) continue;
    if (setting.mode === "AUTO" && !opensThisTick(id, minute)) continue;
    if (!budgetAllows(id, scratch)) continue;
    due.push(id);
  }

  scratch.spent += due.reduce((sum, id) => sum + SOURCE_SPECS[id].cost, 0);
  scratch.dispatched = (scratch.dispatched ?? 0) + due.length;

  const reads: SourceReadout[] = [];
  const cache: MeshFeeds = {};

  /**
   * The wall-clock fan-out, compressed: one pass, no waiting, every reader sees
   * the same minute. A feed that was not dispatched this tick is carried from
   * its last readout and re-stamped with its own age, so its vote decays and
   * eventually drops instead of silently standing in as live.
   */
  for (const id of SOURCE_ORDER) {
    const setting = registry[id];
    if (!setting || !setting.enabled) continue;
    const spec = SOURCE_SPECS[id];
    const held = scratch.last[id];
    const dispatchedThisTick = due.includes(id);
    const owner: Record<string, SourceReadout> = {};
    for (const sym of targetOf(id, setting, symbols)) {
      const fresh = dispatchedThisTick ? readOne(id, readContext(sym)) : matchHeld(held, sym.symbol, id);
      const read = fresh ?? (spec.fail === "DECAY" ? decay(held, sym.symbol, id, minute) : null);
      if (!read) continue;
      if (dispatchedThisTick) scratch.last[id] = read;
      owner[sym.symbol] = read;
      reads.push(read);
    }
    cache[id] = owner;
  }

  const statuses = SOURCE_ORDER.map<MeshSourceStatus>((id) => {
    const setting = registry[id];
    const spec = SOURCE_SPECS[id];
    const last = scratch.last[id];
    const enabled = Boolean(setting?.enabled);
    return {
      id,
      family: spec.family,
      label: spec.label,
      endpoint: spec.endpoint,
      rationale: spec.rationale,
      enabled,
      weight: setting?.weight ?? spec.weight,
      mode: setting?.mode ?? "AUTO",
      pinnedSymbol: setting?.symbol ?? null,
      reads: reads.filter((r) => r.source === id).length,
      skill: spec.reliability,
      health: enabled ? healthOf(id, last, minute) : "DARK",
      note: last ? last.note : "No read yet",
    };
  });

  // A carried read is visibly decayed: voting strength is scaled by how long ago
  // it was actually observed, so nobody mistakes a quiet feed for a live one.
  for (const read of reads) {
    const age = Math.max(0, minute - read.at);
    if (age > 0) read.strength = clip(read.strength * (1 - age / (MAX_STALE_AGE + 1)), 0, 1);
  }

  return { scratch, statuses, reads, cache };
}

/** Refill the shared request budget once the cooldown window closes. */
export function budgetLeft(spent: number, minute: number, previousMinute: number) {
  if (minute <= previousMinute) return spent;
  const elapsed = minute - previousMinute;
  const refill = elapsed * 8;
  return Math.max(0, spent - refill);
}

export function budgetFor(symbolCount: number) {
  return Math.max(240, symbolCount * 40);
}

export type DecisionInput = {
  symbols: SymbolState[];
  minute: number;
  statuses: MeshSourceStatus[];
  cache: Partial<Record<SourceId, Record<string, SourceReadout>>>;
};

/**
 * The board the desk reads before it orders anything.
 *
 * Every status in, one tally out: one vote per live source per name, weight
 * times strength times freshness times skill, sitting on the vote count — not
 * on the weight sum — so a wide but lukewarm mesh cannot fake conviction the
 * way a single loud desk used to.
 */
export function boardFrom(input: DecisionInput): Board {
  const { symbols, statuses, minute, cache } = input;
  const liveIds = statuses.filter((s) => s.enabled).map((s) => s.id);
  const votes: MeshVote[] = [];
  const perSymbol: Record<string, MeshSymbolView> = {};
  let used = 0;
  let live = 0;

  for (const sym of symbols) {
    const rows: MeshVote[] = [];
    for (const status of statuses) {
      if (!status.enabled) continue;
      const read = cache[status.id]?.[sym.symbol];
      if (!read) continue;
      live += 1;
      const contribution = status.weight * read.strength * read.reliability;
      used += Math.abs(contribution);
      rows.push({
        source: status.id,
        bias: read.bias,
        strength: read.strength,
        reliability: read.reliability,
        weight: status.weight,
        contribution,
        note: read.note,
      });
    }
    const sum = rows.reduce((acc, row) => acc + row.contribution * row.bias, 0);
    const tally = clip(sum / (rows.length || 1), -1, 1);
    const spread =
      rows.length > 1
        ? Math.sqrt(rows.reduce((acc, row) => acc + (row.bias - tally) ** 2, 0) / rows.length)
        : 0.35;
    const agreeing = rows.filter((row) => row.bias !== 0 && Math.sign(row.bias) === Math.sign(tally)).length;
    perSymbol[sym.symbol] = {
      symbol: sym.symbol,
      tally,
      sigma: spread,
      confidence: clip(Math.abs(tally) * (1 - clip(spread / 2, 0, 0.9)), 0, 1),
      qualified: false,
      agreeing,
      liveFeeds: rows.length,
      direction: tally > 0 ? 1 : tally < 0 ? -1 : 0,
      vetoed: false,
    };
  }

  // The veto is the one rule the desk cannot negotiate: a name the crowd is
  // already one-sided on is not tradeable at any confidence — the book would be
  // the last buyer in a room that has already bought.
  for (const sym of symbols) {
    const view = perSymbol[sym.symbol];
    const crowd = cache.SOCIAL?.[sym.symbol];
    if (!view || !crowd || view.direction === 0) continue;
    if (crowd.strength > 0.7 && Math.sign(crowd.bias) === view.direction) {
      view.vetoed = true;
      view.qualified = false;
      view.confidence = clip(view.confidence * 0.55, 0, 1);
    }
  }

  const ranked = Object.values(perSymbol).sort((a, b) => b.confidence - a.confidence);
  for (const row of ranked.filter((r) => !r.vetoed && r.liveFeeds >= 2).slice(0, 8)) {
    perSymbol[row.symbol].qualified = true;
  }

  const coherence = votes.length > 0 ? clip(1 - stdev(votes.map((v) => v.bias)), 0, 1) : 0;

  return {
    minute,
    reads: [],
    votes,
    perSymbol,
    used,
    live,
    dispatched: liveIds.length,
    coherence,
    qualified: Object.values(perSymbol).filter((r) => r.qualified).length,
    top: ranked.find((r) => !r.vetoed)?.symbol ?? null,
    dispatchedFeed: statuses,
  };
}

export function healthLabel(health: Health) {
  if (health === "LIVE") return "live";
  if (health === "DELAYED") return "delayed";
  if (health === "STALE") return "stale";
  return "dark";
}
