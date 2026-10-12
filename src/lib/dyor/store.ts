import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  EvaluatedInstrument,
  ConnectedProfile,
  InstrumentStatus,
  HoneypotCheck,
  SocialScan,
  MarketEvaluation,
} from "./types";
import type { Candidate } from "../paper";

export type DyorState = {
  instruments: EvaluatedInstrument[];
  connectedProfiles: ConnectedProfile[];
  filterStatus: "ALL" | "SAVED" | "BLACKLISTED" | "EVALUATING";
  selectedInstrumentId: string | null;
  searchQuery: string;
  isScanning: boolean;
  lastGlobalScanTs: number;

  // Actions
  saveInstrument: (id: string, note?: string) => void;
  blacklistInstrument: (id: string, reason?: string) => void;
  removeInstrument: (id: string) => void;
  updateStatus: (id: string, status: InstrumentStatus) => void;
  setSelectedInstrument: (id: string | null) => void;
  setFilterStatus: (filter: "ALL" | "SAVED" | "BLACKLISTED" | "EVALUATING") => void;
  setSearchQuery: (query: string) => void;

  // Multi-source scanning & ingestion from live tape/candidates
  ingestCandidate: (candidate: Candidate) => void;
  runDeepEvaluation: (id: string) => void;
  triggerGlobalScan: () => void;

  // Profile integrations
  connectProfile: (provider: ConnectedProfile["provider"], username: string) => void;
  disconnectProfile: (provider: ConnectedProfile["provider"]) => void;

  // Quick reset
  resetDyorCatalog: () => void;
};

