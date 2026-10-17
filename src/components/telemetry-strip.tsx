import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Radio } from "lucide-react";
import { useDesk } from "@/lib/desk-store";
import { cn } from "@/lib/utils";

/**
 * Fixed thin telemetry rail under the operator strip.
 * Collapsed: latest 2 log lines. Expanded: full operational feed (any page).
 */
export function TelemetryStrip() {
  const log = useDesk((s) => s.log);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const v = sessionStorage.getItem("monroe.telemetryOpen");
      if (v === "1") setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem("monroe.telemetryOpen", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const latest = log.slice(0, 2);
  const full = log.slice(0, 40);

  return (
    <div className="sticky top-0 z-30 border-b border-line/80 bg-ink/95 backdrop-blur-md">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-stretch gap-2 px-3 py-1.5 text-left transition-colors hover:bg-panel/40 md:px-6"
        aria-expanded={open}
        aria-label={open ? "Collapse bot telemetry" : "Expand bot telemetry"}
      >
        <div className="flex shrink-0 items-center gap-1.5 self-center">
          <Radio className="size-3 text-brass/80" />
          <span className="hidden font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-brass/90 sm:inline">
            Feed
          </span>
        </div>

        <div className="min-w-0 flex-1 font-mono text-[11px] leading-snug text-faint">
          {latest.length === 0 ? (
            <p className="text-faint/80">Standing by — telemetry prints as the desk cycles.</p>
          ) : (
            latest.map((line, i) => (
              <p
                key={`${i}-${line.slice(0, 24)}`}
                className={cn(
                  "truncate",
                  i === 0 ? "text-cream/90" : "text-faint",
                )}
              >
                <span className="mr-1.5 text-brass/60">›</span>
                {line}
              </p>
            ))
          )}
        </div>

        <div className="flex shrink-0 items-center self-center text-brass/80">
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </button>

      {open && (
        <div className="max-h-56 overflow-y-auto border-t border-line/60 bg-panel/90 px-3 py-2 md:px-6">
          {full.length === 0 ? (
            <p className="font-mono text-[11px] text-faint">No events yet.</p>
          ) : (
            <ul className="space-y-1 font-mono text-[11px]">
              {full.map((line, idx) => (
                <li key={`${idx}-${line.slice(0, 32)}`} className="flex gap-2 text-cream/85">
                  <span className="shrink-0 text-brass/50">›</span>
                  <span className="min-w-0 break-words">{line}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
