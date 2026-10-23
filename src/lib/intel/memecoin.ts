import type { ExitProfile } from "../sniper/exits";
import type { Candidate } from "../paper";

export type MemeTier = "A" | "B" | "C";

export type MemeFeatures = {
  priority: number;
  conviction: number | null;
  crowdedness: string;
  smart: number | null;
  kol: number | null;
  sniper: number | null;
  bundler: number | null;
  top10: number | null;
  devHold: number | null;
  devScore: number | null;
  devSurvival: number | null;
  devRugRate: number | null;
  devInner: number | null;
  devUnsafe: number | null;
  devReskin: boolean;
  buyTax: number | null;
  sellTax: number | null;
  buyRatio: number | null;
  chg5m: number | null;
  chg1h: number | null;
  turnover: number | null;
  liquidity: number;
  mcap: number | null;
  ageMin: number | null;
  honeypot: boolean;
  renounced: boolean | null;
  riskWarn: boolean;
  redFlags: string[];
  mock: boolean;
};

export type MemeVerdict = {
  ok: boolean;
  score: number;
  tier: MemeTier;
  flags: string[];
  rationale: string[];
  reject: string | null;
};

const hardRed = /honeypot|rug|貔貅|黑名单|无法卖出|cannot sell|blacklist/i;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function has(m: MemeFeatures): number {
  return (m.smart ?? 0) + (m.kol ?? 0);
}

