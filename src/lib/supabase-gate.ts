import { useEffect, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getSupabase, supabaseConfig } from "@/lib/supabase";

export type SupabaseGate =
  | { status: "misconfigured"; client: null; session: null }
  | { status: "loading"; client: SupabaseClient; session: null }
  | { status: "signed-out"; client: SupabaseClient; session: null }
  | { status: "signed-in"; client: SupabaseClient; session: Session };

/**
 * Gate state for the personal Supabase login. Session persists in
 * localStorage via supabase-js, so refreshes keep you signed in.
 */
export function useSupabaseGate(): SupabaseGate {
  const [gate, setGate] = useState<SupabaseGate>(() => {
    const client = getSupabase();
    if (!client) return { status: "misconfigured", client: null, session: null };
    return { status: "loading", client, session: null };
  });

  useEffect(() => {
    const client = getSupabase();
    if (!client) {
      setGate({ status: "misconfigured", client: null, session: null });
      return;
    }
    let live = true;
    void client.auth.getSession().then(({ data }) => {
      if (!live) return;
      setGate(
        data.session
          ? { status: "signed-in", client, session: data.session }
          : { status: "signed-out", client, session: null },
      );
    });
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      if (!live) return;
      setGate(
        session
          ? { status: "signed-in", client, session }
          : { status: "signed-out", client, session: null },
      );
    });
    return () => {
      live = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return gate;
}

export function supabaseSetupHint(): string {
  const { url, anonKey } = supabaseConfig();
  const missing = [
    url ? null : "VITE_SUPABASE_URL",
    anonKey ? null : "VITE_SUPABASE_ANON_KEY",
  ].filter((x): x is string => x !== null);
  return `Missing browser Supabase config: ${missing.join(" + ")}. Add them in Vercel (project Settings → Environment Variables) and redeploy — only VITE_-prefixed vars reach the login screen.`;
}
