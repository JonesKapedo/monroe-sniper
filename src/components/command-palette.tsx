import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CornerDownLeft, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { useDesk } from "@/lib/desk-store";
import { useNotifications } from "@/lib/notifications";

type Command = {
  id: string;
  label: string;
  hint: string;
  group: string;
  run: () => void;
};

export const OPEN_PALETTE_EVENT = "monroe:open-palette";

const ROUTES: { to: string; label: string; group: string }[] = [
  { to: "/", label: "Desk", group: "Navigate" },
  { to: "/tape", label: "Tape", group: "Navigate" },
  { to: "/signals", label: "Signals", group: "Navigate" },
  { to: "/opportunities", label: "Scanner", group: "Navigate" },
  { to: "/learn", label: "DYOR", group: "Navigate" },
  { to: "/wallet", label: "Wallet", group: "Navigate" },
  { to: "/settings", label: "Settings", group: "Navigate" },
];

export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = ROUTES.map((r) => ({
      id: `nav:${r.to}`,
      label: `Go to ${r.label}`,
      hint: r.to,
      group: r.group,
      run: () => navigate({ to: r.to as never }),
    }));
    const desk = useDesk.getState();
    const actions: Command[] = [
      {
        id: "act:power",
        label: desk.power ? "Put sniper on standby" : "Arm sniper bot",
        hint: desk.power ? "pause entries" : "start scanning",
        group: "Actions",
        run: () => useDesk.getState().setPower(!useDesk.getState().power),
      },
      {
        id: "act:flatten",
        label: "Flatten all positions",
        hint: "close every open position",
        group: "Actions",
        run: () => useDesk.getState().flattenAll(),
      },
      {
        id: "act:desktop",
        label: useNotifications.getState().desktopEnabled
          ? "Disable desktop notifications"
          : "Enable desktop notifications",
        hint: "browser alerts when the tab is hidden",
        group: "Actions",
        run: () => {
          const store = useNotifications.getState();
          if (store.desktopEnabled) store.disableDesktop();
          else void store.enableDesktop();
        },
      },
    ];
    return [...nav, ...actions];
  }, [navigate, open]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((c) => `${c.label} ${c.hint} ${c.group}`.toLowerCase().includes(needle));
  }, [commands, q]);

  useEffect(() => {
    const openHandler = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, openHandler);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, openHandler);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setIndex(0);
    }
  }, [open]);

  if (!open) return null;

  const runAt = (i: number) => {
    const cmd = filtered[i];
    if (!cmd) return;
    setOpen(false);
    cmd.run();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/70 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search className="size-4 shrink-0 text-faint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((v) => Math.min(filtered.length - 1, v + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((v) => Math.max(0, v - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                runAt(index);
              }
            }}
            placeholder="Search pages and actions…"
            aria-label="Command palette"
            className="min-h-12 flex-1 bg-transparent text-sm text-cream outline-none placeholder:text-faint"
          />
          <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint">esc</span>
        </div>
        <ul className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-faint">No matches.</li>
          ) : (
            filtered.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => runAt(i)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left text-sm",
                    i === index ? "bg-brass/15 text-brass" : "text-cream hover:bg-panel-2",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  <span className="shrink-0 font-mono text-[10px] text-faint">{c.hint}</span>
                  {i === index && <CornerDownLeft className="size-3.5 shrink-0 text-brass" />}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
