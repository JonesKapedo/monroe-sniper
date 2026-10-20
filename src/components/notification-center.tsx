import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useNotifications, type AppNotification, type NotificationSeverity } from "@/lib/notifications";

function timeAgo(at: number): string {
  const secs = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

const DOT: Record<NotificationSeverity, string> = {
  info: "bg-brass",
  success: "bg-gain",
  warn: "bg-amber-400",
  danger: "bg-loss",
};

export function NotificationBell() {
  const items = useNotifications((s) => s.items);
  const desktopEnabled = useNotifications((s) => s.desktopEnabled);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const clear = useNotifications((s) => s.clear);
  const dismiss = useNotifications((s) => s.dismiss);
  const enableDesktop = useNotifications((s) => s.enableDesktop);
  const disableDesktop = useNotifications((s) => s.disableDesktop);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        onClick={() => {
          setOpen((v) => !v);
          if (!open && unread > 0) markAllRead();
        }}
        className="relative inline-flex min-h-11 items-center rounded-full border border-line bg-panel px-2.5 text-faint transition-colors hover:text-cream"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-loss px-1 text-[9px] font-bold text-ink">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[20rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-line bg-panel shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-xs font-semibold tracking-wider text-brass uppercase">Alerts</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void (desktopEnabled ? disableDesktop() : enableDesktop())}
                className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[10px] text-faint hover:text-cream"
                title="Toggle desktop notifications"
              >
                {desktopEnabled ? <Bell className="size-3" /> : <BellOff className="size-3" />}
                {desktopEnabled ? "Desktop on" : "Desktop off"}
              </button>
              <button
                type="button"
                onClick={clear}
                className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-faint hover:text-cream"
              >
                Clear
              </button>
            </div>
          </div>
          <ul className="max-h-80 divide-y divide-line/60 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-faint">No alerts yet.</li>
            ) : (
              items.map((n) => (
                <li key={n.id} className="flex items-start gap-2 px-3 py-2">
                  <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", DOT[n.severity])} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-cream">{n.title}</p>
                    {n.body && <p className="text-[11px] leading-snug text-faint">{n.body}</p>}
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-faint" suppressHydrationWarning>
                    {timeAgo(n.at)}
                  </span>
                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => dismiss(n.id)}
                    className="shrink-0 text-faint hover:text-cream"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

const TOAST_TONES: Record<NotificationSeverity, string> = {
  info: "border-brass/40 bg-panel",
  success: "border-gain/40 bg-panel",
  warn: "border-amber-500/40 bg-panel",
  danger: "border-loss/50 bg-panel",
};

export function NotificationToasts() {
  const items = useNotifications((s) => s.items);
  const dismiss = useNotifications((s) => s.dismiss);
  const [, force] = useState(0);

  useEffect(() => {
    const t = setInterval(() => force((v) => v + 1), 1500);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const recent = items.filter((n) => now - n.at < 7000).slice(0, 3);
  if (recent.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex w-[19rem] max-w-[calc(100vw-1.5rem)] flex-col gap-2 md:bottom-4">
      {recent.map((n: AppNotification) => (
        <div
          key={n.id}
          className={cn(
            "pointer-events-auto flex items-start gap-2 rounded-xl border px-3 py-2 shadow-lg backdrop-blur",
            TOAST_TONES[n.severity],
          )}
        >
          <TriangleAlert
            className={cn(
              "mt-0.5 size-3.5 shrink-0",
              n.severity === "danger" ? "text-loss" : n.severity === "warn" ? "text-amber-400" : "text-brass",
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-cream">{n.title}</p>
            {n.body && <p className="text-[11px] leading-snug text-faint">{n.body}</p>}
          </div>
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(n.id)} className="shrink-0 text-faint hover:text-cream">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