export function memecoinVerdict(m: MemeFeatures): MemeVerdict {
  const flags: string[] = [];
  const reject = (why: string): MemeVerdict => ({
    ok: false,
    score: clamp(Math.round(m.priority), 0, 100),
    tier: "C",
    flags: [...flags, "GMGN-REJECT"],
    rationale: [why],
    reject: why,
  });

  const badRed = m.redFlags.find((r) => hardRed.test(r));
  if (m.honeypot) return reject("honeypot contract");
  if (badRed) return reject(`contract red flag: ${badRed}`);
  if (m.renounced === false) return reject("mint/freeze authority not renounced");
  if ((m.buyTax ?? 0) > 0.1 || (m.sellTax ?? 0) > 0.1) return reject("transfer tax above 10%");
  if ((m.bundler ?? 0) > 0.3) return reject("bundled supply above 30%");
  if ((m.devHold ?? 0) > 0.1) return reject("dev wallet above 10%");
  if ((m.top10 ?? 0) > 0.4) return reject("top-10 wallets above 40%");
  if (m.liquidity > 0 && m.liquidity < 12_000) return reject("published pool below $12k");
  if (m.ageMin != null && m.ageMin < 3) return reject("pair under 3 minutes old");
  if ((m.sniper ?? 0) > 30) return reject("sniper wallet count above 30");
  if ((m.devRugRate ?? 0) > 0.5) return reject("dev rug rate above 50%");
  if ((m.devInner ?? 0) > 500 && (m.devSurvival ?? 1) < 0.1) return reject("factory wallet with no survivors");
  if (m.buyRatio != null && m.buyRatio < 0.4) return reject("sell pressure dominates order flow");
  if ((m.chg1h ?? 0) < -0.12 && (m.chg5m ?? 0) < -0.06) return reject("momentum already broken down");
  if (m.smart != null || m.kol != null) {
    if (has(m) < 1) return reject("no smart-money or KOL confluence");
  }
  if (m.crowdedness === "late" && m.buyRatio != null && m.buyRatio < 0.55) {
    return reject("late crowd without bid support");
  }
  if ((m.chg1h ?? 0) > 3 && m.buyRatio != null && m.buyRatio < 0.55) {
    return reject("blow-off move without bid support");
  }

  let adj = 0;
  const consensus = has(m);
  if (m.smart != null || m.kol != null) adj += clamp(consensus * 2, 0, 6);
  if (m.devScore != null) adj += clamp((m.devScore - 0.4) * 16, -6, 8);
  if (m.devSurvival != null) adj += clamp((m.devSurvival - 0.5) * 10, -5, 5);
  if (m.devRugRate != null) adj -= clamp(m.devRugRate * 10, 0, 6);
  if ((m.devInner ?? 0) > 200) adj -= 6;
  else if ((m.devInner ?? 0) > 50) adj -= 3;
  if (m.devUnsafe != null && m.devUnsafe > 0) adj -= Math.min(8, m.devUnsafe * 3);
  if (m.devReskin) adj -= 6;
  if (m.bundler != null) adj -= clamp(m.bundler * 18, 0, 6);
  if (m.top10 != null) adj -= clamp(Math.max(0, m.top10 - 0.2) * 25, 0, 5);
  if (m.devHold != null) adj -= clamp(Math.max(0, m.devHold - 0.04) * 60, 0, 4);
  if (m.buyTax != null || m.sellTax != null) {
    adj -= clamp(((m.buyTax ?? 0) + (m.sellTax ?? 0)) * 30, 0, 6);
  }
  if (m.buyRatio != null) adj += clamp((m.buyRatio - 0.5) * 20, -5, 4);
  if (m.chg5m != null && m.chg5m > 0.02 && (m.chg1h ?? 0) > 0) adj += 4;
  if (m.chg5m != null && m.chg5m < -0.03) adj -= 6;
  if ((m.chg1h ?? 0) > 1 && (m.buyRatio ?? 0) >= 0.55) adj += 2;
  if (m.crowdedness === "early") adj += 3;
  if (m.crowdedness === "late") adj -= 8;
  if (m.liquidity <= 0) adj -= 1;
  else if (m.liquidity >= 100_000) adj += 4;
  else if (m.liquidity >= 50_000) adj += 3;
  else if (m.liquidity >= 30_000) adj += 1;
  else if (m.liquidity < 20_000) adj -= 6;
  if (m.ageMin != null) {
    if (m.ageMin >= 15 && m.ageMin <= 180) adj += 4;
    else if (m.ageMin > 180 && m.ageMin <= 720) adj += 2;
    else if (m.ageMin > 2880) adj -= 3;
  }
  if (m.mcap != null) {
    if (m.mcap >= 100_000 && m.mcap <= 3_000_000) adj += 3;
    else if (m.mcap > 20_000_000) adj -= 5;
    else if (m.mcap < 50_000) adj -= 3;
  }
  if (m.turnover != null) {
    if (m.turnover >= 0.5 && m.turnover <= 5) adj += 2;
    else if (m.turnover > 25) adj -= 6;
    else if (m.turnover > 12) adj -= 4;
  }
  if ((m.sniper ?? 0) > 10) adj -= 6;
  else if ((m.sniper ?? 0) > 4) adj -= 3;
  adj -= Math.min(6, m.redFlags.length * 2);

  const score = clamp(Math.round(m.priority + clamp(adj, -28, 12)), 0, 100);
  if (score < 55) return reject("memecoin score below 55");

  const knownBundler = m.bundler ?? 0;
  const knownTop10 = m.top10 ?? 0;
  const knownDevHold = m.devHold ?? 0;
  const knownBuy = m.buyRatio ?? 1;
  const smartKnown = m.smart != null || m.kol != null;
  const tierA =
    score >= 82 &&
    smartKnown &&
    consensus >= 2 &&
    m.bundler != null &&
    m.top10 != null &&
    m.devHold != null &&
    m.buyRatio != null &&
    knownBundler <= 0.15 &&
    knownTop10 <= 0.32 &&
    knownDevHold <= 0.06 &&
    knownBuy >= 0.55 &&
    m.liquidity >= 30_000 &&
    (m.devRugRate ?? 0) <= 0.25;
  const tierB =
    score >= 68 &&
    (!smartKnown || consensus >= 1) &&
    knownBundler <= 0.22 &&
    knownTop10 <= 0.38 &&
    knownDevHold <= 0.08 &&
    (m.buyRatio == null || knownBuy >= 0.48) &&
    (m.liquidity === 0 || m.liquidity >= 20_000);
  const tier: MemeTier = tierA ? "A" : tierB ? "B" : "C";

  flags.push(`GMGN-${tier}`);
  if (m.liquidity <= 0) flags.push("GMGN-DEPTH-UNKNOWN");
  else if (m.liquidity < 30_000) flags.push("GMGN-THIN");
  if (m.crowdedness === "late") flags.push("GMGN-LATE");
  if (m.riskWarn) flags.push("GMGN-RISK");
  if (m.mock) flags.push("GMGN-MOCK");
  if (m.redFlags.length) flags.push("GMGN-FLAG");
  if (consensus >= 2) flags.push("GMGN-SM");
  if ((m.devScore ?? 0) >= 0.6 && (m.devRugRate ?? 0) <= 0.25) flags.push("GMGN-DEV");
  if ((m.sniper ?? 0) > 4) flags.push("GMGN-SNIPED");
  if ((m.chg1h ?? 0) > 1 && (m.buyRatio ?? 0) >= 0.55) flags.push("GMGN-HOT");
  if ((m.buyTax ?? 0) > 0.05 || (m.sellTax ?? 0) > 0.05) flags.push("GMGN-TAX");

  const rationale = [
    `Meme ${score}/100 tier ${tier} · GMGN ${m.priority}/100`,
    `Dev ${m.devScore == null ? "n/a" : Math.round(m.devScore * 100)} · consensus ${consensus} · bundler ${Math.round(knownBundler * 100)}% · top10 ${Math.round(knownTop10 * 100)}%`,
    `Buy ${m.buyRatio == null ? "n/a" : Math.round(m.buyRatio * 100)}% · 5m ${m.chg5m == null ? "n/a" : `${(m.chg5m * 100).toFixed(1)}%`} · 1h ${m.chg1h == null ? "n/a" : `${(m.chg1h * 100).toFixed(1)}%`}`,
  ];

  return { ok: true, score, tier, flags, rationale, reject: null };
}

