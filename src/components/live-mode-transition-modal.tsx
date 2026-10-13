import { AlertTriangle, LockKeyhole, X } from "lucide-react";
import { Button } from "@/components/ui";

export function LiveModeTransitionModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close live trading status"
        className="fixed inset-0 cursor-default bg-ink/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-status-title"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-panel text-cream shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-line px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300">
              <LockKeyhole className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-widest text-amber-300 uppercase">
                Execution unavailable
              </p>
              <h2 id="live-status-title" className="mt-1 text-lg font-semibold">
                Paper trading only
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-10 items-center justify-center rounded-lg text-faint hover:bg-panel-2 hover:text-cream"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <p className="text-sm leading-relaxed text-faint">
            No brokerage or exchange execution provider is connected. The desk cannot place real orders,
            receive deposits, or send withdrawals. Balances and trade activity shown here are simulations.
          </p>

          <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-cream/80">
              Live execution stays locked. A real-money release would require a separately configured
              broker integration, managed credentials, and audited operational safeguards. No addresses,
              keys, or trading endpoints are configured in this app.
            </p>
          </div>

          <div className="flex justify-end pt-1">
            <Button onClick={onClose}>Back to paper desk</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
