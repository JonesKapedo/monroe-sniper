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
import type { SecurityReport } from "../data/market-sources";

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
  /** Replace heuristic checks with a real dual-provider security report. */
  attachSecurity: (id: string, report: SecurityReport) => void;
  triggerGlobalScan: () => void;

  // Profile integrations (all verified live — no hardcoded connections)
  stageCredential: (provider: ConnectedProfile["provider"], secret: string, extra?: { chatId?: string; feedUrl?: string }) => void;
  verifyConnection: (provider: ConnectedProfile["provider"]) => Promise<{ ok: boolean; note: string }>;
  disconnectProfile: (provider: ConnectedProfile["provider"]) => void;
  /** Pull real X mentions + LunarCrush socials into an instrument's panel. */
  pullLiveSocials: (id: string) => Promise<{ ok: boolean; note: string }>;
  /** Verified Telegram bot credentials for trade alerts (browser only). */
  telegramCreds: () => { token: string; chatId: string } | null;
  /** Verified Discord incoming-webhook URL for trade alerts (browser only). */
  discordWebhook: () => string | null;

  // Quick reset
  resetDyorCatalog: () => void;
};

// Live-only catalog: starts empty. Instruments enter only via real flows:
// - global/tape search (DexScreener live pairs) -> ingestCandidate (live tape numbers)
// - verifyInstrument dual-provider on-chain audit -> attachSecurity (live report)
// - pullLiveSocials (verified X / LunarCrush credentials) -> live socials
// Nothing here is seeded, sampled, or fabricated.
const INITIAL_INSTRUMENTS: EvaluatedInstrument[] = [];

const INITIAL_PROFILES: ConnectedProfile[] = [
  {
    id: "prof-twitter",
    provider: "X_TWITTER",
    username: "",
    displayName: "X Mentions (bring your own bearer token)",
    connected: false,
    scopes: ["search.recent"],
    syncStatus: "IDLE",
    rateLimitRemaining: null,
    verified: false,
    verifiedAt: null,
    lastCheckNote: "Needs your X API bearer token — verified live via users/me.",
  },
  {
    id: "prof-decrypt",
    provider: "DECRYPT",
    username: "decrypt-builtin-wire",
    displayName: "Decrypt Wire (built-in, no key)",
    connected: false,
    scopes: ["headlines.read"],
    syncStatus: "IDLE",
    rateLimitRemaining: null,
    verified: false,
    verifiedAt: null,
    lastCheckNote: "Free RSS wire — verify checks it is reachable right now.",
  },
  {
    id: "prof-telegram",
    provider: "TELEGRAM",
    username: "",
    displayName: "Telegram Alerts (free bot)",
    connected: false,
    scopes: ["alerts.send"],
    syncStatus: "IDLE",
    rateLimitRemaining: null,
    verified: false,
    verifiedAt: null,
    lastCheckNote: "Create a bot in BotFather, verify it, get trade alerts.",
  },
  {
    id: "prof-discord",
    provider: "DISCORD",
    username: "",
    displayName: "Discord Alerts (incoming webhook)",
    connected: false,
    scopes: ["alerts.send"],
    syncStatus: "IDLE",
    rateLimitRemaining: null,
    verified: false,
    verifiedAt: null,
    lastCheckNote: "Channel settings → Integrations → Webhooks → copy URL to verify.",
  },
  {
    id: "prof-lunarcrush",
    provider: "LUNARCRUSH",
    username: "",
    displayName: "LunarCrush Social (free API key)",
    connected: false,
    scopes: ["social.read"],
    syncStatus: "IDLE",
    rateLimitRemaining: null,
    verified: false,
    verifiedAt: null,
    lastCheckNote: "Free key from lunarcrush.com — verified live before use.",
  },
  {
    id: "prof-rss",
    provider: "RSS_FEED",
    username: "",
    displayName: "Custom RSS Wire (any feed URL)",
    connected: false,
    scopes: ["headlines.read"],
    syncStatus: "IDLE",
    rateLimitRemaining: null,
    verified: false,
    verifiedAt: null,
    lastCheckNote: "Paste any RSS/Atom URL — verified by fetching it now.",
  },
];