export function memecoinTier(c: Pick<Candidate, "flags">): MemeTier {
  if (c.flags.includes("GMGN-A")) return "A";
  if (c.flags.includes("GMGN-C")) return "C";
  return "B";
}

export function memecoinExitProfile(
  c: Pick<Candidate, "flags">,
  opts: { training?: boolean } = {},
): ExitProfile {
  const tier = memecoinTier(c);
  const training = opts.training === true;
  if (tier === "A") {
    return {
      breakevenTriggerR: 1.0,
      breakevenBufferR: 0.25,
      scaleOut1AtR: 2.0,
      scaleOut1Fraction: 0.25,
      scaleOut2AtR: 4.0,
      scaleOut2Fraction: 0.25,
      runnerTrailAtrMult: 3.5,
      volSpikeTrailAtrMult: 2.2,
      timeStopMinutes: training ? 45 : 180,
      staleFailsafeMinutes: 10,
    };
  }
  if (tier === "C") {
    return {
      breakevenTriggerR: 0.75,
      breakevenBufferR: 0.2,
      scaleOut1AtR: 1.5,
      scaleOut1Fraction: 0.4,
      scaleOut2AtR: 3.0,
      scaleOut2Fraction: 0.3,
      runnerTrailAtrMult: 2.6,
      volSpikeTrailAtrMult: 1.8,
      timeStopMinutes: training ? 20 : 75,
      staleFailsafeMinutes: 8,
    };
  }
  return {
    breakevenTriggerR: 0.85,
    breakevenBufferR: 0.2,
    scaleOut1AtR: 1.75,
    scaleOut1Fraction: 0.3,
    scaleOut2AtR: 3.5,
    scaleOut2Fraction: 0.3,
    runnerTrailAtrMult: 3.0,
    volSpikeTrailAtrMult: 2.0,
    timeStopMinutes: training ? 30 : 120,
    staleFailsafeMinutes: 10,
  };
}
