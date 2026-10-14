/**
 * Synthesized desk sounds — Web Audio API only, zero assets, offline-safe.
 * Contexts resume lazily on the user's click gesture (autoplay-safe).
 */

const STORE_KEY = "monroe-sound-enabled";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return null;
  }
}

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, on ? "on" : "off");
  } catch {
    // Sound preference is best-effort.
  }
}

function breathNoise(ctx: AudioContext, seconds: number): AudioBufferSourceNode {
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(rate * seconds)), rate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  return src;
}

/**
 * Hawk cry, exactly 2.0s: descending screech with vibrato over a noise breath.
 */
export function playHawkCry(): boolean {
  if (!isSoundEnabled()) return false;
  const ac = audio();
  if (!ac) return false;
  try {
    const t0 = ac.currentTime + 0.02;
    const master = ac.createGain();
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.exponentialRampToValueAtTime(0.5, t0 + 0.08);
    master.gain.setValueAtTime(0.5, t0 + 1.5);
    master.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.0);
    master.connect(ac.destination);

    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(2400, t0);
    osc.frequency.exponentialRampToValueAtTime(900, t0 + 1.7);
    const vibrato = ac.createOscillator();
    vibrato.type = "sine";
    vibrato.frequency.setValueAtTime(28, t0);
    const vibratoGain = ac.createGain();
    vibratoGain.gain.setValueAtTime(280, t0);
    vibratoGain.gain.exponentialRampToValueAtTime(120, t0 + 1.7);
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);
    const toneFilter = ac.createBiquadFilter();
    toneFilter.type = "bandpass";
    toneFilter.frequency.setValueAtTime(2200, t0);
    toneFilter.frequency.exponentialRampToValueAtTime(1000, t0 + 1.7);
    toneFilter.Q.value = 2.5;
    osc.connect(toneFilter);
    toneFilter.connect(master);
    osc.start(t0);
    vibrato.start(t0);
    osc.stop(t0 + 2.0);
    vibrato.stop(t0 + 2.0);

    const noise = breathNoise(ac, 2.0);
    const noiseFilter = ac.createBiquadFilter();
    noiseFilter.type = "highpass";
    noiseFilter.frequency.value = 3000;
    const noiseGain = ac.createGain();
    noiseGain.gain.setValueAtTime(0.12, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.0);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start(t0);
    noise.stop(t0 + 2.0);
    return true;
  } catch {
    return false;
  }
}

/** Soft return-to-paper chirp, 0.5s ascending blip. */
export function playSoftChirp(): boolean {
  if (!isSoundEnabled()) return false;
  const ac = audio();
  if (!ac) return false;
  try {
    const t0 = ac.currentTime + 0.02;
    const master = ac.createGain();
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.exponentialRampToValueAtTime(0.25, t0 + 0.06);
    master.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    master.connect(ac.destination);
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, t0);
    osc.frequency.exponentialRampToValueAtTime(990, t0 + 0.4);
    osc.connect(master);
    osc.start(t0);
    osc.stop(t0 + 0.5);
    return true;
  } catch {
    return false;
  }
}
