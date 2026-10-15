/**
 * Whale Intelligence Module Exports
 */

export type {
  WhaleStrategy,
  WhaleMoveDirection,
  WhaleMoveRaw,
  WhaleMoveAnalyzed,
  WhaleProfile,
  WhaleRegistryEntry,
  PreCopyCheckResult,
} from "./intelligence";

export {
  classifyWhaleStrategy,
  analyzeWhaleWallet,
  evaluateWhaleMoveForCopy,
  getWhaleRegistryStats,
} from "./intelligence";

export type {
  AstronomySnapshot,
  PlanetaryAspectDetail,
  CorrelationResult,
  WhaleAstronomyCorrelation,
  LunarPhase,
  PlanetaryAspect,
} from "./astronomy";

export {
  computeAstronomySnapshot,
  computeAstronomyCorrelation,
  getAstronomyForMove,
  formatAstronomySnapshot,
  getCurrentAstronomy,
} from "./astronomy";

export type {
  PredictionFeatures,
  PredictionResult,
  TrainingExample,
  ModelState,
} from "./predictive";

export {
  extractFeatures,
  trainPredictiveModel,
  predictWhaleMoveOutcome,
  loadModelState,
  getModelState,
  isModelReady,
} from "./predictive";

// Registry functions (server-side, using Neon DB)
export type { WhaleWatch, WhaleMoveRow } from "../whales.functions";

export {
  addWhaleWatch,
  listWhaleWatches,
  setWhaleFollow,
  removeWhaleWatch,
  refreshWhaleMoves,
  getWhaleMoves,
  markWhaleActed,
} from "../whales.functions";