import { clip } from "./format";
import type { ModelState, SymbolState } from "./types";

export const PRIOR = [0.02, 0.22, 0.34, 0.04, -0.08, 0.06, 0.12];

export const WEIGHT_LABELS = [
  "Bias",
  "5-bar momentum",
  "20-bar trend",
  "RSI",
  "Volatility",
  "Mean reversion",
  "Copy flow",
];

function ret(hist: number[], n: number) {
  if (hist.length <= n) return 0;
  const last = hist[hist.length - 1] ?? 0;
  const prev = hist[hist.length - 1 - n] ?? 0;
  if (!prev) return 0;
  return (last - prev) / prev;
}

function rsi(hist: number[], n = 14) {
  if (hist.length < n + 1) return 50;
  let gain = 0;
  let loss = 0;
  const start = hist.length - n;
  for (let i = start; i < hist.length; i++) {
    const d = (hist[i] ?? 0) - (hist[i - 1] ?? 0);
    if (d >= 0) gain += d;
    else loss -= d;
  }
  if (loss === 0) return 100;
  const rs = gain / loss;
  return 100 - 100 / (1 + rs);
}

function stdev(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function smaDist(hist: number[], n: number) {
  if (hist.length < n) return 0;
  const window = hist.slice(-n);
  const mean = window.reduce((a, b) => a + b, 0) / n;
  const last = hist[hist.length - 1] ?? 0;
  if (!mean) return 0;
  return (last - mean) / mean;
}

export function freshModel(): ModelState {
  return {
    weights: [...PRIOR],
    samples: 0,
    correct: 0,
    recent: [],
    hits: [],
    notes: [
      {
        m: 0,
        text: "Prior loaded. Short momentum and trend lead until closed trades take over.",
      },
    ],
    adaptLeft: 0,
  };
}

export function features(sym: SymbolState): number[] {
  const hist = sym.hist;
  if (hist.length < 22) return [1, 0, 0, 0, 0, 0, clip(sym.bias, -1, 1)];
  const diffs: number[] = [];
  const start = Math.max(1, hist.length - 20);
  for (let i = start; i < hist.length; i++) {
    const prev = hist[i - 1] ?? 1;
    diffs.push(((hist[i] ?? prev) - prev) / prev);
  }
  return [
    1,
    clip(ret(hist, 5) / 0.01, -3, 3),
    clip(ret(hist, 20) / 0.02, -3, 3),
    clip((rsi(hist) - 50) / 25, -3, 3),
    clip(stdev(diffs) / 0.008, 0, 3),
    clip(-smaDist(hist, 20) / 0.01, -3, 3),
    clip(sym.bias, -1, 1),
  ];
}

export function predict(weights: number[], input: number[]) {
  const z = weights.reduce((sum, weight, i) => sum + weight * (input[i] ?? 0), 0);
  const clipped = clip(z, -12, 12);
  return 1 / (1 + Math.exp(-clipped));
}

export function driftEdge(input: number[]) {
  const mom = input[1] ?? 0;
  const trend = input[2] ?? 0;
  const revert = input[5] ?? 0;
  return 0.00042 * Math.tanh(0.45 * mom + 0.25 * trend - 0.15 * revert);
}

export function train(model: ModelState, input: number[], y: number, minute: number): ModelState {
  if (input.length !== model.weights.length) return model;
  const p = predict(model.weights, input);
  const lr = (0.14 / (1 + model.samples / 50)) * (model.adaptLeft > 0 ? 2.4 : 1);
  const weights = model.weights.map((weight, i) =>
    clip(weight - lr * (p - y) * (input[i] ?? 0), -2.5, 2.5),
  );
  const correctGuess = (p >= 0.5 ? 1 : 0) === y;
  const samples = model.samples + 1;
  const correct = model.correct + (correctGuess ? 1 : 0);
  const recent = [...model.recent, correctGuess].slice(-40);
  const rate = recent.filter(Boolean).length / recent.length;
  const hits = [...model.hits, { m: minute, rate }].slice(-160);
  const notes = [...model.notes];
  if (samples % 6 === 0) {
    const ranked = WEIGHT_LABELS.map((name, i) => ({ name, w: weights[i] ?? 0 }))
      .filter((_, i) => i !== 0)
      .sort((a, b) => Math.abs(b.w) - Math.abs(a.w));
    const lead = ranked[0];
    const next = ranked[1];
    notes.unshift({
      m: minute,
      text: `After ${samples} closes the book leans on ${lead?.name.toLowerCase() ?? "trend"} (${(lead?.w ?? 0).toFixed(2)}) and ${next?.name.toLowerCase() ?? "momentum"} (${(next?.w ?? 0).toFixed(2)}). Rolling hit rate ${(rate * 100).toFixed(0)}%.`,
    });
  }
  return {
    weights,
    samples,
    correct,
    recent,
    hits,
    notes: notes.slice(0, 24),
    adaptLeft: Math.max(0, model.adaptLeft - 1),
  };
}
