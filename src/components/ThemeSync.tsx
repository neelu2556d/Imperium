"use client";

import { useEffect } from "react";
import { fetchThemePreference } from "@/lib/supabase/profile";
import { applyTheme } from "@/lib/theme";

/**
 * Reconciles the accent theme with the durable Supabase copy once, on load.
 *
 * The blocking script in `layout.tsx` has already applied the locally-cached
 * theme before first paint (no flash). This then fetches the profile's saved
 * `theme_preference` and, if it differs from what's on screen, applies it —
 * covering the first load on a new device where localStorage is empty. Renders
 * nothing; it exists purely for the effect.
 */
export default function ThemeSync() {
  useEffect(() => {
    let cancelled = false;
    fetchThemePreference()
      .then((theme) => {
        if (cancelled) return;
        if (document.documentElement.dataset.theme !== theme) {
          applyTheme(theme);
        }
      })
      .catch(() => {
        /* offline / no session yet — the pre-paint local theme stays */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
