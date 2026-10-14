import { useEffect, useRef } from "react";
import { useMascot } from "@/lib/mascot";

export function Mascot({ className, turbo = false }: { className?: string; turbo?: boolean }) {
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
    <span className="relative inline-flex mascot-float" data-turbo={turbo ? "on" : "off"}>
      {turbo && (
        <>
          <span className="mascot-flame" aria-hidden="true" />
          <span className="mascot-smoke mascot-smoke-1" aria-hidden="true" />
          <span className="mascot-smoke mascot-smoke-2" aria-hidden="true" />
        </>
      )}
    <svg
      aria-label={turbo ? "Monroe skull, turbocharged" : mood ? `Monroe skull, ${mood}` : "Monroe human skull"}
      className={className}
      data-mood={turbo ? "turbo" : (mood ?? "idle")}
      role="img"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Cranium — heavy bone outline */}
      <path
        d="M24 3.5c-9.8 0-17 7.6-17 17.8 0 5.2 1.9 9 5.4 11.5l.7 6.5c.2 2 1.9 3.4 3.9 3.4h14c2 0 3.7-1.4 3.9-3.4l.7-6.5c3.5-2.5 5.4-6.3 5.4-11.5 0-10.2-7.2-17.8-17-17.8Z"
        fill="var(--color-cream)"
        stroke="var(--color-brass)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Temple shading — left and right */}
      <path
        d="M10.6 21.5c-.7-6.3 2.2-12.1 7.2-15C13.4 8.3 10.9 14 11.1 21.4c.1 3.1 1 6 2.7 8.5-1.8-2.4-2.9-5.2-3.2-8.4Z"
        fill="#000"
        opacity=".16"
      />
      <path
        d="M37.4 21.5c.7-6.3-2.2-12.1-7.2-15 4.4 1.8 6.9 7.5 6.7 14.9-.1 3.1-1 6-2.7 8.5 1.8-2.4 2.9-5.2 3.2-8.4Z"
        fill="#000"
        opacity=".16"
      />
      {/* Crown highlight */}
      <path
        d="M14.5 11.5c2.6-3.4 5.9-5.2 9.5-5.2"
        stroke="#fff"
        opacity=".35"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Forehead crack — battle character */}
      <path
        d="M30.5 6.8 28.6 10l1.6 2.1-2.4 3.1"
        stroke="var(--color-line)"
        strokeWidth=".9"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity=".8"
      />
      {/* Brow ridge */}
      <path
        d="M14.2 19.6c2.6-1.7 5.7-2.3 8.3-1.5M33.8 19.6c-2.6-1.7-5.7-2.3-8.3-1.5"
        stroke="var(--color-brass)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Deep angular eye sockets */}
      <path
        d="M15 19.2c1.9-1.7 5.3-1.8 6.9-.1 1.6 1.8 1.8 4.6.1 6.6-1.7 2-4.9 2.4-6.9.9-2-1.4-2.1-5.2-.1-7.4Z"
        fill="var(--color-ink)"
        stroke="var(--color-line)"
        strokeWidth=".8"
      />
      <path
        d="M33 19.2c-1.9-1.7-5.3-1.8-6.9-.1-1.6 1.8-1.8 4.6-.1 6.6 1.7 2 4.9 2.4 6.9.9 2-1.4 2.1-5.2.1-7.4Z"
        fill="var(--color-ink)"
        stroke="var(--color-line)"
        strokeWidth=".8"
      />
      {/* Socket inner shadow for depth */}
      <ellipse cx="18.6" cy="23.4" rx="2.6" ry="1.8" fill="#000" opacity=".45" />
      <ellipse cx="29.4" cy="23.4" rx="2.6" ry="1.8" fill="#000" opacity=".45" />
      {/* Living pupils — always watching, drifting slowly */}
      {!turbo ? (
        <g className="mascot-pupils" fill="var(--color-brass)">
          <circle cx="18.8" cy="22.1" r="1.35" />
          <circle cx="29.2" cy="22.1" r="1.35" />
        </g>
      ) : null}
      {turbo ? (
        <g className="mascot-turbo-eyes" fill="#ff4530">
          <circle cx="18.8" cy="22.1" r="1.7" />
          <circle cx="29.2" cy="22.1" r="1.7" />
        </g>
      ) : null}
      {/* Nasal cavity — bold and hollow */}
      <path
        d="M24 26.3c-.5 2.5-2.9 4.4-2.9 6.4 0 1.5 1.3 2.4 2.9 2.4s2.9-.9 2.9-2.4c0-2-2.4-3.9-2.9-6.4Z"
        fill="var(--color-ink)"
        stroke="var(--color-brass)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Cheekbones */}
      <path
        d="M12.3 28.6c2.9 1.7 6.2 2.1 9.3.9M35.7 28.6c-2.9 1.7-6.2 2.1-9.3.9"
        stroke="var(--color-brass)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {/* Jaw with teeth */}
      <path
        d="M15.3 31.2c2.1.8 4.3.9 6.5.3M32.7 31.2c-2.1.8-4.3.9-6.5.3M16 35.4l1.2 3.7h13.6l1.2-3.7c-2.5.7-5.2 1-8 1s-5.5-.3-8-1Z"
        fill="var(--color-panel-2)"
        stroke="var(--color-brass)"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M19.2 36.2v2.8m3.2-2.7v2.8m3.2-2.8v2.8m3.2-2.8v2.8m3.2-2.6v2.6"
        stroke="var(--color-line)"
        strokeWidth=".9"
        strokeLinecap="round"
      />
      {mood === "bright" && !turbo ? (
        <path
          d="m40 7 .7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"
          fill="var(--color-brass)"
        />
      ) : null}
    </svg>
    </span>
  );
}