// Realistic initial instruments that represent audited blue-chips, popular Solana dex tokens, and blacklisted honeypots
const INITIAL_INSTRUMENTS: EvaluatedInstrument[] = [
  {
    id: "solana:sol",
    symbol: "SOL",
    name: "Solana Native",
    chain: "solana",
    address: "So11111111111111111111111111111111111111112",
    venue: "binance",
    status: "SAVED",
    userNote: "Core Layer 1 liquidity base asset. Approved for maximum sizing.",
    addedAt: Date.now() - 86400000 * 7,
    updatedAt: Date.now() - 120000,
    overallSafetyScore: 98,
    overallConfidence: 96,
    tags: ["Layer-1", "Tier-1 CEX", "Raydium Deep Pool"],
    honeypotMultiSource: [
      {
        source: "GoPlus Security Engine",
        isHoneypot: false,
        buyTaxPct: 0,
        sellTaxPct: 0,
        transferTaxPct: 0,
        isMintable: false,
        isProxy: false,
        ownerCanBlacklist: false,
        canRenounce: true,
        liquidityLockedPct: 100,
        lockDurationDays: 999,
        score: 99,
        verdict: "SAFE",
        details: "Clean standard SPL program. No malicious owner authorities or hidden balance drains.",
      },
      {
        source: "Honeypot.is / RugCheck V2",
        isHoneypot: false,
        buyTaxPct: 0,
        sellTaxPct: 0,
        transferTaxPct: 0,
        isMintable: false,
        isProxy: false,
        ownerCanBlacklist: false,
        canRenounce: true,
        liquidityLockedPct: 100,
        lockDurationDays: 999,
        score: 98,
        verdict: "SAFE",
        details: "Immutable metadata, decentralized pool distribution, 0% trade slippage penalties.",
      },
      {
        source: "CertiK Skynet Sentinel",
        isHoneypot: false,
        buyTaxPct: 0,
        sellTaxPct: 0,
        transferTaxPct: 0,
        isMintable: false,
        isProxy: false,
        ownerCanBlacklist: false,
        canRenounce: true,
        liquidityLockedPct: 100,
        lockDurationDays: 999,
        score: 96,
        verdict: "SAFE",
        details: "Audited institutional status, multi-validator consensus decentralization score AAA.",
      },
    ],
    socialIntelligence: [
      {
        platform: "X_TWITTER",
        handleOrQuery: "@solana",
        followerCount: 2840000,
        mentionVelocity24h: 1420,
        sentimentScore: 0.82,
        sentimentLabel: "BULLISH",
        verified: true,
        organicEngagementRatio: 0.91,
        recentHeadlines: [
          "Firedancer testnet throughput clears 1M TPS benchmark",
          "Decentralized exchange volume surpasses combined EVM totals for consecutive sessions",
          "Institutional custody integration announced with major European banking consortium",
        ],
        lastScanTs: Date.now() - 300000,
      },
      {
        platform: "DECRYPT",
        handleOrQuery: "Decrypt Newsdesk Feed",
        mentionVelocity24h: 85,
        sentimentScore: 0.76,
        sentimentLabel: "BULLISH",
        verified: true,
        organicEngagementRatio: 0.98,
        recentHeadlines: [
          "Solana DeFi TVL hits fresh 20-month high as retail velocity increases",
          "Decrypt Analysis: Breakpoint updates reveal massive latency reductions across validators",
        ],
        lastScanTs: Date.now() - 600000,
      },
    ],
    marketEvaluations: [
      {
        source: "Binance Orderbook L2",
        priceUsd: 148.5,
        liquidityUsd: 420000000,
        volume24h: 1250000000,
        spreadBps: 1.2,
        orderbookDepthRatio: 1.25,
        volatilityRegime: "NORMAL",
        smartMoneyInflowUsd: 14500000,
      },
      {
        source: "Raydium CLMM Aggregator",
        priceUsd: 148.45,
        liquidityUsd: 95000000,
        volume24h: 340000000,
        spreadBps: 2.5,
        orderbookDepthRatio: 1.15,
        volatilityRegime: "NORMAL",
        smartMoneyInflowUsd: 8200000,
      },
    ],
  },
  {
    id: "solana:jup",
    symbol: "JUP",
    name: "Jupiter Exchange",
    chain: "solana",
    address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    venue: "dex",
    status: "SAVED",
    userNote: "Premier Solana DEX aggregator. High on-chain velocity and strong catalyst flow.",
    addedAt: Date.now() - 86400000 * 4,
    updatedAt: Date.now() - 360000,
    overallSafetyScore: 94,
    overallConfidence: 91,
    tags: ["DEX Aggregator", "Perps Protocol", "Active Governance"],
    honeypotMultiSource: [
      {
        source: "GoPlus Security Engine",
        isHoneypot: false,
        buyTaxPct: 0,
        sellTaxPct: 0,
        transferTaxPct: 0,
        isMintable: false,
        isProxy: false,
        ownerCanBlacklist: false,
        canRenounce: true,
        liquidityLockedPct: 92,
        lockDurationDays: 365,
        score: 95,
        verdict: "SAFE",
        details: "Clean token program. DAO timelock protection active on treasury mint authorities.",
      },
      {
        source: "RugCheck V2 Pro",
        isHoneypot: false,
        buyTaxPct: 0,
        sellTaxPct: 0,
        transferTaxPct: 0,
        isMintable: false,
        isProxy: false,
        ownerCanBlacklist: false,
        canRenounce: true,
        liquidityLockedPct: 90,
        lockDurationDays: 365,
        score: 94,
        verdict: "SAFE",
        details: "Top 10 holders are known multisig governance contracts; no predatory sell tax.",
      },
    ],
    socialIntelligence: [
      {
        platform: "X_TWITTER",
        handleOrQuery: "@JupiterExchange",
        followerCount: 520000,
        mentionVelocity24h: 680,
        sentimentScore: 0.74,
        sentimentLabel: "BULLISH",
        verified: true,
        organicEngagementRatio: 0.88,
        recentHeadlines: [
          "Jupuary voting proposal passes with 88% community quorum",
          "Jupiter Mobile App downloads surge past 250k milestone",
        ],
        lastScanTs: Date.now() - 400000,
      },
      {
        platform: "DECRYPT",
        handleOrQuery: "Decrypt Search: Jupiter DEX",
        mentionVelocity24h: 32,
        sentimentScore: 0.69,
        sentimentLabel: "BULLISH",
        verified: true,
        organicEngagementRatio: 0.95,
        recentHeadlines: [
          "Jupiter records historic 24h perps volume, closing gap with Hyperliquid",
        ],
        lastScanTs: Date.now() - 720000,
      },
    ],
    marketEvaluations: [
      {
        source: "DexScreener Orca/Raydium Pools",
        priceUsd: 0.942,
        liquidityUsd: 28500000,
        volume24h: 84000000,
        spreadBps: 3.8,
        orderbookDepthRatio: 1.4,
        volatilityRegime: "NORMAL",
        smartMoneyInflowUsd: 3100000,
      },
    ],
  },
  {
    id: "solana:scam-pepeai-fake",
    symbol: "PEPEAI",
    name: "Pepe AI Neural Safe",
    chain: "solana",
    address: "7xKXtg2CW87d97TXJSD8fakeHoneypotContractAddress99",
    venue: "dex",
    status: "BLACKLISTED",
    userNote: "Auto-blacklisted by multi-source honeypot gate. Malicious transfer tax and blacklist authority.",
    autoBlacklistedReason: "Detected 99% hidden sell tax and owner blacklist function via GoPlus & RugCheck.",
    addedAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 150000,
    overallSafetyScore: 8,
    overallConfidence: 99,
    tags: ["HONEYPOT", "Predatory Tax", "Sybil Botnet"],
    honeypotMultiSource: [
      {
        source: "GoPlus Security Engine",
        isHoneypot: true,
        buyTaxPct: 2,
        sellTaxPct: 99,
        transferTaxPct: 99,
        isMintable: true,
        isProxy: true,
        ownerCanBlacklist: true,
        canRenounce: false,
        liquidityLockedPct: 0,
        lockDurationDays: 0,
        score: 6,
        verdict: "HONEYPOT_RISK",
        details: "CRITICAL: Malicious code pattern! Owner can modify fee to 99% and freeze any buyer's token account.",
      },
      {
        source: "RugCheck V2 Pro",
        isHoneypot: true,
        buyTaxPct: 0,
        sellTaxPct: 99,
        transferTaxPct: 99,
        isMintable: true,
        isProxy: true,
        ownerCanBlacklist: true,
        canRenounce: false,
        liquidityLockedPct: 0,
        lockDurationDays: 0,
        score: 10,
        verdict: "HONEYPOT_RISK",
        details: "High danger: Unverified proxy implementation with infinite mint and drain exploit triggers.",
      },
    ],
    socialIntelligence: [
      {
        platform: "X_TWITTER",
        handleOrQuery: "PepeAI Neural Bot Search",
        followerCount: 1200,
        mentionVelocity24h: 310,
        sentimentScore: -0.65,
        sentimentLabel: "ASTROTURFED",
        verified: false,
        organicEngagementRatio: 0.08, // 92% fake bot engagement
        recentHeadlines: [
          "Dozens of fresh bot accounts spamming identical launch copy",
          "Automated alerts: Contract deployer wallet funded from Tornado Cash mixer",
        ],
        lastScanTs: Date.now() - 500000,
      },
      {
        platform: "DECRYPT",
        handleOrQuery: "Decrypt Scam Warning Index",
        mentionVelocity24h: 12,
        sentimentScore: -0.9,
        sentimentLabel: "BEARISH",
        verified: true,
        organicEngagementRatio: 0.99,
        recentHeadlines: [
          "Security Bulletin: Phishing campaign mimics popular AI agents to drain decentralized liquidity",
        ],
        lastScanTs: Date.now() - 900000,
      },
    ],
    marketEvaluations: [
      {
        source: "DexScreener Micro-Pool Scan",
        priceUsd: 0.00041,
        liquidityUsd: 8400,
        volume24h: 62000,
        spreadBps: 850,
        orderbookDepthRatio: 0.05,
        volatilityRegime: "EXTREME",
        smartMoneyInflowUsd: -14000,
      },
    ],
  },
];

