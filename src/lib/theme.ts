import {
  DEFAULT_THEME,
  normalizeTheme,
  type ThemePreference,
} from "@/lib/supabase/profile";

/**
 * Client-side accent-theme helpers. The theme is stored in three places that
 * are kept in sync:
 *   1. `document.documentElement.dataset.theme` — what the CSS actually reads;
 *      swapping it recolours the whole app instantly via the accent tokens.
 *   2. `localStorage` — read by the blocking script in `layout.tsx` before first
 *      paint so returning users never see a flash of the wrong accent.
 *   3. Supabase (`profiles.theme_preference`) — the durable, cross-device copy,
 *      synced on load and on every change (see the settings switcher).
 */

export const THEME_STORAGE_KEY = "imperium.theme";

export interface ThemeOption {
  value: ThemePreference;
  label: string;
}

/** The four accent themes, in the order the settings grid renders them. */
export const THEME_OPTIONS: ThemeOption[] = [
  { value: "mint", label: "Mint" },
  { value: "blue", label: "Ice Blue" },
  { value: "red", label: "Crimson" },
  { value: "gold", label: "Gold" },
];

/** Applies a theme to <html> and mirrors it to localStorage for next load. */
export function applyTheme(theme: ThemePreference): void {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode / storage disabled — the in-memory data-theme still holds */
  }
}

/** Reads the locally-cached theme, falling back to the default. */
export function getLocalTheme(): ThemePreference {
  if (typeof document !== "undefined" && document.documentElement.dataset.theme) {
    return normalizeTheme(document.documentElement.dataset.theme);
  }
  try {
    return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}
