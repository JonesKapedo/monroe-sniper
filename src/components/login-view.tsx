import { useState } from "react";
import { Activity, Lock, LogIn, Radar, ShieldCheck, TrendingUp } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Mascot } from "@/components/mascot";
import { Button, Card } from "@/components/ui";
import { supabaseSetupHint } from "@/lib/supabase-gate";
import { useMascot } from "@/lib/mascot";

const HIGHLIGHTS = [
  {
    icon: Radar,
    title: "Signal scanning",
    detail: "Live public feeds scored and ranked before anything reaches the book.",
  },
  {
    icon: ShieldCheck,
    title: "Risk-gated entries",
    detail: "Bracket, liquidity and drawdown gates clear before a single fill.",
  },
  {
    icon: TrendingUp,
    title: "Continuous learning",
    detail: "Closed trades retrain the score floor and position sizing.",
  },
];

/**
 * Personal-project login: brand lockup plus a single sign-in form.
 * Accounts are provisioned manually — there is no sign-up surface.
 */
export function LoginView({
  client,
  misconfigured,
}: {
  client: SupabaseClient | null;
  misconfigured: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!client || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: signInError } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(
          signInError.message === "Invalid login credentials"
            ? "Email or password is incorrect."
            : signInError.message,
        );
        try {
          useMascot.getState().react("login-fail");
        } catch {
          // mascot is UI-only
        }
      } else {
        try {
          useMascot.getState().react("login-success");
        } catch {
          // mascot is UI-only
        }
      }
      // Success flows through onAuthStateChange — no navigation needed.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Try again.");
      try {
        useMascot.getState().react("login-fail");
      } catch {
        // mascot is UI-only
      }
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "field h-11 w-full rounded-xl border border-line bg-panel-2 px-3.5 text-sm text-cream outline-none transition-colors focus:border-brass";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-4 py-10 text-cream">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_0%,rgba(190,150,74,0.16),transparent_72%)]"
      />

      <Card className="relative grid w-full max-w-4xl overflow-hidden p-0 md:grid-cols-2">
        {/* Brand & value column (desktop) */}
        <div className="hidden flex-col justify-between gap-8 border-r border-line/70 bg-panel-2/60 p-8 md:flex">
          <div>
            <div className="flex items-center gap-3">
              <Mascot className="size-11" />
              <div>
                <p className="text-[11px] tracking-[0.32em] text-brass uppercase">Monroe</p>
                <p className="text-lg font-semibold tracking-tight">Sniper Bot</p>
              </div>
            </div>
            <p className="mt-6 max-w-xs text-sm leading-relaxed text-faint">
              A systematic trading desk for scanning, risk-gating and executing trades —
              with a complete audit trail.
            </p>
            <ul className="mt-7 flex flex-col gap-5">
              {HIGHLIGHTS.map(({ icon: Icon, title, detail }) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-panel text-brass">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-cream">{title}</span>
                    <span className="block text-xs leading-relaxed text-faint">{detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="flex items-center gap-2 text-[11px] text-faint">
            <Activity className="size-3.5 text-brass" aria-hidden="true" />
            Access is limited to invited accounts.
          </p>
        </div>

        {/* Auth column */}
        <div className="flex flex-col justify-center p-6 sm:p-8">
          <div className="flex items-center gap-3 md:hidden">
            <Mascot className="size-10" />
            <div>
              <p className="text-[11px] tracking-[0.32em] text-brass uppercase">Monroe</p>
              <p className="text-base font-semibold tracking-tight">Sniper Bot</p>
            </div>
          </div>

          <div className="mt-8 md:mt-0">
            <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
            <p className="mt-1 text-xs text-faint">Enter your credentials to open the desk.</p>
          </div>

          {misconfigured ? (
            <div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-left">
              <p className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-amber-300 uppercase">
                <Lock className="size-3.5" aria-hidden="true" /> Configuration required
              </p>
              <p className="mt-2 text-xs leading-relaxed text-amber-200/90">{supabaseSetupHint()}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 flex flex-col gap-4 text-left">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold tracking-wider text-faint uppercase">
                  Email address
                </span>
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold tracking-wider text-faint uppercase">
                  Password
                </span>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={inputClass}
                />
              </label>
              {error ? (
                <p role="alert" className="rounded-lg border border-loss/40 bg-loss/10 p-2.5 text-xs text-loss">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                variant="solid"
                disabled={busy || !email.trim() || !password}
                className="mt-1 h-11 w-full font-semibold"
              >
                <LogIn className="mr-1.5 size-4" aria-hidden="true" />
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          )}

          <p className="mt-6 border-t border-line/60 pt-4 text-[11px] leading-relaxed text-faint">
            No self-service sign-up. Accounts are provisioned manually for invited users.
          </p>
        </div>
      </Card>
    </div>
  );
}
