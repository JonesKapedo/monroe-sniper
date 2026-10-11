/**
 * The mesh: many sources, one decision.
 *
 * A source is a reader of its own slice of the market — tape, book, order flow,
 * sector, macro, news, crowding, own-model. Each descriptor carries exactly what
 * the mesh needs to reach it, how long it may take, what to do when it dies and
 * what its vote is worth — so a new desk is a new entry here, never a new
 * switch somewhere in the engine.
 *
 * Everything a source emits goes through one normalizer (`readout`), so a dead
 * read, a stale read and a convinced read are the same shape downstream.
 */

export type SourceFamily = "FLOW" | "PRICE" | "FILE" | "SENT" | "MODEL";

/** What the mesh does when a source is enabled but answers nothing. */
export type FailPolicy = "DECAY" | "IGNORE";

export type Health = "LIVE" | "DELAYED" | "STALE" | "DARK";

export type ReadMode = "PINNED" | "AUTO";

export type { SourceId as MeshSourceId, SourceSetting as MeshSourceSetting };

export type SourceReadout = {
  source: SourceId;
  symbol: string;
  /** -1 short conviction … +1 long conviction, already clipped. */
  bias: number;
  /** 0 … 1, how much this read is worth relative to the desk's ceiling. */
  strength: number;
  /** Freshness, 0 … 1 — decays a hair per tick so a quiet feed fades. */
  reliability: number;
  /** Language the desk speaks, not the endpoint's error code. */
  note: string;
  at: number;
};

export type MeshVote = {
  source: SourceId;
  bias: number;
  strength: number;
  reliability: number;
  weight: number;
  contribution: number;
  note: string;
};

export type MeshSourceStatus = {
  id: SourceId;
  family: SourceFamily;
  label: string;
  endpoint: string;
  rationale: string;
  enabled: boolean;
  weight: number;
  mode: ReadMode;
  pinnedSymbol: string | null;
  reads: number;
  skill: number;
  health: Health;
  note: string;
};

export type MeshSymbolView = {
  symbol: string;
  tally: number;
  sigma: number;
  confidence: number;
  qualified: boolean;
  agreeing: number;
  liveFeeds: number;
  direction: -1 | 0 | 1;
  vetoed: boolean;
};

export type Board = {
  minute: number;
  reads: SourceReadout[];
  votes: MeshVote[];
  perSymbol: Record<string, MeshSymbolView>;
  used: number;
  live: number;
  dispatched: number;
  coherence: number;
  qualified: number;
  top: string | null;
  dispatchedFeed: MeshSourceStatus[];
};

export type OrderType = "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT" | "BRACKET";
export type TimeInForce = "DAY" | "GTC" | "IOC" | "FOK";
export type TcaVerdict = "CLEAN" | "SLIPPED" | "GAPPED" | "THIN" | "REJECTED";

export type FillEvent = {
  positionId: string;
  symbol: string;
  side: "LONG" | "SHORT";
  qty: number;
  arrival: number;
  fill: number;
  slip: number;
  slipBps: number;
  fee: number;
  venue: string;
  latency: number;
  partial: boolean;
  tca: TcaVerdict;
};

export type FillLog = FillEvent & { id: string; at: number };

export type RouteCandidate = {
  venue: string;
  share: boolean;
  price: number;
  fee: number;
  liquidity: number;
  latency: number;
};

export type RouteLeg = RouteCandidate & { qty: number; cost: number };

export type RoutePlan = {
  type: OrderType;
  side: "LONG" | "SHORT";
  qty: number;
  arrival: number;
  limit: number | null;
  legs: RouteLeg[];
  expected: number;
  worst: number;
  score: number;
  fee: number;
  liquidity: number;
  venue: string;
  reason: string;
  /** The bracket the plan would open, carried so execution cannot drift. */
  stop: number;
  target: number;
};

export type SourceId =
  | "TAPE"
  | "BOOK"
  | "FLOW"
  | "MOMENTUM"
  | "MEANREV"
  | "VOL"
  | "SECTOR"
  | "LEADLAG"
  | "CROSS"
  | "MACRO"
  | "NEWS"
  | "SOCIAL"
  | "MODEL";

export type SourceSpec = {
  id: SourceId;
  label: string;
  family: SourceFamily;
  /** The external shape this replica stands in for — shown in the UI. */
  endpoint: string;
  role: string;
  rationale: string;
  weight: number;
  latency: number;
  reliability: number;
  cost: number;
  cooldown: number;
  quota: number;
  fail: FailPolicy;
};

export type SourceSetting = {
  enabled: boolean;
  weight: number;
  mode: ReadMode;
  /** Pinned mode reads only this name — the cheap way to watch one ticker. */
  symbol: string | null;
};

