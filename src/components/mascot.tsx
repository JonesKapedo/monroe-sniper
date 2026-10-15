import { useEffect, useRef } from "react";
import { useMascot } from "@/lib/mascot";

/**
 * Anatomically realistic skull with morph targets for facial expressions
 * Morph targets: neutral, focus, alert, suspicious, confused, bright, 
 * look-left, look-right, look-down, nod, shake, pulse
 */
export function Mascot({
  className,
  turbo = false,
  size,
}: {
  className?: string;
  turbo?: boolean;
  /** Size in pixels, default 64 */
  size?: number;
}) {
  const mood = useMascot((state) => state.mood);
  const sequence = useMascot((state) => state.sequence);
  const morphTargets = useMascot((state) => state.morphTargets);
  const lastReactedAt = useRef(0);

  // Interaction listener for ambient awareness
  useEffect(() => {
    const reactToInteraction = () => {
      const now = Date.now();
      if (now - lastReactedAt.current < 700) return;
      lastReactedAt.current = now;
      // Subtle ambient reaction
      if (Math.random() < 0.3) {
        useMascot.getState().ping("alert");
      }
    };
    window.addEventListener("pointerdown", reactToInteraction);
    window.addEventListener("keydown", reactToInteraction);
    return () => {
      window.removeEventListener("pointerdown", reactToInteraction);
      window.removeEventListener("keydown", reactToInteraction);
    };
  }, []);

  // Mood auto-reset
  useEffect(() => {
    if (!mood) return;
    const timer = window.setTimeout(() => useMascot.getState().reset(), 2000);
    return () => window.clearTimeout(timer);
  }, [mood, sequence]);

  const s = size ?? 64;
  
  // Compute morph values for SVG transforms
  const focus = morphTargets.focus || 0;
  const alert = morphTargets.alert || 0;
  const suspicious = morphTargets.suspicious || 0;
  const confused = morphTargets.confused || 0;
  const bright = morphTargets.bright || 0;
  const nod = morphTargets.nod || 0;
  const shake = morphTargets.shake || 0;
  const lookLeft = morphTargets["look-left"] || 0;
  const lookRight = morphTargets["look-right"] || 0;
  const lookDown = morphTargets["look-down"] || 0;
  const pulse = morphTargets.pulse || 0;

  // Eye position calculations
  const eyeBaseX = { left: 18.8, right: 29.2 };
  const eyeBaseY = 22.1;
  const eyeOffsetX = (lookRight - lookLeft) * 1.5;
  const eyeOffsetY = lookDown * 2;
  const pupilScale = 1 + pulse * 0.3 + alert * 0.2;

  // Jaw position
  const jawOpen = (alert * 0.5 + confused * 0.3) * 2;

  // Head tilt for nod/shake
  const headRotate = (nod * 0.15 - shake * 0.1) * 5; // degrees
  const headTranslateY = nod * -2;

  // Brow positions
  const browInnerY = 19.6 - focus * 1 - alert * 0.5;
  const browOuterY = 19.6 + suspicious * 0.5 - confused * 0.3;

  // Mouth/jaw
  const jawY = 35.4 + jawOpen;
  const mouthCurve = bright ? -1 : confused * 0.5;

  return (
    <span 
      className="relative inline-flex mascot-float" 
      data-turbo={turbo ? "on" : "off"}
      style={{ 
        transform: `rotate(${headRotate}deg) translateY(${headTranslateY}px)`,
        transformOrigin: "center center",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      } as React.CSSProperties}
    >
      {turbo && (
        <>
          <span className="mascot-flame" aria-hidden="true" />
          <span className="mascot-smoke mascot-smoke-1" aria-hidden="true" />
          <span className="mascot-smoke mascot-smoke-2" aria-hidden="true" />
        </>
      )}
      
      <svg
        aria-label={
          turbo 
            ? "Monroe skull, turbocharged" 
            : mood 
              ? `Monroe skull, ${mood}` 
              : "Monroe human skull"
        }
        className={className}
        data-mood={turbo ? "turbo" : (mood ?? "idle")}
        role="img"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        width={s}
        height={s}
        style={{
          transform: `rotate(${headRotate}deg) translateY(${headTranslateY}px)`,
          transformOrigin: "center center",
        } as React.CSSProperties}
      >
        <defs>
          {/* Filter for eye glow */}
          <filter id="eyeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={1.5 + pulse * 2} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          {/* Jaw clipping path for open mouth */}
          <clipPath id="jawClip">
            <path d="M16 35.4 Q24 {jawY} 32 35.4 L32 48 L16 48 Z" />
          </clipPath>
        </defs>

        {/* === CRANIUM === */}
        <path
          d="M24 3.5c-9.8 0-17 7.6-17 17.8 0 5.2 1.9 9 5.4 11.5l.7 6.5c.2 2 1.9 3.4 3.9 3.4h14c2 0 3.7-1.4 3.9-3.4l.7-6.5c3.5-2.5 5.4-6.3 5.4-11.5 0-10.2-7.2-17.8-17-17.8Z"
          fill="var(--color-cream)"
          stroke="var(--color-brass)"
          strokeWidth="2"
          strokeLinejoin="round"
          style={{ filter: suspicious > 0 ? "drop-shadow(0 0 4px #ff4530)" : "none" }}
        />
        
        {/* Temple shading */}
        <path
          d="M10.6 21.5c-.7-6.3 2.2-12.1 7.2-15C13.4 8.3 10.9 14 11.1 21.4c.1 3.1 1 6 2.7 8.5-1.8-2.4-2.9-5.2-3.2-8.4Z"
          fill="#000" opacity=".16" />
        <path
          d="M37.4 21.5c.7-6.3-2.2-12.1-7.2-15 4.4 1.8 6.9 7.5 6.7 14.9-.1 3.1-1 6-2.7 8.5 1.8-2.4 2.9-5.2 3.2-8.4Z"
          fill="#000" opacity=".16" />
        
        {/* Crown highlight */}
        <path
          d="M14.5 11.5c2.6-3.4 5.9-5.2 9.5-5.2"
          stroke="#fff" opacity=".35" strokeWidth="1.6" strokeLinecap="round" />
        
        {/* Forehead crack */}
        <path
          d="M30.5 6.8 28.6 10l1.6 2.1-2.4 3.1"
          stroke="var(--color-line)" strokeWidth=".9" 
          strokeLinecap="round" strokeLinejoin="round" opacity=".8" />
        
        {/* BROW RIDGES - morphable */}
        <path
          d={`M14.2 ${browInnerY}c2.6-1.7 5.7-2.3 8.3-1.5M33.8 ${browOuterY}c-2.6-1.7-5.7-2.3-8.3-1.5`}
          stroke="var(--color-brass)" 
          strokeWidth={1.2 + alert * 0.5} 
          strokeLinecap="round"
          style={{ transition: "stroke-width 0.3s" }}
        />
        
        {/* EYE SOCKETS */}
        <path
          d="M15 19.2c1.9-1.7 5.3-1.8 6.9-.1 1.6 1.8 1.8 4.6.1 6.6-1.7 2-4.9 2.4-6.9.9-2-1.4-2.1-5.2-.1-7.4Z"
          fill="var(--color-ink)" stroke="var(--color-line)" strokeWidth=".8" />
        <path
          d="M33 19.2c-1.9-1.7-5.3-1.8-6.9-.1-1.6 1.8-1.8 4.6-.1 6.6 1.7 2 4.9 2.4 6.9.9 2-1.4 2.1-5.2.1-7.4Z"
          fill="var(--color-ink)" stroke="var(--color-line)" strokeWidth=".8" />
        
        {/* Socket inner shadow */}
        <ellipse cx="18.6" cy="23.4" rx="2.6" ry="1.8" fill="#000" opacity=".45" />
        <ellipse cx="29.4" cy="23.4" rx="2.6" ry="1.8" fill="#000" opacity=".45" />
        
        {/* PUPILS - fully morphable */}
        <g filter="url(#eyeGlow)">
          {/* Left pupil */}
          <circle 
            cx={eyeBaseX.left + eyeOffsetX} 
            cy={eyeBaseY + eyeOffsetY} 
            r={1.35 * pupilScale} 
            fill={turbo ? "#ff4530" : "var(--color-brass)"}
            style={{
              transition: "cx 0.3s cubic-bezier(0.4, 0, 0.2, 1), cy 0.3s, r 0.2s",
              transformOrigin: `${eyeBaseX.left}px ${eyeBaseY}px`,
            }}
          />
          {/* Right pupil */}
          <circle 
            cx={eyeBaseX.right + eyeOffsetX} 
            cy={eyeBaseY + eyeOffsetY} 
            r={1.35 * pupilScale} 
            fill={turbo ? "#ff4530" : "var(--color-brass)"}
            style={{
              transition: "cx 0.3s cubic-bezier(0.4, 0, 0.2, 1), cy 0.3s, r 0.2s",
              transformOrigin: `${eyeBaseX.right}px ${eyeBaseY}px`,
            }}
          />
          
          {/* Pupil dilation for alert/focus */}
          {alert > 0 && (
            <>
              <circle 
                cx={eyeBaseX.left + eyeOffsetX} 
                cy={eyeBaseY + eyeOffsetY} 
                r={1.35 * (1 + alert * 0.5)} 
                fill="transparent"
                stroke="var(--color-brass)"
                strokeWidth={alert * 1.5}
                opacity={0.5 * alert}
              />
              <circle 
                cx={eyeBaseX.right + eyeOffsetX} 
                cy={eyeBaseY + eyeOffsetY} 
                r={1.35 * (1 + alert * 0.5)} 
                fill="transparent"
                stroke="var(--color-brass)"
                strokeWidth={alert * 1.5}
                opacity={0.5 * alert}
              />
            </>
          )}
          
          {/* Focus crosshairs */}
          {focus > 0 && (
            <>
              <line 
                x1={eyeBaseX.left - 4} y1={eyeBaseY} 
                x2={eyeBaseX.left + 4} y2={eyeBaseY} 
                stroke="var(--color-brass)" strokeWidth={0.5} opacity={focus}
              />
              <line 
                x1={eyeBaseX.left} y1={eyeBaseY - 4} 
                x2={eyeBaseX.left} y2={eyeBaseY + 4} 
                stroke="var(--color-brass)" strokeWidth={0.5} opacity={focus}
              />
              <line 
                x1={eyeBaseX.right - 4} y1={eyeBaseY} 
                x2={eyeBaseX.right + 4} y2={eyeBaseY} 
                stroke="var(--color-brass)" strokeWidth={0.5} opacity={focus}
              />
              <line 
                x1={eyeBaseX.right} y1={eyeBaseY - 4} 
                x2={eyeBaseX.right} y2={eyeBaseY + 4} 
                stroke="var(--color-brass)" strokeWidth={0.5} opacity={focus}
              />
            </>
          )}
        </g>
        
        {/* Socket inner shadow - morph with look direction */}
        <ellipse 
          cx={18.6 + eyeOffsetX * 0.5} 
          cy={23.4 + eyeOffsetY * 0.3} 
          rx={2.6} ry={1.8} fill="#000" opacity=".45" 
          style={{ transition: "cx 0.3s, cy 0.3s" }}
        />
        <ellipse 
          cx={29.4 + eyeOffsetX * 0.5} 
          cy={23.4 + eyeOffsetY * 0.3} 
          rx={2.6} ry={1.8} fill="#000" opacity=".45"
          style={{ transition: "cx 0.3s, cy 0.3s" }}
        />
        
        {/* NASAL CAVITY */}
        <path
          d="M24 26.3c-.5 2.5-2.9 4.4-2.9 6.4 0 1.5 1.3 2.4 2.9 2.4s2.9-.9 2.9-2.4c0-2-2.4-3.9-2.9-6.4Z"
          fill="var(--color-ink)"
          stroke="var(--color-brass)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        
        {/* CHEEKBONES */}
        <path
          d="M12.3 28.6c2.9 1.7 6.2 2.1 9.3.9M35.7 28.6c-2.9 1.7-6.2 2.1-9.3.9"
          stroke="var(--color-brass)" strokeWidth="1" strokeLinecap="round" />
        
        {/* JAW - morphable for expressions */}
        <path
          d={`M15.3 31.2c2.1.8 4.3.9 6.5.3M32.7 31.2c-2.1.8-4.3.9-6.5.3M16 ${jawY}l1.2 3.7h13.6l1.2-3.7c-2.5.7-5.2 1-8 1s-5.5-.3-8-1Z`}
          fill="var(--color-panel-2)"
          stroke="var(--color-brass)"
          strokeWidth="1.1"
          strokeLinejoin="round"
          style={{ transition: "d 0.3s" }}
        />
        
        {/* Teeth lines */}
        <path
          d={`M19.2 ${36.2 + jawOpen * 0.5}v${2.8 + jawOpen}m3.2-${2.7 + jawOpen * 0.5}v${2.8 + jawOpen}m3.2-${2.8 + jawOpen * 0.5}v${2.8 + jawOpen}m3.2-${2.8 + jawOpen * 0.5}v${2.8 + jawOpen}m3.2-${2.6 + jawOpen * 0.5}v${2.6 + jawOpen}`}
          stroke="var(--color-line)" strokeWidth=".9" strokeLinecap="round" />
        
        {/* MOUTH CURVE for bright/confused */}
        {mouthCurve !== 0 && (
          <path
            d={`M20 ${34 + mouthCurve * 3} Q24 ${34 + mouthCurve * 6} 28 ${34 + mouthCurve * 3}`}
            stroke="var(--color-brass)"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            opacity={Math.abs(mouthCurve)}
          />
        )}
        
        {/* TURBO INDICATOR - star on forehead */}
        {mood === "bright" && !turbo ? (
          <path
            d="m40 7 .7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"
            fill="var(--color-brass)"
            style={{ animation: "twinkle 1s ease-in-out infinite" }}
          />
        ) : null}
        
        {/* TURBO EYES */}
        {turbo && (
          <g className="mascot-turbo-eyes" fill="#ff4530">
            <circle cx={18.8} cy={22.1} r={1.7} style={{ animation: "turbo-pulse 0.3s ease-in-out infinite" }} />
            <circle cx={29.2} cy={22.1} r={1.7} style={{ animation: "turbo-pulse 0.3s ease-in-out infinite reverse" }} />
          </g>
        )}
      </svg>
    </span>
  );
}

