export type InstrumentStatus = "SAVED" | "BLACKLISTED" | "EVALUATING" | "WATCHLIST";

export type HoneypotCheck = {
  source: string;
  isHoneypot: boolean;
  buyTaxPct: number;
  sellTaxPct: number;
  transferTaxPct: number;
  isMintable: boolean;
  isProxy: boolean;
  ownerCanBlacklist: boolean;
  canRenounce: boolean;
  liquidityLockedPct: number;
  lockDurationDays: number;
  score: number; // 0-100 safety score
  verdict: "SAFE" | "SUSPICIOUS" | "HONEYPOT_RISK" | "HIGH_TAX" | "UNVERIFIED";
  details: string;
};

export type SocialScan = {
  platform: "X_TWITTER" | "DECRYPT" | "TELEGRAM" | "DISCORD" | "COINGECKO";
  handleOrQuery: string;
  followerCount?: number;
  mentionVelocity24h: number; // Mentions per hour
  sentimentScore: number; // -1.0 to +1.0
  sentimentLabel: "BULLISH" | "NEUTRAL" | "BEARISH" | "ASTROTURFED";
  verified: boolean;
  organicEngagementRatio: number; // 0-1 (low ratio implies botting)
  recentHeadlines: string[];
  lastScanTs: number;
};

export type MarketEvaluation = {
  source: string;
  priceUsd: number;
  liquidityUsd: number;
  volume24h: number;
  spreadBps: number;
  orderbookDepthRatio: number; // Buy vs sell depth
  volatilityRegime: "LOW" | "NORMAL" | "HIGH" | "EXTREME";
  smartMoneyInflowUsd: number;
};

export type EvaluatedInstrument = {
  id: string; // e.g. solana:address or binance:symbol
  symbol: string;
  name: string;
  chain: string;
  address: string;
  venue: "binance" | "dex" | "cross" | "fx";
  status: InstrumentStatus;
  userNote?: string;
  addedAt: number;
  updatedAt: number;
  overallSafetyScore: number; // 0-100
  overallConfidence: number; // 0-100
  honeypotMultiSource: HoneypotCheck[];
  socialIntelligence: SocialScan[];
  marketEvaluations: MarketEvaluation[];
  tags: string[];
  autoBlacklistedReason?: string;
};

export type ConnectionProvider = "X_TWITTER" | "DECRYPT" | "TELEGRAM" | "LUNARCRUSH" | "RSS_FEED";

export type ConnectedProfile = {
  id: string;
  provider: "X_TWITTER" | "DECRYPT" | "TELEGRAM" | "DISCORD" | "LUNARCRUSH" | "RSS_FEED";
  username: string;
  displayName: string;
  connected: boolean;
  connectedAt?: number;
  scopes: string[];
  syncStatus: "ACTIVE" | "IDLE" | "ERROR";
  rateLimitRemaining: number | null;
  /** Real verification state — a connection only counts when verified live. */
  verified: boolean;
  verifiedAt?: number | null;
  lastCheckNote?: string | null;
  /** User-owned credential, this browser only — never sent to any database. */
  secret?: string;
  /** Telegram alerts target chat. */
  chatId?: string;
  /** Custom RSS feed URL. */
  feedUrl?: string;
};