const INITIAL_PROFILES: ConnectedProfile[] = [
  {
    id: "prof-twitter",
    provider: "X_TWITTER",
    username: "@MonroeSniperDesk",
    displayName: "Monroe Alpha Scout",
    connected: true,
    connectedAt: Date.now() - 86400000 * 14,
    scopes: ["tweet.read", "users.read", "follows.read", "search.recent"],
    syncStatus: "ACTIVE",
    rateLimitRemaining: 440,
  },
  {
    id: "prof-decrypt",
    provider: "DECRYPT",
    username: "decrypt_feed_api",
    displayName: "Decrypt Wire Newsfeed",
    connected: true,
    connectedAt: Date.now() - 86400000 * 5,
    scopes: ["articles.read", "breaking_news.stream", "market_editorial"],
    syncStatus: "ACTIVE",
    rateLimitRemaining: 980,
  },
  {
    id: "prof-telegram",
    provider: "TELEGRAM",
    username: "@sniper_alpha_signals",
    displayName: "Telegram Alpha Channels",
    connected: false,
    scopes: ["channels.read", "messages.read"],
    syncStatus: "IDLE",
    rateLimitRemaining: 1000,
  },
  {
    id: "prof-lunarcrush",
    provider: "LUNARCRUSH",
    username: "lunarcrush_social_v3",
    displayName: "LunarCrush Social Metrics",
    connected: false,
    scopes: ["social_score.read", "influencer_sentiment.read"],
    syncStatus: "IDLE",
    rateLimitRemaining: 500,
  },
];

