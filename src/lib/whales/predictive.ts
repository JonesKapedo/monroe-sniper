/**
 * Predictive Engine for Whale Copy Outcomes
 * Trains logistic regression after 20 qualifying copied trades
 * Features: whale profile, astronomy, market regime, risk model score
 * Target: actual P&L > 0
 */

export interface PredictionFeatures {
  // Whale profile features
  whaleWinRate: number;
  whaleConfidence: number;
  whaleQualifyingMoves: number;
  whaleStrategyTag: number; // Encoded
  whaleAvgHoldMinutes: number;
  
  // Astronomy features
  lunarPhase: number; // 0-7 encoded
  planetaryAspect: number; // Encoded
  zodiacSign: number; // 0-11 encoded
  isRetrograde: number; // 0/1
  
  // Market regime features
  marketVolatility: number;
  marketTrend: number; // -1, 0, 1
  btcDominance: number;
  
  // Risk model features
  riskModelScore: number;
  riskRewardRatio: number;
  conviction: number;
  atrPct: number;
  
  // Move features
  moveSizeUsd: number;
  moveDirection: number; // 1=IN, -1=OUT
  venueTag: number; // Encoded
}

export interface PredictionResult {
  predictedOutcome: "HIGH_PROB_PROFIT" | "HIGH_PROB_LOSS" | "UNCERTAIN";
  probability: number; // 0-1
  confidence: number; // 0-100
  keyFactors: string[];
  threshold: number;
}

export interface TrainingExample {
  features: PredictionFeatures;
  label: number; // 1 = profit, 0 = loss
  timestamp: number;
  whaleWallet: string;
  symbol: string;
  actualPnl: number;
}

export interface ModelState {
  weights: number[];
  bias: number;
  trained: boolean;
  trainingExamples: number;
  accuracy: number;
  lastTrained: number;
  featureNames: string[];
}

// Logistic regression model
class LogisticRegression {
  private weights: number[] = [];
  private bias: number = 0;
  private trained: boolean = false;
  private featureNames: string[] = [];
  
  train(examples: TrainingExample[], epochs: number = 1000, learningRate: number = 0.01): { accuracy: number } {
    if (examples.length < 10) {
      return { accuracy: 0 };
    }
    
    // Extract feature names from first example
    this.featureNames = Object.keys(examples[0].features);
    const nFeatures = this.featureNames.length;
    
    // Initialize weights
    this.weights = new Array(nFeatures).fill(0).map(() => (Math.random() - 0.5) * 0.01);
    this.bias = 0;
    
    // Normalize features
    const { normalized, means, stds } = this.normalizeFeatures(examples);
    
    // Training loop
    for (let epoch = 0; epoch < epochs; epoch++) {
      let correct = 0;

      for (const ex of normalized) {
        const z = this.predictRaw(ex.vector);
        const prob = 1 / (1 + Math.exp(-z));
        const pred = prob > 0.5 ? 1 : 0;

        // Cross-entropy loss gradient
        const error = prob - ex.label;

        // Update weights
        for (let i = 0; i < nFeatures; i++) {
          this.weights[i] -= learningRate * error * ex.vector[i];
        }
        this.bias -= learningRate * error;

        if (pred === ex.label) correct++;
      }

      const accuracy = correct / normalized.length;

      // Early stopping
      if (epoch > 100 && accuracy > 0.95) break;
    }

    this.trained = true;

    // Evaluate on training set
    const reNorm = this.normalizeFeatures(examples).normalized;
    let correct = 0;
    for (const ex of reNorm) {
      const prob = this.predictProb(ex.vector);
      const pred = prob > 0.5 ? 1 : 0;
      if (pred === ex.label) correct++;
    }

    return { accuracy: correct / reNorm.length };
  }
  
  private toVector(features: PredictionFeatures): number[] {
    return this.featureNames.map((name) => Number(features[name as keyof PredictionFeatures] ?? 0));
  }

  private normalizeFeatures(examples: TrainingExample[]): {
    normalized: Array<TrainingExample & { vector: number[] }>;
    means: number[];
    stds: number[];
  } {
    const nFeatures = this.featureNames.length;
    const means = new Array(this.featureNames.length).fill(0);
    const stds = new Array(this.featureNames.length).fill(1);
    
    // Calculate means
    for (const ex of examples) {
      for (let i = 0; i < this.featureNames.length; i++) {
        means[i] += ex.features[this.featureNames[i] as keyof PredictionFeatures] as number;
      }
    }
    for (let i = 0; i < means.length; i++) {
      means[i] /= examples.length;
    }
    
    // Calculate stds
    for (const ex of examples) {
      for (let i = 0; i < this.featureNames.length; i++) {
        const val = ex.features[this.featureNames[i] as keyof PredictionFeatures] as number;
        stds[i] += Math.pow(val - means[i], 2);
      }
    }
    for (let i = 0; i < stds.length; i++) {
      stds[i] = Math.sqrt(stds[i] / examples.length) || 1;
    }
    
    // Normalize into vectors for training
    const normalized = examples.map((ex) => {
      const vec = this.featureNames.map((name, i) => {
        const raw = Number(ex.features[name as keyof PredictionFeatures] ?? 0);
        return (raw - means[i]) / stds[i];
      });
      return { ...ex, vector: vec };
    });

    return { normalized, means, stds };
  }
  
  private predictRaw(features: number[]): number {
    let z = this.bias;
    for (let i = 0; i < features.length; i++) {
      z += this.weights[i] * features[i];
    }
    return z;
  }
  
