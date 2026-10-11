import { useState } from "react";
import { money, signedMoney } from "@/lib/sniper/format";
import { snapshot } from "@/lib/sniper/risk";
import { useSniper } from "@/lib/sniper/store";
import { hashPin, withdrawBlock, withdrawnToday } from "@/lib/sniper/wallet";
import { Button, Card, Label } from "@/components/ui";
import { cn } from "@/lib/cn";

export function WalletView() {
  const book = useSniper((s) => s.book);
  const deposit = useSniper((s) => s.deposit);
  const withdraw = useSniper((s) => s.withdraw);
  const setPinHash = useSniper((s) => s.setPinHash);
  const lock = useSniper((s) => s.lock);
  const snap = snapshot(book);
  const [amount, setAmount] = useState("1000");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<number | null>(null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [pinError, setPinError] = useState("");
  const used = withdrawnToday(book.ledger);
  const left = Math.max(0, book.settings.dailyWithdrawCap - used);
  const parsed = Number(amount);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium md:text-3xl">Paper wallet</h1>
        <p className="mt-1 text-sm text-faint">
          Deposits and withdrawals move play money stored on this device. Nothing is sent to a bank, a broker, or a chain.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <Label>Cash</Label>
          <p className="mt-2 font-mono text-2xl">{money(book.cash)}</p>
        </Card>
        <Card>
          <Label>Free to withdraw</Label>
          <p className="mt-2 font-mono text-2xl">{money(snap.free)}</p>
        </Card>
        <Card>
          <Label>In positions</Label>
          <p className="mt-2 font-mono text-xl">{money(snap.reserved)}</p>
        </Card>
        <Card>
          <Label>Left today</Label>
          <p className="mt-2 font-mono text-xl">{money(left)}</p>
        </Card>
      </div>

      <Card>
        <Label>Move paper funds</Label>
        <label className="mt-3 flex flex-col gap-2 text-sm">
          Amount
          <input
            className="field"
            inputMode="decimal"
            value={amount}
            aria-label="Amount"
            onChange={(event) => {
              setAmount(event.target.value);
              setError("");
              setConfirm(null);
            }}
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          {[1000, 5000, 10000].map((chip) => (
            <Button key={chip} variant="ghost" onClick={() => setAmount(String(chip))}>
              {money(chip)}
            </Button>
          ))}
        </div>
        {error ? <p className="mt-3 text-sm text-loss">{error}</p> : null}
        {confirm !== null ? (
          <div className="mt-4 rounded-xl border border-line bg-panel-2 p-3">
            <p className="text-sm">Withdraw {money(confirm)} of paper cash? This cannot be undone except by depositing again.</p>
            <div className="mt-3 flex gap-2">
              <Button
                variant="danger"
                onClick={() => {
                  withdraw(confirm);
                  setConfirm(null);
                }}
              >
                Confirm withdrawal
              </Button>
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (!(parsed >= 1 && parsed <= 1_000_000)) {
                  setError("Enter between $1 and $1,000,000.");
                  return;
                }
                deposit(parsed);
                setError("");
              }}
            >
              Deposit
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                const block = withdrawBlock(book, parsed);
                if (block) {
                  setError(block);
                  return;
                }
                setError("");
                setConfirm(Math.round(parsed * 100) / 100);
              }}
            >
              Withdraw
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <Label>Desk PIN</Label>
        <p className="mt-2 text-sm text-faint">
          Optional. A hash stays in this browser. It locks the screens, not a real account. Five misses pause entry for 20 seconds.
        </p>
        {book.pinHash ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => lock()}>
              Lock now
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setPinHash(null);
                setPin("");
                setPin2("");
                setPinError("");
              }}
            >
              Remove PIN
            </Button>
          </div>
        ) : (
          <form
            className="mt-3 flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!/^\d{4,6}$/.test(pin)) {
                setPinError("Use 4 to 6 digits.");
                return;
              }
              if (pin !== pin2) {
                setPinError("The two entries do not match.");
                return;
              }
              void hashPin(pin).then((hash) => {
                setPinHash(hash);
                setPin("");
                setPin2("");
                setPinError("");
              });
            }}
          >
            <input className="field" inputMode="numeric" placeholder="New PIN" aria-label="New PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} />
            <input className="field" inputMode="numeric" placeholder="Repeat PIN" aria-label="Repeat PIN" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 6))} />
            {pinError ? <p className="text-sm text-loss">{pinError}</p> : null}
            <Button type="submit">Set PIN</Button>
          </form>
        )}
      </Card>

      <Card>
        <Label>Ledger</Label>
        <ul className="mt-3 flex flex-col">
          {book.ledger.length === 0 ? <li className="text-sm text-faint">No cash movements yet.</li> : null}
          {book.ledger.slice(0, 20).map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-3 border-t border-line py-3 text-sm first:border-0">
              <div>
                <p>{entry.note}</p>
                <p className="text-xs text-faint">{new Date(entry.wall).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className={cn("font-mono", entry.amount >= 0 ? "text-gain" : "text-loss")}>{signedMoney(entry.amount)}</p>
                <p className="font-mono text-xs text-faint">{money(entry.balanceAfter)}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
