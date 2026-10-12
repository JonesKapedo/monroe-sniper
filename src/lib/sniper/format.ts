export function clip(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function money(n: number) {
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n < 0 ? "-" : ""}$${abs}`;
}

export function signedMoney(n: number) {
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (n > 0) return `+$${abs}`;
  if (n < 0) return `-$${abs}`;
  return `$${abs}`;
}

export function pct(n: number, digits = 0) {
  return `${(n * 100).toFixed(digits)}%`;
}

import { formatNairobiTime } from "./nairobi-time";

export function sessionClock(minute: number) {
  const day = Math.floor(minute / 390) + 1;
  const m = ((minute % 390) + 390) % 390;
  const total = 9 * 60 + 30 + m;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  const hhText = String(hh).padStart(2, "0");
  const mmText = String(mm).padStart(2, "0");
  return { day, label: `Day ${day} · ${hhText}:${mmText}` };
}

export function nairobiClock(startTimestamp?: number, currentTimestamp: number = Date.now()) {
  return formatNairobiTime(startTimestamp, currentTimestamp);
}

export function reasonLabel(reason: string) {
  if (reason === "TARGET") return "Target";
  if (reason === "STOP") return "Stop";
  if (reason === "TIME") return "Time";
  if (reason === "SIGNAL") return "Signal";
  return "Manual";
}
