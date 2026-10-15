/**
 * Astronomy Correlation Engine
 * Lightweight lunar-phase + seasonal approximation (no external dep).
 * Correlates whale trading outcomes with lunar cycle for the registry.
 * Planetary aspects are derived from slow-moving outer-planet synodic
 * approximations; sufficient for correlation bucketing, not ephemeris-grade.
 */

export type LunarPhase = 
  | "new"
  | "waxing_crescent"
  | "first_quarter"
  | "waxing_gibbous"
  | "full"
  | "waning_gibbous"
  | "last_quarter"
  | "waning_crescent";

export type PlanetaryAspect = 
  | "conjunction"
  | "sextile"
  | "square"
  | "trine"
  | "opposition";

export interface AstronomySnapshot {
  timestamp: number;
  lunarPhase: LunarPhase;
  lunarPhaseAngle: number;      // 0-360 degrees
  lunarSign: string;            // Zodiac sign
  planetaryAspects: PlanetaryAspectDetail[];
  retrogrades: string[];
  moonDistance: number;         // km
  sunSign: string;
}

export interface PlanetaryAspectDetail {
  planet1: string;
  planet2: string;
  aspect: PlanetaryAspect;
  angle: number;                // Exact angle
  orb: number;                  // Degrees from exact
  applying: boolean;            // Approaching or separating
}

export interface CorrelationResult {
  lunarPhase: LunarPhase;
  planetaryAspect: string;      // e.g., "JUPITER_SATURN_SQUARE"
  zodiacSign: string;
  totalMoves: number;
  winningMoves: number;
  winRate: number;
  avgPnl: number;
  correlationStrength: number;  // -1 to 1
  pValue: number;
  statisticalSignificance: boolean;
}

export interface WhaleAstronomyCorrelation {
  wallet: string;
  lunarPhase: LunarPhase;
  planetaryAspect: string;
  zodiacSign: string;
  totalMoves: number;
  winningMoves: number;
  winRate: number;
  avgPnl: number;
  correlationStrength: number;
  pValue: number;
  lastUpdated: number;
}

/**
 * Compute astronomy snapshot for a given timestamp (dependency-free).
 * Lunar phase via synodic cycle from known new moon 2000-01-06 18:14 UTC.
 * Zodiac + aspects are coarse seasonal approximations for correlation
 * bucketing only.
 */
export function computeAstronomySnapshot(timestamp: number): AstronomySnapshot {
  const SYNODIC_DAYS = 29.530588853;
  const NEW_MOON_2000 = Date.UTC(2000, 0, 6, 18, 14, 0);
  const daysSince = (timestamp - NEW_MOON_2000) / 86_400_000;
  const phase = ((daysSince % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS / SYNODIC_DAYS;

  const lunarPhase = getLunarPhaseName(phase);
  const lunarPhaseAngle = phase * 360;

  // Coarse ecliptic longitude drift for bucketing (not ephemeris-grade)
  const sunLonDeg = ((daysSince % 365.25) / 365.25) * 360;
  const moonLonDeg = (sunLonDeg + phase * 360) % 360;
  const lunarSign = getZodiacSignFromDeg(moonLonDeg);
  const sunSign = getZodiacSignFromDeg(sunLonDeg);

  // Slow outer-planet synodic approximations for aspect bucketing
  const jupiterLon = (sunLonDeg * 0.083 + 120) % 360;
  const saturnLon = (sunLonDeg * 0.033 + 240) % 360;
  const planetaryPositions: Record<string, { lon: number; lat: number }> = {
    Jupiter: { lon: (jupiterLon * Math.PI) / 180, lat: 0 },
    Saturn: { lon: (saturnLon * Math.PI) / 180, lat: 0 },
  };
  const planetaryAspects = calculatePlanetaryAspects(planetaryPositions);
  const retrogrades: string[] = [];

  // Mean lunar distance approximation (km)
  const moonDist = 385_000 - 21_000 * Math.cos(phase * Math.PI * 2);

  return {
    timestamp,
    lunarPhase,
    lunarPhaseAngle,
    lunarSign,
    planetaryAspects,
    retrogrades,
    moonDistance: moonDist,
    sunSign,
  };
}

function getLunarPhaseName(phase: number): LunarPhase {
  // phase is 0-1 where 0 = new moon, 0.5 = full moon
  if (phase < 0.0625 || phase >= 0.9375) return "new";
  if (phase < 0.1875) return "waxing_crescent";
  if (phase < 0.3125) return "first_quarter";
  if (phase < 0.4375) return "waxing_gibbous";
  if (phase < 0.5625) return "full";
  if (phase < 0.6875) return "waning_gibbous";
  if (phase < 0.8125) return "last_quarter";
  return "waning_crescent";
}

function getZodiacSign(lat: number, lon: number): string {
  const signs = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
  ];
  // Normalize longitude to 0-360
  const normalizedLon = ((lon * 180 / Math.PI) % 360 + 360) % 360;
  const index = Math.floor(normalizedLon / 30) % 12;
  return signs[index];
}

function getZodiacSignFromDeg(lonDeg: number): string {
  const signs = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
  ];
  const normalized = ((lonDeg % 360) + 360) % 360;
  return signs[Math.floor(normalized / 30) % 12];
}

