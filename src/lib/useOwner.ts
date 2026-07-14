"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { isOwnerEmail } from "@/lib/owner";

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
      if (!cancelled) setIsOwner(isOwnerEmail(session?.user?.email));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsOwner(isOwnerEmail(session?.user?.email));
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return isOwner;
}