/** Every source is one of these thresholds; the descriptor table is the rest. */
export const SOURCE_SPECS: Record<SourceId, SourceSpec> = {
  TAPE: {
    id: "TAPE",
    label: "Tape print",
    family: "FLOW",
    endpoint: "now",
    role: "Prints, pace and aggression of trades crossing the tape.",
    rationale: "Short bursts of buying power long entries; exhaustion reads as mean reversion.",
    weight: 1.1,
    latency: 0.35,
    reliability: 0.94,
    cost: 0,
    cooldown: 0,
    quota: 0,
    fail: "DECAY",
  },
  BOOK: {
    id: "BOOK",
    label: "Resting book",
    family: "FLOW",
    endpoint: "book",
    role: "Bid and ask depth resting on the book.",
    rationale: "Thin depth means a stop is a gap; thick depth means the level holds.",
    weight: 0.9,
    latency: 0.55,
    reliability: 0.92,
    cost: 0,
    cooldown: 0,
    quota: 0,
    fail: "DECAY",
  },
  FLOW: {
    id: "FLOW",
    label: "Order flow",
    family: "FLOW",
    endpoint: "flow",
    role: "Block prints and auction imbalance.",
    rationale: "Large prints are information that has already been sized.",
    weight: 1.2,
    latency: 0.9,
    reliability: 0.9,
    cost: 0,
    cooldown: 0,
    quota: 0,
    fail: "DECAY",
  },
  MOMENTUM: {
    id: "MOMENTUM",
    label: "Momentum",
    family: "PRICE",
    endpoint: "scan/momentum",
    role: "Five-bar impulse and acceleration.",
    rationale: "Trend persistence over one session's horizon.",
    weight: 1,
    latency: 0.5,
    reliability: 0.92,
    cost: 0,
    cooldown: 0,
    quota: 0,
    fail: "DECAY",
  },
  MEANREV: {
    id: "MEANREV",
    label: "Mean reversion",
    family: "PRICE",
    endpoint: "scan/reversion",
    role: "Distance from the twenty-bar mean, RSI band.",
    rationale: "Stretched names are the best fade candidates.",
    weight: 0.9,
    latency: 0.5,
    reliability: 0.92,
    cost: 0,
    cooldown: 0,
    quota: 0,
    fail: "IGNORE",
  },
  VOL: {
    id: "VOL",
    label: "Volatility",
    family: "PRICE",
    endpoint: "scan/atr",
    role: "Realized range and the size of the last bar.",
    rationale: "Size the position to the tape's own noise, not a fixed percent.",
    weight: 0.5,
    latency: 0.45,
    reliability: 0.9,
    cost: 0,
    cooldown: 0,
    quota: 0,
    fail: "IGNORE",
  },
  SECTOR: {
    id: "SECTOR",
    label: "Sector relative",
    family: "PRICE",
    endpoint: "scan/relative",
    role: "The name against its sector cohort for the last twenty bars.",
    rationale: "Idiosyncratic strength is the edge; sector beta is not information.",
    weight: 0.8,
    latency: 0.6,
    reliability: 0.9,
    cost: 0,
    cooldown: 0,
    quota: 0,
    fail: "IGNORE",
  },
  LEADLAG: {
    id: "LEADLAG",
    label: "Lead / lag",
    family: "PRICE",
    endpoint: "scan/leadlag",
    role: "What the correlated leader did over the last one to two bars.",
    rationale: "A follower that has not caught up to its leader is the classic lag trade.",
    weight: 0.9,
    latency: 0.7,
    reliability: 0.88,
    cost: 0,
    cooldown: 0,
    quota: 0,
    fail: "IGNORE",
  },
  CROSS: {
    id: "CROSS",
    label: "Cross asset",
    family: "PRICE",
    endpoint: "scan/cross",
    role: "Index and gold as an ambient risk-on / risk-off tone.",
    rationale: "Tone moves every name; knowing the tide stops you fighting it.",
    weight: 0.6,
    latency: 0.5,
    reliability: 0.9,
    cost: 0,
    cooldown: 0,
    quota: 0,
    fail: "IGNORE",
  },
  MACRO: {
    id: "MACRO",
    label: "Macro pulse",
    family: "SENT",
    endpoint: "macro/pulse",
    role: "Rates and the dollar, one number for the whole book.",
    rationale: "A macro turn lifts or sinks the whole page at once.",
    weight: 0.5,
    latency: 0.8,
    reliability: 0.85,
    cost: 0,
    cooldown: 40,
    quota: 320,
    fail: "IGNORE",
  },
  NEWS: {
    id: "NEWS",
    label: "News wire",
    family: "SENT",
    endpoint: "news/wire",
    role: "Headline tone over a rolling window.",
    rationale: "Headlines move price faster than any screen; they also lie.",
    weight: 0.7,
    latency: 1.4,
    reliability: 0.78,
    cost: 2,
    cooldown: 30,
    quota: 240,
    fail: "DECAY",
  },
  SOCIAL: {
    id: "SOCIAL",
    label: "Crowd voice",
    family: "SENT",
    endpoint: "social/stream",
    role: "Social mention velocity and how one-sided it is.",
    rationale: "Crowding is a fade signal at the extremes, a confirmation in the middle.",
    weight: 0.7,
    latency: 1.1,
    reliability: 0.7,
    cost: 1,
    cooldown: 20,
    quota: 180,
    fail: "DECAY",
  },
  MODEL: {
    id: "MODEL",
    label: "Own model",
    family: "MODEL",
    endpoint: "model:local",
    role: "The desk's own weights, retrained after every close.",
    rationale: "It is only as good as its last correction — so it never votes alone.",
    weight: 0.8,
    latency: 0.05,
    reliability: 1,
    cost: 0,
    cooldown: 0,
    quota: 0,
    fail: "IGNORE",
  },
};

export const SOURCE_ORDER = Object.keys(SOURCE_SPECS) as SourceId[];

export function emptySourceSettings(): Record<SourceId, SourceSetting> {
  const out = {} as Record<SourceId, SourceSetting>;
  for (const id of SOURCE_ORDER) {
    out[id] = { enabled: true, weight: SOURCE_SPECS[id].weight, mode: "AUTO", symbol: null };
  }
  return out;
}