function calculatePlanetaryAspects(
  positions: Record<string, { lon: number; lat: number }>
): PlanetaryAspectDetail[] {
  const aspects: PlanetaryAspectDetail[] = [];
  const planets = Object.keys(positions);
  
  const aspectAngles = {
    conjunction: 0,
    sextile: 60,
    square: 90,
    trine: 120,
    opposition: 180,
  };
  
  const orbs = {
    conjunction: 8,
    sextile: 4,
    square: 8,
    trine: 8,
    opposition: 8,
  };
  
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const p1 = planets[i];
      const p2 = planets[j];
      const pos1 = positions[p1];
      const pos2 = positions[p2];
      
      if (!pos1 || !pos2) continue;
      
      const angleDiff = Math.abs(pos1.lon - pos2.lon) * 180 / Math.PI;
      const normalizedAngle = angleDiff > 180 ? 360 - angleDiff : angleDiff;
      
      for (const [aspectName, targetAngle] of Object.entries(aspectAngles)) {
        const orb = Math.abs(normalizedAngle - targetAngle);
        if (orb <= orbs[aspectName as keyof typeof orbs]) {
          // Determine if applying or separating (simplified)
          aspects.push({
            planet1: p1,
            planet2: p2,
            aspect: aspectName as PlanetaryAspect,
            angle: normalizedAngle,
            orb,
            applying: orb < orbs[aspectName as keyof typeof orbs] / 2, // Simplified
          });
        }
      }
    }
  }
  
  return aspects;
}

/**
 * Compute correlation between whale moves and astronomy
 */
export function computeAstronomyCorrelation(
  moves: Array<{ timestamp: number; pnl: number; symbol: string }>,
  whaleProfile: { wallet: string }
): CorrelationResult[] {
  // Group moves by astronomy snapshot
  const grouped: Map<string, { moves: typeof moves; key: string }> = new Map();
  
  for (const move of moves) {
    const snapshot = computeAstronomySnapshot(move.timestamp);
    const key = `${snapshot.lunarPhase}|${snapshot.planetaryAspects.map(a => `${a.planet1}_${a.planet2}_${a.aspect}`).join(";")}|${snapshot.lunarSign}`;
    
    if (!grouped.has(key)) {
      grouped.set(key, { moves: [], key });
    }
    grouped.get(key)!.moves.push(move);
  }
  
  const results: CorrelationResult[] = [];
  
  for (const [key, group] of grouped) {
    if (group.moves.length < 5) continue; // Minimum sample size
    
    const [lunarPhase, aspectsStr, zodiacSign] = key.split("|");
    const winningMoves = group.moves.filter(m => m.pnl > 0).length;
    const winRate = winningMoves / group.moves.length;
    const avgPnl = group.moves.reduce((s, m) => s + m.pnl, 0) / group.moves.length;
    
    // Simple correlation: how much does win rate deviate from baseline?
    const baselineWinRate = 0.55; // Expected 55%
    const correlationStrength = Math.max(-1, Math.min(1, (winRate - baselineWinRate) / baselineWinRate * 2));
    
    // Simple chi-square for p-value (simplified)
    const expectedWins = group.moves.length * baselineWinRate;
    const chiSquare = Math.pow(winningMoves - expectedWins, 2) / expectedWins + 
                      Math.pow(group.moves.length - winningMoves - (group.moves.length - expectedWins), 2) / 
                      (group.moves.length - expectedWins);
    const pValue = Math.exp(-chiSquare / 2); // Approximate
    
    results.push({
      lunarPhase: lunarPhase as LunarPhase,
      planetaryAspect: aspectsStr || "none",
      zodiacSign,
      totalMoves: group.moves.length,
      winningMoves,
      winRate,
      avgPnl,
      correlationStrength,
      pValue,
      statisticalSignificance: pValue < 0.05 && group.moves.length >= 20,
    });
  }
  
  // Sort by correlation strength
  return results.sort((a, b) => Math.abs(b.correlationStrength) - Math.abs(a.correlationStrength));
}

/**
 * Get astronomy snapshot for a specific move timestamp
 */
export function getAstronomyForMove(timestamp: number): {
  lunarPhase: LunarPhase;
  planetaryAspects: PlanetaryAspectDetail[];
  lunarSign: string;
  retrogrades: string[];
} {
  const snapshot = computeAstronomySnapshot(timestamp);
  return {
    lunarPhase: snapshot.lunarPhase,
    planetaryAspects: snapshot.planetaryAspects,
    lunarSign: snapshot.lunarSign,
    retrogrades: snapshot.retrogrades,
  };
}

/**
 * Format astronomy snapshot for display
 */
export function formatAstronomySnapshot(snapshot: AstronomySnapshot): string {
  const aspects = snapshot.planetaryAspects.length > 0
    ? snapshot.planetaryAspects.map(a => `${a.planet1} ${a.aspect} ${a.planet2} (${a.orb.toFixed(1)}°)`).join(", ")
    : "None";
  
  return [
    `🌙 Lunar: ${snapshot.lunarPhase} in ${snapshot.lunarSign}`,
    `☀️ Solar: ${snapshot.sunSign}`,
    `🪐 Aspects: ${aspects}`,
    `↩️ Retrogrades: ${snapshot.retrogrades.length > 0 ? snapshot.retrogrades.join(", ") : "None"}`,
    `📏 Moon Distance: ${(snapshot.moonDistance / 1000).toFixed(0)} km`,
  ].join("\n");
}

/**
 * Get current astronomy snapshot
 */
export function getCurrentAstronomy(): AstronomySnapshot {
  return computeAstronomySnapshot(Date.now());
}

