import { create } from "zustand";

export type NotificationSeverity = "info" | "success" | "warn" | "danger";

export type AppNotification = {
  id: string;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  at: number;
  read: boolean;
  tag: string | null;
};

export type NotifyInput = {
  severity?: NotificationSeverity;
  title: string;
  body?: string;
  tag?: string;
};

const MAX_ITEMS = 60;
const DEDUPE_MS = 8_000;

let seq = 0;
function nextId(): string {
  seq += 1;
  return `n${Date.now().toString(36)}-${seq}`;
}

function readDesktopPref(): boolean {
  try {
    return localStorage.getItem("monroe.notifyDesktop") === "1";
  } catch {
    return false;
  }
}

function writeDesktopPref(value: boolean): void {
  try {
    localStorage.setItem("monroe.notifyDesktop", value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

type NotificationState = {
  items: AppNotification[];
  desktopEnabled: boolean;
  notify: (input: NotifyInput) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  dismiss: (id: string) => void;
  clear: () => void;
  enableDesktop: () => Promise<boolean>;
  disableDesktop: () => void;
};

export const useNotifications = create<NotificationState>((set, get) => ({
  items: [],
  desktopEnabled: typeof window !== "undefined" ? readDesktopPref() : false,

  notify: (input) => {
    const severity = input.severity ?? "info";
    const tag = input.tag ?? null;
    const now = Date.now();
    const existing = get().items;
    if (tag) {
      const dup = existing.find((n) => n.tag === tag && now - n.at < DEDUPE_MS);
      if (dup) return;
    }
    const entry: AppNotification = {
      id: nextId(),
      severity,
      title: input.title,
      body: input.body ?? null,
      at: now,
      read: false,
      tag,
    };
    set({ items: [entry, ...existing].slice(0, MAX_ITEMS) });

    const { desktopEnabled } = get();
    if (
      desktopEnabled &&
      typeof window !== "undefined" &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted" &&
      typeof document !== "undefined" &&
      document.hidden
    ) {
      try {
        new Notification(entry.title, { body: entry.body ?? undefined, tag: tag ?? entry.id });
      } catch {
        /* notifications are best-effort */
      }
    }
  },

  markRead: (id) =>
    set((s) => ({ items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
  markAllRead: () => set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })) })),
  dismiss: (id) => set((s) => ({ items: s.items.filter((n) => n.id !== id) })),
  clear: () => set({ items: [] }),

  enableDesktop: async () => {
    if (typeof Notification === "undefined") return false;
    let permission = Notification.permission;
    if (permission === "default") {
      try {
        permission = await Notification.requestPermission();
      } catch {
        permission = "denied";
      }
    }
    const ok = permission === "granted";
    writeDesktopPref(ok);
    set({ desktopEnabled: ok });
    return ok;
  },

  disableDesktop: () => {
    writeDesktopPref(false);
    set({ desktopEnabled: false });
  },
}));

/** Convenience for non-React callers (stores, effects). */
export function notify(input: NotifyInput): void {
  useNotifications.getState().notify(input);
}
