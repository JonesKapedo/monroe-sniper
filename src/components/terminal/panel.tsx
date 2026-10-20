import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Dense panel chrome for the trader workspace: a compact uppercase header rail
 * with optional right-aligned actions, then a fill-scroll body. Used by every
 * pane so the terminal reads as one instrument.
 */
export function WorkspacePanel({
  title,
  hint,
  actions,
  children,
  className,
  bodyClassName,
  scroll = true,
}: {
  title: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  scroll?: boolean;
}) {
  return (
    <section className={cn("flex h-full min-h-0 flex-col bg-panel", className)}>
      <header className="flex h-8 shrink-0 items-center gap-2 border-b border-line bg-panel-2/70 px-2.5">
        <h2 className="text-[10px] font-semibold tracking-[0.14em] text-brass uppercase">{title}</h2>
        {hint ? <span className="truncate text-[10px] text-faint">{hint}</span> : null}
        {actions ? <div className="ml-auto flex items-center gap-1">{actions}</div> : null}
      </header>
      <div className={cn("min-h-0 flex-1", scroll && "overflow-y-auto", bodyClassName)}>{children}</div>
    </section>
  );
}

export function ToolButton({
  active,
  title,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  title?: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-6 items-center rounded px-1.5 font-mono text-[10px] transition-colors",
        active ? "bg-brass/20 text-brass" : "text-faint hover:bg-panel-2 hover:text-cream",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Segmented control used for timeframe / side / order-type switches. */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  className,
  size = "sm",
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string; tone?: "gain" | "loss" }[];
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("inline-flex rounded border border-line bg-panel p-0.5", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded font-mono transition-colors",
              size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
              active
                ? opt.tone === "gain"
                  ? "bg-gain/20 text-gain"
                  : opt.tone === "loss"
                    ? "bg-loss/20 text-loss"
                    : "bg-brass/20 text-brass"
                : "text-faint hover:text-cream",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
