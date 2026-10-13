import { useDesk } from "@/lib/desk-store";
import { cn } from "@/lib/cn";

export function StandbyPositionsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const positions = useDesk((state) => state.demo.positions);
  const flatten = useDesk((state) => state.flatten);
  if (!isOpen) return null;

  const closePosition = (id: string) => {
    flatten(id);
    if (useDesk.getState().demo.positions.length === 0) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <button
        type="button"
        aria-label="Close standby position review"
        className="fixed inset-0 cursor-default bg-ink/85 backdrop-blur-sm"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="standby-review-title"
        className="relative z-10 my-auto max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-panel text-cream shadow-2xl"
      >
        <div className="border-b border-line px-5 py-4 sm:px-6">
          <p className="text-[11px] font-semibold tracking-widest text-amber-300 uppercase">
            Bot on standby
          </p>
          <h2 id="standby-review-title" className="mt-1 text-lg font-semibold">
            {positions.length
              ? `${positions.length} open paper position${positions.length === 1 ? "" : "s"}`
              : "Trading paused"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-faint">
            New entries and automatic exits are paused. Review the last market marks below, close
            positions individually, or leave them open to manage later.
          </p>
        </div>
        <div className="space-y-3 px-5 py-4 sm:px-6">
          {positions.map((position) => {
            const unrealized = (position.mark - position.entryPrice) * position.qty;
            const toTarget =
              ((position.target ?? position.entryPrice * 1.06) - position.mark) * position.qty;
            const toStop = (position.stop - position.mark) * position.qty;
            return (
              <article key={position.id} className="rounded-xl border border-line bg-panel-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{position.symbol}</h3>
                    <p className="mt-1 text-xs text-faint">
                      Entry ${position.entryPrice.toPrecision(6)} · Last mark $
                      {position.mark.toPrecision(6)}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "font-mono text-sm font-semibold",
                      unrealized >= 0 ? "text-gain" : "text-loss",
                    )}
                  >
                    {unrealized >= 0 ? "+" : ""}${unrealized.toFixed(2)} unrealized
                  </p>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-faint">
                  At target: {toTarget >= 0 ? "+" : ""}${toTarget.toFixed(2)} from last mark · At
                  stop: {toStop >= 0 ? "+" : ""}${toStop.toFixed(2)} from last mark. These are
                  scenario estimates, not forecasts.
                </p>
                <button
                  type="button"
                  onClick={() => closePosition(position.id)}
                  className="mt-3 min-h-10 rounded-lg border border-loss/40 px-3 text-xs font-semibold text-loss hover:bg-loss/10"
                >
                  Close {position.symbol} at last paper mark
                </button>
              </article>
            );
          })}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-lg border border-line px-4 text-sm text-faint hover:text-cream"
            >
              Review later
            </button>
            {positions.length ? (
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 rounded-lg bg-brass px-4 text-sm font-semibold text-ink hover:brightness-105"
              >
                Keep {positions.length} position{positions.length === 1 ? "" : "s"} open
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