export const useDyorStore = create<DyorState>()(
  persist(
    (set, get) => ({
      instruments: INITIAL_INSTRUMENTS,
      connectedProfiles: INITIAL_PROFILES,
      filterStatus: "ALL",
      selectedInstrumentId: null,
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

        // Live-tape pre-screen only: low score + thin liquidity + extreme move.
        // No on-chain claims are made here — a real dual-provider audit runs
        // via Search / Re-Audit (verifyInstrument -> attachSecurity).
        const hasThinLiq = cand.liquidityUsd < 15000;
        const hasExtremeMove = cand.change24h > 250;
        const isSuspicious = cand.score < 30 || (hasThinLiq && hasExtremeMove);

        const preScreen: HoneypotCheck = {
          source: "Tape pre-screen (unverified — run Search for a real on-chain audit)",
          isHoneypot: false,
          buyTaxPct: 0,
          sellTaxPct: 0,
          transferTaxPct: 0,
          isMintable: false,
          isProxy: false,
          ownerCanBlacklist: false,
          canRenounce: true,
          liquidityLockedPct: 0,
          lockDurationDays: 0,
          score: isSuspicious ? 20 : 50,
          verdict: "UNVERIFIED",
          details:
            `Live tape snapshot: score ${cand.score}/100, ` +
            `$${Math.round(cand.liquidityUsd).toLocaleString()} liquidity, ` +
            `${cand.change24h.toFixed(1)}% 24h. No contract audit yet.`,
        };

        // Market snapshot uses ONLY live candidate fields. Depth/spread need a
        // live orderbook feed, so they stay 0 until one is wired — the panel
        // shows price, liquidity, volume and regime only.
        const newMarketEvals: MarketEvaluation[] = [
          {
            source: cand.venue === "binance" ? "Binance Spot Feed" : "DexScreener live pair",
            priceUsd: cand.priceUsd,
            liquidityUsd: cand.liquidityUsd,
            volume24h: cand.volume24h,
            spreadBps: 0,
            orderbookDepthRatio: 1,
            volatilityRegime:
              Math.abs(cand.change24h) > 50 ? "HIGH" : Math.abs(cand.change24h) > 15 ? "NORMAL" : "LOW",
            smartMoneyInflowUsd: 0,
          },
        ];

        if (existing) {
          // Refresh live tape numbers; never overwrite a real audit or live socials.
          set((state) => ({
            instruments: state.instruments.map((i) =>
              i.id === id
                ? {
                    ...i,
                    updatedAt: Date.now(),
                    marketEvaluations: newMarketEvals,
                    status:
                      isSuspicious && i.status !== "SAVED" ? "BLACKLISTED" : i.status,
                    autoBlacklistedReason: isSuspicious
                      ? "Live tape risk flags (low score with thin liquidity and extreme move)"
                      : i.autoBlacklistedReason,
                  }
                : i,
            ),
          }));
        } else {
          // Add newly discovered instrument to catalog — unaudited until Search/Re-Audit.
          const newInstrument: EvaluatedInstrument = {
            id,
            symbol: cand.symbol,
            name: cand.name || cand.symbol,
            chain: cand.chain,
            address: cand.address,
            venue: cand.venue === "hyperliquid" || cand.venue === "fx" ? "dex" : cand.venue || "dex",
            status: isSuspicious ? "BLACKLISTED" : "EVALUATING",
            userNote: isSuspicious
              ? "Flagged by live tape risk flags — run Search for a real on-chain audit before sizing."
              : "Discovered on the live market radar — run Search for a real on-chain audit.",
            autoBlacklistedReason: isSuspicious
              ? "Tape risk flags (low score / thin liquidity / extreme move) — unverified"
              : undefined,
            addedAt: Date.now(),
            updatedAt: Date.now(),
            overallSafetyScore: isSuspicious ? 20 : 50,
            overallConfidence: 0,
            tags: [cand.chain.toUpperCase(), cand.venue.toUpperCase(), `Score: ${cand.score}`],
            honeypotMultiSource: [preScreen],
            socialIntelligence: [],
            marketEvaluations: newMarketEvals,
          };

          set((state) => ({
            instruments: [newInstrument, ...state.instruments.slice(0, 39)],
          }));
        }
      },

      runDeepEvaluation: (id) => {
        const inst = get().instruments.find((i) => i.id === id);
        if (!inst || get().isScanning) return;
        set({ isScanning: true });
        void (async () => {
          try {
            // Real dual-provider on-chain audit — replaces any pre-screen.
            const mod = await import("../market.functions");
            const audit = await mod.verifyInstrument({
              data: { chain: inst.chain, address: inst.address },
            });
            if (audit.security) {
              get().attachSecurity(id, audit.security);
            } else {
              set((state) => ({
                instruments: state.instruments.map((i) =>
                  i.id === id
                    ? { ...i, updatedAt: Date.now() }
                    : i,
                ),
              }));
            }
          } catch {
            // Audit failures leave existing state untouched; the panel shows the error.
          } finally {
            set({ isScanning: false });
          }
        })();
      },

      attachSecurity: (id, report) => {
        const pct = (v: number | null) => (v === null ? 0 : Math.round(v * 1000) / 10);
        const hardReject =
          report.honeypot === true ||
          report.ownerCanMint === true ||
          report.ownerCanFreeze === true ||
          report.lpLocked === false ||
          (report.buyTax ?? 0) > 0.15 ||
          (report.sellTax ?? 0) > 0.15;
        const score = report.verified ? 95 : 20;
        const checks: HoneypotCheck[] = [
          {
            source: `GoPlus live audit (${report.providers.includes("GoPlus") ? "responded" : "no data"})`,
            isHoneypot: report.honeypot === true,
            buyTaxPct: pct(report.buyTax),
            sellTaxPct: pct(report.sellTax),
            transferTaxPct: 0,
            isMintable: report.ownerCanMint === true,
            isProxy: false,
            ownerCanBlacklist: report.ownerCanFreeze === true,
            canRenounce: report.ownerCanMint === false,
            liquidityLockedPct: report.lpLocked === true ? 100 : report.lpLocked === false ? 0 : 50,
            lockDurationDays: 0,
            score,
            verdict: report.verified ? "SAFE" : hardReject ? "HONEYPOT_RISK" : "UNVERIFIED",
            details: report.details.length
              ? `Live findings: ${report.details.join("; ")}`
              : "Live audit returned no adverse findings, but evidence is incomplete.",
          },
          {
            source: `honeypot.is live simulation (${report.providers.includes("honeypot.is") ? "responded" : "no data"})`,
            isHoneypot: report.honeypot === true,
            buyTaxPct: pct(report.buyTax),
            sellTaxPct: pct(report.sellTax),
            transferTaxPct: 0,
            isMintable: false,
            isProxy: false,
            ownerCanBlacklist: report.ownerCanFreeze === true,
            canRenounce: true,
            liquidityLockedPct: report.lpLocked === true ? 100 : 0,
            lockDurationDays: 0,
            score,
            verdict: report.verified ? "SAFE" : hardReject ? "HONEYPOT_RISK" : "UNVERIFIED",
            details:
              report.honeypot === true
                ? "Live simulation flags this contract as a honeypot."
                : "Live simulation results reflected in taxes and flags above.",
          },
        ];
        set((state) => ({
          instruments: state.instruments.map((inst) =>
            inst.id === id
              ? {
                  ...inst,
                  honeypotMultiSource: checks,
                  overallSafetyScore: Math.round(checks.reduce((a, c) => a + c.score, 0) / checks.length),
                  overallConfidence: report.verified ? 90 : 40,
                  status: hardReject && inst.status !== "SAVED" ? "BLACKLISTED" : inst.status,
                  autoBlacklistedReason: hardReject
                    ? "Live audit hard reject (honeypot, mint/freeze authority, unlocked LP, or >15% tax)"
                    : inst.autoBlacklistedReason,
                  updatedAt: Date.now(),
                }
              : inst,
          ),
        }));
      },

      triggerGlobalScan: () => {
        if (get().isScanning) return;
        set({ isScanning: true });
        void (async () => {
          try {
            // Re-run the real on-chain audit for every unevaluated instrument.
            const mod = await import("../market.functions");
            const targets = get().instruments.filter((i) => i.status === "EVALUATING");
            for (const inst of targets.slice(0, 10)) {
              try {
                const audit = await mod.verifyInstrument({
                  data: { chain: inst.chain, address: inst.address },
                });
                if (audit.security) get().attachSecurity(inst.id, audit.security);
              } catch {
                // One failed audit never sinks the sweep.
              }
            }
          } finally {
            set({ isScanning: false, lastGlobalScanTs: Date.now() });
          }
        })();
      },

      stageCredential: (provider, secret, extra) => {
        set((state) => ({
          connectedProfiles: state.connectedProfiles.map((p) =>
            p.provider === provider
              ? {
                  ...p,
                  secret,
                  chatId: extra?.chatId ?? p.chatId,
                  feedUrl: extra?.feedUrl ?? p.feedUrl,
                  verified: false,
                  connected: false,
                  syncStatus: "IDLE" as const,
                  lastCheckNote: "Credential staged — verify to connect.",
                }
              : p,
          ),
        }));
      },

      verifyConnection: async (provider) => {
        const profile = get().connectedProfiles.find((p) => p.provider === provider);
        if (!profile) return { ok: false, note: "Unknown provider" };
        set((state) => ({
          connectedProfiles: state.connectedProfiles.map((p) =>
            p.provider === provider ? { ...p, syncStatus: "IDLE" as const, lastCheckNote: "Verifying live…" } : p,
          ),
        }));
        try {
          const mod = await import("../integrations.functions");
          let ok = false;
          let note = "";
          let username = profile.username;
          if (provider === "X_TWITTER") {
            const res = await mod.verifyXToken({ data: { token: profile.secret ?? "" } });
            ok = res.ok;
            note = res.note;
            if (res.username) username = res.username;
          } else if (provider === "TELEGRAM") {
            const res = await mod.verifyTelegramBot({ data: { token: profile.secret ?? "" } });
            ok = res.ok;
            note = res.note;
            if (res.username) username = res.username;
          } else if (provider === "DISCORD") {
            const res = await mod.verifyDiscordWebhook({ data: { url: profile.secret ?? "" } });
            ok = res.ok;
            note = res.note;
            if (res.username) username = res.username;
          } else if (provider === "LUNARCRUSH") {
            const res = await mod.verifyLunarcrushKey({ data: { key: profile.secret ?? "" } });
            ok = res.ok;
            note = res.note;
          } else if (provider === "RSS_FEED") {
            const res = await mod.verifyRssFeed({ data: { url: profile.feedUrl ?? "" } });
            ok = res.ok;
            note = res.note;
          } else if (provider === "DECRYPT") {
            const res = await mod.loadNewsWire();
            ok = res.items.length > 0;
            note = ok ? `Built-in wire reachable — ${res.items.length} live headlines` : "Decrypt wire unreachable right now";
          } else {
            return { ok: false, note: "Discord bots are not supported — use Telegram instead" };
          }
          const now = Date.now();
          set((state) => ({
            connectedProfiles: state.connectedProfiles.map((p) =>
              p.provider === provider
                ? {
                    ...p,
                    verified: ok,
                    connected: ok,
                    username,
                    verifiedAt: ok ? now : p.verifiedAt,
                    connectedAt: ok ? now : p.connectedAt,
                    syncStatus: ok ? ("ACTIVE" as const) : ("ERROR" as const),
                    lastCheckNote: note,
                  }
                : p,
            ),
          }));
          return { ok, note };
        } catch (error) {
          const note = error instanceof Error ? error.message : "Verification failed";
          set((state) => ({
            connectedProfiles: state.connectedProfiles.map((p) =>
              p.provider === provider ? { ...p, verified: false, connected: false, syncStatus: "ERROR" as const, lastCheckNote: note } : p,
            ),
          }));
          return { ok: false, note };
        }
      },

      disconnectProfile: (provider) => {
        set((state) => ({
          connectedProfiles: state.connectedProfiles.map((p) =>
            p.provider === provider
              ? {
                  ...p,
                  verified: false,
                  connected: false,
                  secret: undefined,
                  chatId: undefined,
                  syncStatus: "IDLE" as const,
                  lastCheckNote: "Disconnected — credential cleared from this browser.",
                }
              : p,
          ),
        }));
      },

      pullLiveSocials: async (id) => {
        const state = get();
        const inst = state.instruments.find((i) => i.id === id);
        if (!inst) return { ok: false, note: "Instrument not found" };
        const xProf = state.connectedProfiles.find((p) => p.provider === "X_TWITTER" && p.verified);
        const lcProf = state.connectedProfiles.find((p) => p.provider === "LUNARCRUSH" && p.verified);
        if (!xProf && !lcProf) {
          return { ok: false, note: "Verify X or LunarCrush first — no live social source connected" };
        }
        try {
          const mod = await import("../integrations.functions");
          const scans: SocialScan[] = [];
          const notes: string[] = [];
          if (xProf?.secret) {
            const res = await mod.fetchXSearch({ data: { token: xProf.secret, query: `$${inst.symbol}` } });
            notes.push(res.note);
            if (res.mentions.length) {
              scans.push({
                platform: "X_TWITTER",
                handleOrQuery: `$${inst.symbol} · live sample of ${res.mentions.length}`,
                followerCount: undefined,
                mentionVelocity24h: res.mentions.length,
                sentimentScore: 0,
                sentimentLabel: "NEUTRAL",
                verified: true,
                organicEngagementRatio: 0.5,
                recentHeadlines: res.mentions.map((m) => m.text).slice(0, 4),
                lastScanTs: Date.now(),
              });
            }
          }
          if (lcProf?.secret) {
            const res = await mod.fetchLunarSocial({ data: { key: lcProf.secret, symbol: inst.symbol } });
            notes.push(res.note);
            if (res.social) {
              const s = res.social;
              const sentimentScore =
                s.sentimentPct === null ? 0 : s.sentimentPct >= 60 ? 0.6 : s.sentimentPct <= 40 ? -0.6 : 0;
              scans.push({
                platform: "X_TWITTER",
                handleOrQuery: `${inst.symbol} · LunarCrush live`,
                followerCount: s.socialContributors ?? undefined,
                mentionVelocity24h: s.socialVolume24h ?? 0,
                sentimentScore,
                sentimentLabel: sentimentScore > 0 ? "BULLISH" : sentimentScore < 0 ? "BEARISH" : "NEUTRAL",
                verified: true,
                organicEngagementRatio: 0.7,
                recentHeadlines: [
                  `Galaxy Score ${s.galaxyScore ?? "—"} · Alt rank ${s.altRank ?? "—"} · 24h social volume ${(s.socialVolume24h ?? 0).toLocaleString()}`,
                ],
                lastScanTs: Date.now(),
              });
            }
          }
          if (!scans.length) return { ok: false, note: notes.join(" · ") || "No live social data returned" };
          set((prev) => ({
            instruments: prev.instruments.map((i) =>
              i.id === id
                ? {
                    ...i,
                    socialIntelligence: [...scans, ...i.socialIntelligence].slice(0, 6),
                    overallConfidence: Math.min(98, i.overallConfidence + 3),
                    updatedAt: Date.now(),
                  }
                : i,
            ),
          }));
          return { ok: true, note: notes.join(" · ") };
        } catch (error) {
          return { ok: false, note: error instanceof Error ? error.message : "Live social pull failed" };
        }
      },

      telegramCreds: () => {
        const p = get().connectedProfiles.find((x) => x.provider === "TELEGRAM");
        if (!p?.verified || !p.secret || !p.chatId) return null;
        return { token: p.secret, chatId: p.chatId };
      },

      discordWebhook: () => {
        const p = get().connectedProfiles.find((x) => x.provider === "DISCORD");
        if (!p?.verified || !p.secret) return null;
        return p.secret;
      },

      resetDyorCatalog: () => {
        set({
          instruments: [],
          connectedProfiles: INITIAL_PROFILES,
          selectedInstrumentId: null,
          filterStatus: "ALL",
        });
      },
    }),
    {
      name: "monroe_sniper_dyor_vault_v1",
      version: 3,
      // v2: connections must be verified live — drop any previously stored
      // "connected" flags and fabricated limits from the hardcoded era.
      // v3: drop seeded catalog instruments (identified by their unverified
      // seed-sample audit source). User-saved and searched instruments — which
      // never carry that source — are preserved untouched.
      migrate: (persisted: unknown) => {
        const data = (persisted ?? {}) as Record<string, unknown>;
        const profiles = Array.isArray(data.connectedProfiles) ? data.connectedProfiles : null;
        const instruments = Array.isArray((data as { instruments?: unknown }).instruments)
          ? ((data as { instruments: EvaluatedInstrument[] }).instruments ?? [])
          : null;
        const scrubbed =
          instruments === null
            ? undefined
            : instruments.filter(
                (inst) =>
                  !inst.honeypotMultiSource?.some((c) =>
                    c.source.includes("Seed sample (unverified)"),
                  ),
              );
        const scrubbedIds = new Set((scrubbed ?? []).map((i) => i.id));
        const selected =
          typeof data.selectedInstrumentId === "string" &&
          scrubbedIds.has(data.selectedInstrumentId)
            ? data.selectedInstrumentId
            : null;
        if (!profiles && scrubbed === undefined) return data;
        return {
          ...data,
          ...(scrubbed !== undefined
            ? { instruments: scrubbed, selectedInstrumentId: selected }
            : {}),
          ...(profiles
            ? {
                connectedProfiles: (profiles as ConnectedProfile[]).map((p) => ({
                  ...p,
                  verified: false,
                  connected: false,
                  syncStatus: "IDLE" as const,
                  rateLimitRemaining: null,
                  lastCheckNote: "Re-verify to reconnect — connections are now proven live.",
                })),
              }
            : {}),
        };
      },
      skipHydration: true,
      partialize: (state) => ({
        instruments: state.instruments,
        connectedProfiles: state.connectedProfiles,
        filterStatus: state.filterStatus,
      }),
    },
  ),
);
