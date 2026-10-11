import { emptySourceSettings, type SourceId as MeshSourceId, type SourceSetting as MeshSourceSetting } from "./mesh-types";
import type { Board, FillLog, MeshSourceStatus, OrderType, TimeInForce } from "./mesh-types";

export type { SourceId as MeshSourceId, SourceSetting as MeshSourceSetting };

export type Side = "BUY" | "SELL" | "FLAT";
export type BookSide = "LONG" | "SHORT";
export type ExitReason = "TARGET" | "STOP" | "TIME" | "SIGNAL" | "MANUAL" | "EXPIRY";
export type SourceId = "INVO" | "FINVIZ" | "SIMUL8OR";

/** The desk's own route to the venue is expressed in `Settings["orders"]`. */
export type { SourceReadout, MeshSourceStatus } from "./mesh-types";
export type { OrderType, TimeInForce, Board, FillLog, TcaVerdict } from "./mesh-types";
export type LedgerKind = "DEPOSIT" | "WITHDRAW" | "CLOSE";
export type Tone = "up" | "down" | "info";

export type SourceSetting = { enabled: boolean; weight: number };

/** The desk's own view of the order: where it rests and what it may cost. */
export type OrderSettings = {
  type: OrderType;
  tif: TimeInForce;
  /** Crossing cost, in basis points of notional. */
  feeBps: number;
  /** Vertical half-spread the venue charges on arrival, in basis points. */
  halfSpreadBps: number;
  /** Trip the TCA guard above this many basis points of slippage. */
  slipGuardBps: number;
  /** How long an unfilled limit may stand, in market minutes. */
  limitExpire: number;
  /** Worst price a stop will accept before abandoning the order. */
  maxSlippagePct: number;
};

export type Settings = {
  autoTrade: boolean;
  riskPerTrade: number;
  maxPositions: number;
  minConfidence: number;
  stopPct: number;
  rewardMultiple: number;
  useKelly: boolean;
  kellyCap: number;
  timeStop: number;
  scanSeconds: number;
  dailyWithdrawCap: number;
  sources: Record<SourceId, SourceSetting>;
  /**
   * The mesh registry — one setting per source in `mesh-types`. Nested here so
   * `sanitizeSettings` can clamp it in place, and optional because a book saved
   * before the mesh existed only carries `sources`.
   */
  mesh?: Record<MeshSourceId, MeshSourceSetting>;
  /** Defensive vetoes the mesh countersigns; see the veto board view. */
  v: {
    /** Advise against a new long into a one-sided crowd. */
    vetoNarrative: boolean;
    /** Stand down while a fresh headline is still being repriced. */
    vetoNews: boolean;
    /** Treat a thin book as a knockout on new risk. */
    vetoThin: boolean;
    /** Half size when index and sector lean against the entry. */
    halfAgainst: boolean;
  };
  /** How the order desk is allowed to reach the venue. */
  orders: OrderSettings;
};

export type SymbolState = {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  mu: number;
  sigma: number;
  bias: number;
  hist: number[];
};

export type QuoteSignal = {
  action: Side;
  confidence: number;
  note: string;
};

export type SignalSet = {
  symbol: string;
  invo: QuoteSignal;
  finviz: QuoteSignal;
  simul8or: QuoteSignal;
  ensemble: QuoteSignal;
};

export type Position = {
  id: string;
  symbol: string;
  side: BookSide;
  qty: number;
  entry: number;
  stop: number;
  target: number;
  openedAt: number;
  confidence: number;
  features: number[];
};

export type Trade = {
  id: string;
  symbol: string;
  side: BookSide;
  qty: number;
  entry: number;
  exit: number;
  pnl: number;
  openedAt: number;
  closedAt: number;
  reason: ExitReason;
  confidence: number;
};

export type LedgerEntry = {
  id: string;
  wall: number;
  kind: LedgerKind;
  amount: number;
  note: string;
  balanceAfter: number;
};

export type Activity = {
  id: string;
  ts: number;
  tone: Tone;
  text: string;
};

export type CurvePoint = { m: number; equity: number };
export type HitPoint = { m: number; rate: number };
export type Note = { m: number; text: string };

export type ModelState = {
  weights: number[];
  samples: number;
  correct: number;
  recent: boolean[];
  hits: HitPoint[];
  notes: Note[];
  adaptLeft: number;
};

