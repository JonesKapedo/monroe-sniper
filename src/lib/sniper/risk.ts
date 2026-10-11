import { clip, round2 } from "./format.ts";
import type { Book, BookSide, Trade } from "./types";

export function unrealized(book: Book) {
  return book.positions.reduce((sum, pos) => {
    const px = book.symbols.find((s) => s.symbol === pos.symbol)?.price ?? pos.entry;
    const diff = pos.side === "LONG" ? px - pos.entry : pos.entry - px;
    return sum + diff * pos.qty;
  }, 0);
}

export function reservedNotional(book: Book) {
  return book.positions.reduce((sum, pos) => sum + pos.qty * pos.entry, 0);
}

export function snapshot(book: Book) {
  const openPnl = unrealized(book);
  const equity = round2(book.cash + openPnl);
  const reserved = reservedNotional(book);
  const free = round2(Math.max(0, book.cash - reserved));
  const wins = book.trades.filter((t) => t.pnl > 0).length;
  const winRate = book.trades.length ? wins / book.trades.length : 0;
  const openRisk = round2(
    book.positions.reduce((sum, pos) => sum + Math.abs(pos.entry - pos.stop) * pos.qty, 0),
  );
  return {
    equity,
    openPnl: round2(openPnl),
    reserved: round2(reserved),
    free,
    winRate,
    dayPnl: round2(equity - book.dayOpenEquity),
    openRisk,
  };
}

export function kellyFraction(trades: Trade[], cap: number) {
  const capN = clip(cap, 0.01, 0.2);
  if (trades.length < 8) return Math.min(0.015, capN);
  const recent = trades.slice(0, 40);
  const wins = recent.filter((t) => t.pnl > 0);
  const losses = recent.filter((t) => t.pnl <= 0);
  const winRate = wins.length / recent.length;
  const avgWin = wins.reduce((sum, t) => sum + t.pnl, 0) / (wins.length || 1);
  const avgLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / (losses.length || 1));
  if (avgWin <= 0) return Math.min(0.008, capN);
  const quarter = ((winRate * avgWin - (1 - winRate) * avgLoss) / avgWin) * 0.25;
  if (quarter <= 0) return Math.min(0.008, capN);
  return clip(quarter, 0.005, capN);
}

export function brackets(side: BookSide, entry: number, stopPct: number, reward: number) {
  if (side === "LONG") {
    return {
      stop: round2(entry * (1 - stopPct)),
      target: round2(entry * (1 + stopPct * reward)),
    };
  }
  return {
    stop: round2(entry * (1 + stopPct)),
    target: round2(entry * (1 - stopPct * reward)),
  };
}

export function planEntry(book: Book, price: number, side: BookSide) {
  const snap = snapshot(book);
  if (snap.equity <= 0 || snap.free < price) return null;
  const stopDist = price * book.settings.stopPct;
  if (stopDist <= 0) return null;
  let riskFrac = book.settings.riskPerTrade;
  if (book.settings.useKelly) {
    riskFrac = Math.min(riskFrac, kellyFraction(book.trades, book.settings.kellyCap));
  }
  let qty = Math.floor((snap.equity * riskFrac) / stopDist);
  const slot = Math.max((Math.max(book.cash, 0) * 0.92) / book.settings.maxPositions, 0);
  const room = Math.min(snap.free, slot);
  qty = Math.min(qty, Math.floor(room / price));
  if (qty < 1) return null;
  const levels = brackets(side, price, book.settings.stopPct, book.settings.rewardMultiple);
  return { qty, ...levels };
}
