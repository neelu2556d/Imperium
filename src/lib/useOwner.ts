"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { isOwnerEmail } from "@/lib/owner";

/**
 * The owner email for a session. A real account carries it on `user.email`; an
 * email-only "device session" is an anonymous user with the address stashed in
 * `user_metadata.claimed_email` (see `signInWithEmailOnly`). We must honour both
 * so this hook agrees with the server guard in `proxy.ts`, which reads the same
 * `claimed_email` fallback — otherwise the Business tab stays hidden for an
 * owner who signed in via the confirmation-wall fallback.
 */
function sessionEmail(user?: User | null): string | null | undefined {
  if (user?.email) return user.email;
  const claimed = (user?.user_metadata as Record<string, unknown> | undefined)
    ?.claimed_email;
  return typeof claimed === "string" ? claimed : null;
}

/**
 * Returns whether the currently signed-in user is the app owner (see
 * `lib/owner.ts`). Reads the session on mount and stays in sync via
 * `onAuthStateChange`, so it flips correctly on sign-in/out.
 *
 * Starts `false` — the Business tab must never flash for a non-owner while the
 * session resolves. The server-side `proxy.ts` guard is the hard gate; this
 * hook only decides whether to render the tab entry point.
 */
export function useOwner(): boolean {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setIsOwner(isOwnerEmail(sessionEmail(session?.user)));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsOwner(isOwnerEmail(sessionEmail(session?.user)));
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return isOwner;
}
