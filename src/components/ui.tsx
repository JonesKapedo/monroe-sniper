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
