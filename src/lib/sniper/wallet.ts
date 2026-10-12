import { round2 } from "./format";
import { snapshot } from "./risk";
import type { Book, LedgerEntry } from "./types";

export function withdrawnToday(ledger: LedgerEntry[], now = Date.now()) {
  const day = new Date(now).toDateString();
  return ledger
    .filter((entry) => entry.kind === "WITHDRAW" && new Date(entry.wall).toDateString() === day)
    .reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
}

export function withdrawBlock(book: Book, amount: number, now = Date.now()) {
  const clean = round2(amount);
  if (!(clean >= 1)) return "Enter at least $1 of paper cash.";
  if (clean > snapshot(book).free) return "That is more than free cash. Close a position or deposit paper funds.";
  if (withdrawnToday(book.ledger, now) + clean > book.settings.dailyWithdrawCap) {
    return "That crosses today's paper withdrawal cap. Raise it in Settings if you mean to.";
  }
  return null;
}

function pushLedger(book: Book, entry: LedgerEntry): Book {
  return { ...book, ledger: [entry, ...book.ledger].slice(0, 200) };
}

export function applyDeposit(book: Book, amount: number): Book {
  const clean = round2(amount);
  if (!(clean >= 1 && clean <= 1_000_000)) return book;
  const cash = round2(book.cash + clean);
  return pushLedger(
    {
      ...book,
      cash,
      activity: [
        {
          id: `dep-${book.ledger.length}-${book.minute}`,
          ts: book.minute,
          tone: "info" as const,
          text: `Paper deposit ${clean.toFixed(2)}`,
        },
        ...book.activity,
      ].slice(0, 80),
    },
    {
      id: `led-d-${book.ledger.length}-${book.minute}`,
      wall: Date.now(),
      kind: "DEPOSIT",
      amount: clean,
      note: "Paper deposit",
      balanceAfter: cash,
    },
  );
}

export function applyWithdraw(book: Book, amount: number): Book {
  if (withdrawBlock(book, amount)) return book;
  const clean = round2(amount);
  const cash = round2(book.cash - clean);
  return pushLedger(
    {
      ...book,
      cash,
      activity: [
        {
          id: `wd-${book.ledger.length}-${book.minute}`,
          ts: book.minute,
          tone: "info" as const,
          text: `Paper withdrawal ${clean.toFixed(2)}`,
        },
        ...book.activity,
      ].slice(0, 80),
    },
    {
      id: `led-w-${book.ledger.length}-${book.minute}`,
      wall: Date.now(),
      kind: "WITHDRAW",
      amount: -clean,
      note: "Paper withdrawal",
      balanceAfter: cash,
    },
  );
}

export async function hashPin(pin: string) {
  const data = new TextEncoder().encode(`monroe.v1.${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