  predictProb(features: number[]): number {
    const z = this.predictRaw(features);
    return 1 / (1 + Math.exp(-z));
  }
  
  predict(features: PredictionFeatures): PredictionResult {
    if (!this.trained) {
      return {
        predictedOutcome: "UNCERTAIN",
        probability: 0.5,
        confidence: 0,
        keyFactors: ["Model not trained"],
        threshold: 0.5,
      };
    }
    
    // Normalize features (raw vector; stored means/stds applied at train time)
    const normalized = this.toVector(features);

    const prob = this.predictProb(normalized);
    const outcome = prob > 0.65 ? "HIGH_PROB_PROFIT" : 
                    prob < 0.35 ? "HIGH_PROB_LOSS" : "UNCERTAIN";
    
    // Get feature importance (simplified)
    const factorIndices = this.weights
      .map((w, i) => ({ name: this.featureNames[i], importance: Math.abs(w) }))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 3)
      .map(f => f.name);
    
    return {
      predictedOutcome: outcome,
      probability: prob,
      confidence: Math.round(Math.abs(prob - 0.5) * 200), // 0-100
      keyFactors: factorIndices,
      threshold: 0.5,
    };
  }
  
  getState(): ModelState {
    return {
      weights: this.weights,
      bias: this.bias,
      trained: this.trained,
      trainingExamples: 0,
      accuracy: 0,
      lastTrained: Date.now(),
      featureNames: this.featureNames,
    };
  }
  
  setState(state: ModelState): void {
    this.weights = state.weights;
    this.bias = state.bias;
    this.trained = state.trained;
    this.featureNames = state.featureNames;
  }
}

// Singleton instance
const model = new LogisticRegression();

/**
 * Extract features from whale move and context
 */
export function extractFeatures(
  move: any,
  whaleProfile: any,
  astronomy: any,
  marketData: any,
  riskResult: any
): PredictionFeatures {
  return {
    // Whale profile
    whaleWinRate: whaleProfile.winRate / 100,
    whaleConfidence: whaleProfile.confidenceScore / 100,
    whaleQualifyingMoves: Math.min(whaleProfile.qualifyingMoves / 100, 1),
    whaleStrategyTag: encodeStrategy(whaleProfile.strategyTag),
    whaleAvgHoldMinutes: Math.min(whaleProfile.avgHoldMinutes / 1440, 1), // Normalize to days
    
    // Astronomy
    lunarPhase: encodeLunarPhase(astronomy.lunarPhase),
    planetaryAspect: encodeAspect(astronomy.planetaryAspects),
    zodiacSign: encodeZodiac(astronomy.lunarSign),
    isRetrograde: astronomy.retrogrades.length > 0 ? 1 : 0,
    
    // Market
    marketVolatility: marketData.volatility || 0.5,
    marketTrend: marketData.trend || 0,
    btcDominance: marketData.btcDominance || 0.5,
    
    // Risk model
    riskModelScore: riskResult.score / 100,
    riskRewardRatio: Math.min(riskResult.riskRewardRatio / 5, 1),
    conviction: riskResult.conviction || 0.5,
    atrPct: Math.min(riskResult.atrPct * 10, 1),
    
    // Move
    moveSizeUsd: Math.min(riskResult.notional / 10000, 1),
    moveDirection: 1, // IN
    venueTag: encodeVenue(riskResult.venue || "dex"),
  };
}

function encodeStrategy(strategy: string): number {
  const strategies = ["accumulation", "distribution", "arb", "yield", "ipo-sniper", "rotation", "unknown"];
  return strategies.indexOf(strategy) / strategies.length;
}

function encodeLunarPhase(phase: string): number {
  const phases = ["new", "waxing_crescent", "first_quarter", "waxing_gibbous", "full", "waning_gibbous", "last_quarter", "waning_crescent"];
  return phases.indexOf(phase) / phases.length;
}

function encodeAspect(aspects: any[]): number {
  if (!aspects.length) return 0;
  // Return strongest aspect
  const aspectOrder = ["conjunction", "opposition", "square", "trine", "sextile"];
  for (const a of aspectOrder) {
    if (aspects.some(as => as.aspect === a)) return aspectOrder.indexOf(a) / aspectOrder.length;
  }
  return 0;
}

function encodeZodiac(sign: string): number {
  const signs = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
  return signs.indexOf(sign) / signs.length;
}

function encodeVenue(venue: string): number {
  const venues = ["binance", "raydium", "orca", "uniswap", "pancakeswap", "jupiter", "dex", "fx"];
  return venues.indexOf(venue.toLowerCase()) / venues.length;
}

/**
 * Train model from historical whale copy outcomes
 */
export async function trainPredictiveModel(
  examples: TrainingExample[]
): Promise<{ accuracy: number; modelState: ModelState }> {
  const result = model.train(examples);
  return { accuracy: result.accuracy, modelState: model.getState() };
}

/**
 * Predict outcome for a whale move
 */
export function predictWhaleMoveOutcome(
  move: any,
  whaleProfile: any,
  astronomy: any,
  marketData: any,
  riskResult: any
): PredictionResult {
  const features = extractFeatures(move, whaleProfile, astronomy, marketData, riskResult);
  return model.predict(features);
}

/**
 * Load model state from storage
 */
export function loadModelState(state: ModelState): void {
  model.setState(state);
}

/**
 * Get current model state
 */
export function getModelState(): ModelState {
  return model.getState();
}

/**
 * Check if model is ready for predictions
 */
export function isModelReady(): boolean {
  return model.getState().trained && model.getState().trainingExamples >= 20;
}

