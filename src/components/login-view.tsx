import { useState } from "react";
import { LogIn } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Mascot } from "@/components/mascot";
import { Button, Card } from "@/components/ui";
import { supabaseSetupHint } from "@/lib/supabase-gate";
import { cn } from "@/lib/cn";

/**
 * Personal-project login: website name + mascot, sign-in only.
 * Accounts are created manually in Supabase — there is no sign-up surface.
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
      }
      // Success flows through onAuthStateChange — no navigation needed.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-10">
      <Card className="w-full max-w-sm p-6 text-center md:p-8">
        <div className="flex flex-col items-center">
          <Mascot className="size-16" />
          <p className="mt-3 text-xs tracking-widest text-brass uppercase">Monroe</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-cream">Sniper Bot</h1>
          <p className="mt-1 text-xs text-faint">Private paper-trading desk. Sign in to continue.</p>
        </div>

        {misconfigured ? (
          <p className="mt-5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-left text-xs leading-relaxed text-amber-300">
            {supabaseSetupHint()}
          </p>
        ) : (
          <form onSubmit={submit} className="mt-5 flex flex-col gap-3 text-left">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-wider text-faint uppercase">Email</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="field h-11 rounded-xl border border-line bg-panel-2 px-3 text-sm text-cream outline-none focus:border-brass"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-wider text-faint uppercase">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="field h-11 rounded-xl border border-line bg-panel-2 px-3 text-sm text-cream outline-none focus:border-brass"
              />
            </label>
            {error ? (
              <p className="rounded-lg border border-loss/40 bg-loss/10 p-2.5 text-xs text-loss">{error}</p>
            ) : null}
            <Button type="submit" variant="solid" disabled={busy || !email.trim() || !password} className={cn("mt-1 h-11 font-semibold")}>
              <LogIn className="mr-1.5 size-4" />
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        )}

        <p className="mt-5 border-t border-line/60 pt-3 text-[11px] leading-relaxed text-faint">
          No sign-up here — accounts are created manually in Supabase for invited users only.
        </p>
      </Card>
    </div>
  );
}
