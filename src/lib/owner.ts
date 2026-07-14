/**
 * Owner identity — the Business tab is strictly owner-gated.
 *
 * The owner is whoever signs in with the email in `NEXT_PUBLIC_OWNER_EMAIL`.
 * This is a public env var on purpose: the gate is a UI/route convenience (all
 * business data is *also* RLS-scoped to `auth.uid()` in Postgres, so the DB
 * never leaks another user's rows regardless of what the client renders).
 *
 * Kept as a pure helper with no React/Supabase imports so both the client hook
 * (`useOwner`) and the server route guard (`proxy.ts`) can share it.
 */

export const OWNER_EMAIL = process.env.NEXT_PUBLIC_OWNER_EMAIL ?? "";

/**
 * True when `email` matches the configured owner. Case-insensitive and
 * whitespace-trimmed. Always false when the env var is unset (fail closed —
 * no owner configured means nobody sees the Business tab).
 */
export function isOwnerEmail(email?: string | null): boolean {
  const owner = OWNER_EMAIL.trim().toLowerCase();
  if (!owner) return false;
  return (email ?? "").trim().toLowerCase() === owner;
}