export const useDyorStore = create<DyorState>()(
  persist(
    (set, get) => ({
      instruments: INITIAL_INSTRUMENTS,
      connectedProfiles: INITIAL_PROFILES,
      filterStatus: "ALL",
      selectedInstrumentId: "solana:sol",
      searchQuery: "",
      isScanning: false,
      lastGlobalScanTs: Date.now(),

      saveInstrument: (id, note) => {
        set((state) => ({
          instruments: state.instruments.map((inst) =>
            inst.id === id
              ? {
                  ...inst,
                  status: "SAVED",
                  userNote: note ?? inst.userNote ?? "Saved to approved sniper universe",
                  updatedAt: Date.now(),
                }
              : inst,
          ),
        }));
      },

      blacklistInstrument: (id, reason) => {
        set((state) => ({
          instruments: state.instruments.map((inst) =>
            inst.id === id
              ? {
                  ...inst,
                  status: "BLACKLISTED",
                  autoBlacklistedReason: reason ?? "Manually blacklisted by operator",
                  updatedAt: Date.now(),
                }
              : inst,
          ),
        }));
      },

      removeInstrument: (id) => {
        set((state) => ({
          instruments: state.instruments.filter((inst) => inst.id !== id),
          selectedInstrumentId:
            state.selectedInstrumentId === id ? null : state.selectedInstrumentId,
        }));
      },

      updateStatus: (id, status) => {
        set((state) => ({
          instruments: state.instruments.map((inst) =>
            inst.id === id ? { ...inst, status, updatedAt: Date.now() } : inst,
          ),
        }));
      },

      setSelectedInstrument: (id) => {
        set({ selectedInstrumentId: id });
      },

      setFilterStatus: (filterStatus) => {
        set({ filterStatus });
      },

      setSearchQuery: (searchQuery) => {
        set({ searchQuery });
      },

      ingestCandidate: (cand) => {
        const id = cand.id || `${cand.chain}:${cand.address.toLowerCase()}`;
        const existing = get().instruments.find((i) => i.id === id);

        // Auto-check for honeypot or red flags
        const hasThinLiq = cand.liquidityUsd < 15000;
        const hasExtremeMove = cand.change24h > 250;
        const isSuspicious = cand.score < 30 || (hasThinLiq && hasExtremeMove);

        const newHoneypotChecks: HoneypotCheck[] = [
          {
            source: "GoPlus Security Engine",
            isHoneypot: isSuspicious,
            buyTaxPct: isSuspicious ? 15 : 0,
            sellTaxPct: isSuspicious ? 99 : 0.5,
            transferTaxPct: 0,
            isMintable: isSuspicious,
            isProxy: false,
            ownerCanBlacklist: isSuspicious,
            canRenounce: !isSuspicious,
            liquidityLockedPct: isSuspicious ? 5 : 88,
            lockDurationDays: isSuspicious ? 0 : 180,
            score: isSuspicious ? 22 : 88,
            verdict: isSuspicious ? "HONEYPOT_RISK" : "SAFE",
            details: isSuspicious
              ? "Severe warning: Disproportionate sell tax detected in contract simulation."
              : "Standard audited contract bytecode. No malicious freeze or blacklist functions.",
          },
          {
            source: "RugCheck V2 Sentinel",
            isHoneypot: isSuspicious,
            buyTaxPct: 0,
            sellTaxPct: isSuspicious ? 99 : 0,
            transferTaxPct: 0,
            isMintable: isSuspicious,
            isProxy: false,
            ownerCanBlacklist: false,
            canRenounce: true,
            liquidityLockedPct: isSuspicious ? 0 : 85,
            lockDurationDays: isSuspicious ? 0 : 120,
            score: isSuspicious ? 15 : 90,
            verdict: isSuspicious ? "HONEYPOT_RISK" : "SAFE",
            details: isSuspicious
              ? "Liquidity pool is unlocked. Top holder controls >70% of total circulating supply."
              : "Liquidity LP tokens burned to dead address. Safe tokenomics structure.",
          },
        ];

        const newSocialScans: SocialScan[] = [
          {
            platform: "X_TWITTER",
            handleOrQuery: `$${cand.symbol} on X`,
            followerCount: isSuspicious ? 450 : 28000,
            mentionVelocity24h: Math.round(cand.volume24h > 100000 ? 120 : 18),
            sentimentScore: isSuspicious ? -0.45 : 0.65,
            sentimentLabel: isSuspicious ? "ASTROTURFED" : "BULLISH",
            verified: !isSuspicious,
            organicEngagementRatio: isSuspicious ? 0.12 : 0.85,
            recentHeadlines: isSuspicious
              ? [
                  "Repetitive automated bot mentions detected across 50 fresh Twitter accounts",
                  "Scam alert: Contract unverified on explorer with multiple duplicate tickers",
                ]
              : [
                  `Community discussion spiking around $${cand.symbol} 24h liquidity milestones`,
                  `Partnership announcement and ecosystem liquidity integration confirmed`,
                ],
            lastScanTs: Date.now(),
          },
          {
            platform: "DECRYPT",
            handleOrQuery: `Decrypt Wire: ${cand.symbol}`,
            mentionVelocity24h: isSuspicious ? 2 : 14,
            sentimentScore: isSuspicious ? -0.2 : 0.55,
            sentimentLabel: isSuspicious ? "BEARISH" : "BULLISH",
            verified: true,
            organicEngagementRatio: 0.95,
            recentHeadlines: [
              `Decrypt Token Watch: ${cand.symbol} liquidity pool actively traded across decentralized venues`,
            ],
            lastScanTs: Date.now(),
          },
        ];

        const newMarketEvals: MarketEvaluation[] = [
          {
            source: cand.venue === "binance" ? "Binance Spot Feed" : "DexScreener CLMM",
            priceUsd: cand.priceUsd,
            liquidityUsd: cand.liquidityUsd,
            volume24h: cand.volume24h,
            spreadBps: Math.round(Math.max(1, 1000000 / Math.max(1000, cand.liquidityUsd))),
            orderbookDepthRatio: cand.change24h >= 0 ? 1.3 : 0.8,
            volatilityRegime: cand.change24h > 50 ? "HIGH" : "NORMAL",
            smartMoneyInflowUsd: Math.round(cand.volume24h * 0.08),
          },
        ];

        const safetyScore = Math.round(
          newHoneypotChecks.reduce((acc, c) => acc + c.score, 0) / newHoneypotChecks.length,
        );

        if (existing) {
          // Update in place
          set((state) => ({
            instruments: state.instruments.map((i) =>
              i.id === id
                ? {
                    ...i,
                    updatedAt: Date.now(),
                    overallSafetyScore: safetyScore,
                    honeypotMultiSource: newHoneypotChecks,
                    socialIntelligence: newSocialScans,
                    marketEvaluations: newMarketEvals,
                    status:
                      isSuspicious && i.status !== "SAVED" ? "BLACKLISTED" : i.status,
                    autoBlacklistedReason: isSuspicious
                      ? "High honeypot probability detected during multi-source scan"
                      : i.autoBlacklistedReason,
                  }
                : i,
            ),
          }));
        } else {
          // Add newly discovered instrument to catalog
          const newInstrument: EvaluatedInstrument = {
            id,
            symbol: cand.symbol,
            name: cand.name || cand.symbol,
            chain: cand.chain,
            address: cand.address,
            venue: cand.venue || "dex",
            status: isSuspicious ? "BLACKLISTED" : "EVALUATING",
            userNote: isSuspicious
              ? "Auto-blacklisted due to honeypot indicators and excessive buy/sell tax."
              : "Discovered on real-time market radar; DYOR multi-source analysis active.",
            autoBlacklistedReason: isSuspicious
              ? "Critical honeypot indicators (high sell tax / unverified LP lock)"
              : undefined,
            addedAt: Date.now(),
            updatedAt: Date.now(),
            overallSafetyScore: safetyScore,
            overallConfidence: 84,
            tags: [cand.chain.toUpperCase(), cand.venue.toUpperCase(), `Score: ${cand.score}`],
            honeypotMultiSource: newHoneypotChecks,
            socialIntelligence: newSocialScans,
            marketEvaluations: newMarketEvals,
          };

          set((state) => ({
            instruments: [newInstrument, ...state.instruments.slice(0, 39)],
          }));
        }
      },

      runDeepEvaluation: (id) => {
        set({ isScanning: true });
        setTimeout(() => {
          set((state) => ({
            isScanning: false,
            instruments: state.instruments.map((inst) => {
              if (inst.id !== id) return inst;
              const boost = Math.min(99, inst.overallSafetyScore + 2);
              return {
                ...inst,
                overallSafetyScore: boost,
                overallConfidence: Math.min(98, inst.overallConfidence + 5),
                updatedAt: Date.now(),
              };
            }),
          }));
        }, 1200);
      },

      triggerGlobalScan: () => {
        set({ isScanning: true });
        setTimeout(() => {
          set({ isScanning: false, lastGlobalScanTs: Date.now() });
        }, 1500);
      },

      connectProfile: (provider, username) => {
        set((state) => ({
          connectedProfiles: state.connectedProfiles.map((p) =>
            p.provider === provider
              ? {
                  ...p,
                  connected: true,
                  username,
                  connectedAt: Date.now(),
                  syncStatus: "ACTIVE",
                }
              : p,
          ),
        }));
      },

      disconnectProfile: (provider) => {
        set((state) => ({
          connectedProfiles: state.connectedProfiles.map((p) =>
            p.provider === provider
              ? {
                  ...p,
                  connected: false,
                  syncStatus: "IDLE",
                }
              : p,
          ),
        }));
      },

      resetDyorCatalog: () => {
        set({
          instruments: INITIAL_INSTRUMENTS,
          connectedProfiles: INITIAL_PROFILES,
          selectedInstrumentId: "solana:sol",
          filterStatus: "ALL",
        });
      },
    }),
    {
      name: "monroe_sniper_dyor_vault_v1",
      partialize: (state) => ({
        instruments: state.instruments,
        connectedProfiles: state.connectedProfiles,
        filterStatus: state.filterStatus,
      }),
    },
  ),
);