export type Book = {
  seed: number;
  minute: number;
  cash: number;
  symbols: SymbolState[];
  positions: Position[];
  trades: Trade[];
  ledger: LedgerEntry[];
  signals: Record<string, SignalSet>;
  curve: CurvePoint[];
  model: ModelState;
  activity: Activity[];
  dayOpenEquity: number;
  settings: Settings;
  pinHash: string | null;
  lastWall: number;
  /** The last mesh pass: the board the desk read, plus the feed health table. */
  board: Board | null;
  statuses: MeshSourceStatus[];
  /** Per-source wake windows, budgets and last readouts. */
  scratch: MeshScratchShape;
  /** Executed fills with their TCA, newest first. */
  fills: FillLog[];
  /** Working orders the desk has placed but not yet filled. */
  working: WorkingOrder[];
  /** Orders the desk refused, with the rule that refused them. */
  rejects: RejectLog[];
  /** The desk's own execution settings: order type, price, cost. */
  orders: Settings["orders"];
};

/** Structural twin of the mesh scratch, kept local to avoid a cycle. */
export type MeshScratchShape = {
  windows: Partial<Record<MeshSourceId, number>>;
  airtime: Partial<Record<MeshSourceId, number>>;
  last: Partial<Record<MeshSourceId, SourceReadoutShape>>;
  dispatched: number;
  spent: number;
  minute: number;
};

type SourceReadoutShape = {
  source: MeshSourceId;
  symbol: string;
  bias: number;
  strength: number;
  reliability: number;
  note: string;
  at: number;
};

export type WorkingOrder = {
  id: string;
  symbol: string;
  side: BookSide;
  qty: number;
  /** The limit price for LIMIT / STOP_LIMIT entries. */
  limit: number;
  /** Stop trigger for STOP / STOP_LIMIT; null for a plain limit. */
  trigger: number | null;
  kind: "ENTRY" | "EXIT";
  placedAt: number;
  expiresAt: number;
  stop: number;
  target: number;
  confidence: number;
  tif: TimeInForce;
};

export type RejectLog = {
  id: string;
  ts: number;
  symbol: string;
  rule: string;
  detail: string;
};

export const PAPER_CASH = 25000;

export const SOURCE_META: Record<SourceId, { label: string; role: string; href: string }> = {
  INVO: {
    label: "Invo",
    role: "Copy-flow. Crowd lean from recent prints, the way a social book clusters.",
    href: "https://app.invoapp.com/",
  },
  FINVIZ: {
    label: "Finviz",
    role: "Screen. Trend and RSI band, the filter a technician would save.",
    href: "https://finviz.com/",
  },
  SIMUL8OR: {
    label: "Simul8or",
    role: "Walk-forward. The live model, scored every minute and corrected after each close.",
    href: "https://simul8or.com/",
  },
};

export const defaultSettings: Settings = {
  autoTrade: true,
  riskPerTrade: 0.02,
  maxPositions: 4,
  minConfidence: 0.46,
  stopPct: 0.012,
  rewardMultiple: 1.8,
  useKelly: true,
  kellyCap: 0.12,
  timeStop: 28,
  scanSeconds: 2,
  dailyWithdrawCap: 10000,
  sources: {
    INVO: { enabled: true, weight: 1 },
    FINVIZ: { enabled: true, weight: 1.1 },
    SIMUL8OR: { enabled: true, weight: 1 },
  },
  mesh: emptySourceSettings(),
  v: { vetoNarrative: false, vetoNews: false, vetoThin: false, halfAgainst: false },
  orders: {
    type: "BRACKET",
    tif: "DAY",
    feeBps: 1,
    halfSpreadBps: 1.2,
    slipGuardBps: 40,
    limitExpire: 12,
    maxSlippagePct: 0.006,
  },
};

/**
 * What a fresh install turns off, and the only switch that protects the whole
 * ordinary book.
 *
 * Fading a crowd is a research decision with costs of its own — the bill is
 * never only the fill. It ships off, with a measured panel in Settings that
 * reports crowding, spread and size rather than a headline number, so turning
 * it on is an informed choice about a few basis points instead of a tick that
 * looks like a strategy.
 */
export const DEFENSIVE_DEFAULT = "off" as const;

export function freshSettings(): Settings {
  return { ...defaultSettings, mesh: emptySourceSettings(), v: { ...defaultSettings.v }, orders: { ...defaultSettings.orders } };
}
