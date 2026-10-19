import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
export function Button({
  variant = "solid",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "solid" | "ghost" | "danger" }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition disabled:opacity-40",
        variant === "solid" && "bg-brass text-brass-ink hover:bg-brass/90",
        variant === "ghost" && "border border-line bg-panel-2 text-cream hover:border-brass",
        variant === "danger" && "bg-loss text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-xl border border-line bg-panel p-4", className)}>{children}</section>;
}

export function Label({ children }: { children: ReactNode }) {
  return <p className="text-xs tracking-wide text-faint uppercase">{children}</p>;
}

export type FlowStage = "now" | "discover" | "research" | "account";

const STAGE_META: Record<FlowStage, { label: string; icon: string }> = {
  now: { label: "Live · now", icon: "◈" },
  discover: { label: "Discover", icon: "◇" },
  research: { label: "Research", icon: "◎" },
  account: { label: "Account", icon: "▤" },
};

export function Badge({
  tone = "muted",
  className,
  children,
}: {
  tone?: "muted" | "good" | "warn" | "live";
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wider uppercase",
        tone === "good" && "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
        tone === "warn" && "border-amber-500/40 bg-amber-500/15 text-amber-300",
        tone === "live" && "border-brass/40 bg-brass/15 text-brass",
        tone === "muted" && "border-line bg-panel-2 text-faint",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Consistent page banner. The `stage` chip ties every page into one live-flow. */
export function PageHeader({
  stage,
  title,
  badge,
  subtitle,
  actions,
  className,
  children,
}: {
  stage: FlowStage;
  title: string;
  badge?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const meta = STAGE_META[stage];
  const right = actions ?? children;
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-line bg-panel p-4 md:flex-row md:items-center md:justify-between md:p-5",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[10px] font-semibold tracking-wider text-brass uppercase">
          <span aria-hidden="true">{meta.icon}</span>
          <span>{meta.label}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
          {badge}
        </div>
        {subtitle ? <p className="mt-1 text-xs text-faint md:text-sm">{subtitle}</p> : null}
      </div>
      {right ? <div className="flex flex-wrap items-center gap-2 sm:gap-3">{right}</div> : null}
    </div>
  );
}

/** Card with a uniform title row — keeps section rhythm identical across pages. */
export function SectionCard({
  title,
  icon,
  aside,
  className,
  children,
}: {
  title: ReactNode;
  icon?: ReactNode;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border border-line bg-panel p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          {icon}
          <Label>{title}</Label>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-line bg-panel-2 p-3", className)}>
      <p className="text-[10px] tracking-wider text-faint uppercase">{label}</p>
      <p className="num mt-1 font-mono text-base font-semibold text-cream">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-faint">{hint}</p> : null}
    </div>
  );
}
