/**
 * A tiny framework-agnostic toast store.
 *
 * The Supabase data layer (plain modules, not React) needs to surface query
 * failures as non-blocking notifications without threading a hook through every
 * call site. So the store lives here as a module-level pub/sub: lib code calls
 * {@link reportQueryError} / {@link pushToast}, and the `<Toaster/>` React
 * component subscribes via `useSyncExternalStore` and renders the pills.
 */

export interface Toast {
  id: number;
  message: string;
}

/** How long a toast stays up before auto-dismissing (matches the toast's
 *  depleting progress-bar animation). */
const TOAST_TTL_MS = 3000;
/** Identical messages fired inside this window collapse into one. */
const DEDUPE_MS = 4000;
/** Never stack more than this many at once. */
const MAX_TOASTS = 3;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const lastFired = new Map<string, number>();

function emit() {
  // Fresh array identity so `useSyncExternalStore` sees the change.
  toasts = [...toasts];
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): Toast[] {
  return toasts;
}

/** Server render has no toasts; a stable empty array avoids hydration churn. */
const EMPTY: Toast[] = [];
export function getServerSnapshot(): Toast[] {
  return EMPTY;
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** Queues a toast. Collapses rapid duplicates and caps the visible stack. */
export function pushToast(message: string): void {
  const msg = message.trim();
  if (!msg) return;

  const now = Date.now();
  const seen = lastFired.get(msg);
  if (seen !== undefined && now - seen < DEDUPE_MS) return;
  lastFired.set(msg, now);

  const id = nextId++;
  toasts = [...toasts, { id, message: msg }].slice(-MAX_TOASTS);
  emit();

  if (typeof window !== "undefined") {
    window.setTimeout(() => dismissToast(id), TOAST_TTL_MS);
  }
}

const DEFAULT_QUERY_ERROR = "Something didn't load. Pull to refresh or try again.";

/**
 * Surfaces a failed Supabase query as a toast. Called from the data layer's
 * catch/throw sites so a dropped read or a failed write always tells the user,
 * rather than silently returning an empty page or crashing.
 */
export function reportQueryError(message?: string): void {
  pushToast(message || DEFAULT_QUERY_ERROR);
}
