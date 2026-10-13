import { useEffect, useRef } from "react";
import { useMascot } from "@/lib/mascot";

export function Mascot({ className }: { className?: string }) {
  const mood = useMascot((state) => state.mood);
  const sequence = useMascot((state) => state.sequence);
  const lastReactedAt = useRef(0);

  useEffect(() => {
    const reactToInteraction = () => {
      const now = Date.now();
      if (now - lastReactedAt.current < 700) return;
      lastReactedAt.current = now;
      useMascot.getState().ping("alert");
    };
    window.addEventListener("pointerdown", reactToInteraction);
    window.addEventListener("keydown", reactToInteraction);
    return () => {
      window.removeEventListener("pointerdown", reactToInteraction);
      window.removeEventListener("keydown", reactToInteraction);
    };
  }, []);

  useEffect(() => {
    if (!mood) return;
    const timer = window.setTimeout(() => useMascot.getState().reset(), 1800);
    return () => window.clearTimeout(timer);
  }, [mood, sequence]);

  return (
    <svg
      aria-label={mood ? `Monroe skull, ${mood}` : "Monroe human skull"}
      className={className}
      data-mood={mood ?? "idle"}
      role="img"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M24 3.75c-9.4 0-16.4 7.3-16.4 17.1 0 5 1.8 8.7 5.2 11.1l.7 6.3c.2 1.8 1.8 3.1 3.6 3.1h14c1.8 0 3.4-1.3 3.6-3.1l.7-6.3c3.4-2.4 5.2-6.1 5.2-11.1 0-9.8-7-17.1-16.6-17.1Z"
        fill="var(--color-cream)"
        stroke="var(--color-brass)"
        strokeWidth="1.35"
      />
      <path
        d="M9.8 23.5c2.5-.4 4.1-1.8 5.2-4.4M38.2 23.5c-2.5-.4-4.1-1.8-5.2-4.4"
        stroke="var(--color-brass)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M13.1 21.6c.2-4.2 3.1-7.1 7-7.1 2 0 3.3.7 3.9 1.5.7-.8 2-1.5 3.9-1.5 3.9 0 6.8 2.9 7 7.1-.1 3.4-2.8 6-6.1 6-2 0-3.7-.8-4.8-2.2-1.1 1.4-2.8 2.2-4.8 2.2-3.3 0-6-2.6-6.1-6Z"
        fill="var(--color-ink)"
        stroke="var(--color-line)"
        strokeWidth="1"
      />
      {mood ? (
        <g fill="var(--color-brass)">
          <circle cx="18.8" cy="22.1" r="1.05" />
          <circle cx="29.2" cy="22.1" r="1.05" />
        </g>
      ) : null}
      <path
        d="M24 27.2c-.3 2.1-2.5 4.2-2.5 5.9 0 1.3 1 2.1 2.5 2.1s2.5-.8 2.5-2.1c0-1.7-2.2-3.8-2.5-5.9Z"
        fill="var(--color-ink)"
        stroke="var(--color-brass)"
        strokeWidth=".8"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 31.4c2 .7 4 .8 6 .2M32.5 31.4c-2 .7-4 .8-6 .2M16.2 35.6l1.1 3.5h13.4l1.1-3.5c-2.4.6-5 .9-7.8.9s-5.4-.3-7.8-.9Z"
        fill="var(--color-panel-2)"
        stroke="var(--color-brass)"
        strokeWidth=".9"
        strokeLinejoin="round"
      />
      <path
        d="M19.2 36.2v2.8m3.2-2.7v2.8m3.2-2.8v2.8m3.2-3v2.9"
        stroke="var(--color-line)"
        strokeWidth=".8"
        strokeLinecap="round"
      />
      {mood === "bright" ? (
        <path
          d="m40 7 .7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"
          fill="var(--color-brass)"
        />
      ) : null}
    </svg>
  );
}
