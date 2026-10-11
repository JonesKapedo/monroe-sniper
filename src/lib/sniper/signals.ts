import { clip } from "./format";
import { features, predict } from "./model";
import type { ModelState, QuoteSignal, Settings, Side, SignalSet, SymbolState } from "./types";

function dirOf(action: Side) {
  if (action === "BUY") return 1;
  if (action === "SELL") return -1;
  return 0;
}

function invoSignal(sym: SymbolState, input: number[]): QuoteSignal {
  const crowd = clip((sym.bias ?? 0) * 0.72 + (input[1] ?? 0) * 0.35, -1, 1);
  if (crowd > 0.16) {
    return {
      action: "BUY",
      confidence: clip(0.52 + crowd * 0.4, 0.5, 0.94),
      note: "Copy-flow leaning long",
    };
  }
  if (crowd < -0.16) {
    return {
      action: "SELL",
      confidence: clip(0.52 + -crowd * 0.4, 0.5, 0.94),
      note: "Copy-flow leaning short",
    };
  }
  return { action: "FLAT", confidence: 0.32, note: "Crowd is split" };
}

function finvizSignal(input: number[]): QuoteSignal {
  const rsi = (input[3] ?? 0) * 25 + 50;
  const trend = input[2] ?? 0;
  const mom = input[1] ?? 0;
  const rsiText = `RSI ${rsi.toFixed(0)}`;
  if (trend > 0.22 && rsi > 46 && rsi < 76 && mom > -0.05) {
    return {
      action: "BUY",
      confidence: clip(0.55 + trend * 0.14, 0.5, 0.93),
      note: `Uptrend screen · ${rsiText}`,
    };
  }
  if (trend < -0.22 && rsi < 54 && rsi > 24 && mom < 0.05) {
    return {
      action: "SELL",
      confidence: clip(0.55 + -trend * 0.14, 0.5, 0.93),
      note: `Downtrend screen · ${rsiText}`,
    };
  }
  return { action: "FLAT", confidence: 0.3, note: `No screen · ${rsiText}` };
}

function simul8orSignal(model: ModelState, input: number[]): QuoteSignal {
  const p = predict(model.weights, input);
  if (p >= 0.56) {
    return { action: "BUY", confidence: clip(p, 0.5, 0.96), note: `Walk-forward long ${(p * 100).toFixed(0)}%` };
  }
  if (p <= 0.44) {
    return {
      action: "SELL",
      confidence: clip(1 - p, 0.5, 0.96),
      note: `Walk-forward short ${((1 - p) * 100).toFixed(0)}%`,
    };
  }
  return { action: "FLAT", confidence: 0.4, note: `No stored edge ${(p * 100).toFixed(0)}%` };
}

function ensemble(settings: Settings, parts: Pick<SignalSet, "invo" | "finviz" | "simul8or">): QuoteSignal {
  const rows = [
    { id: "Invo", on: settings.sources.INVO, sig: parts.invo },
    { id: "Finviz", on: settings.sources.FINVIZ, sig: parts.finviz },
    { id: "Simul8or", on: settings.sources.SIMUL8OR, sig: parts.simul8or },
  ];
  let score = 0;
  let weightSum = 0;
  const agreed: string[] = [];
  for (const row of rows) {
    if (!row.on.enabled || row.on.weight <= 0) continue;
    const dir = dirOf(row.sig.action);
    score += row.on.weight * dir * row.sig.confidence;
    weightSum += row.on.weight;
    if (dir !== 0) agreed.push(row.id);
  }
  if (weightSum === 0) return { action: "FLAT", confidence: 0, note: "All sources off" };
  const norm = score / weightSum;
  const action: Side = norm > 0.08 ? "BUY" : norm < -0.08 ? "SELL" : "FLAT";
  const confidence = clip(Math.abs(norm), 0, 0.97);
  if (action === "FLAT") return { action, confidence, note: "Desks do not agree" };
  const lean = action === "BUY" ? "Long" : "Short";
  return { action, confidence, note: `${lean} · ${agreed.join(" + ") || "mixed"}` };
}

export function buildSignalSet(sym: SymbolState, model: ModelState, settings: Settings): SignalSet {
  const input = features(sym);
  const invo = invoSignal(sym, input);
  const finviz = finvizSignal(input);
  const simul8or = simul8orSignal(model, input);
  return { symbol: sym.symbol, invo, finviz, simul8or, ensemble: ensemble(settings, { invo, finviz, simul8or }) };
}
