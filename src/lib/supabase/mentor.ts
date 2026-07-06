import { ensureAnonymousSession, supabase } from "@/lib/supabase/client";

export type MentorRole = "user" | "mentor";

export interface MentorMessage {
  id: string;
  role: MentorRole;
  content: string;
}

/**
 * Loads the last {@link limit} messages for the current user, oldest → newest
 * (so the most recent sits at the bottom of the thread). Defensive: a brand-new
 * user has no rows, and any read failure resolves to an empty thread rather
 * than blocking the chat from opening.
 */
export async function fetchMentorHistory(limit = 50): Promise<MentorMessage[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("mentor_messages")
      .select("id, role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    return (data ?? [])
      .reverse()
      .map((r) => ({
        id: String(r.id),
        role: (r.role as MentorRole) === "mentor" ? "mentor" : "user",
        content: String(r.content),
      }));
  } catch {
    return [];
  }
}

export interface MentorSession {
  userId: string;
  accessToken: string;
}

/**
 * The identity the /api/mentor route needs: the user's id plus the access token
 * it forwards so server-side reads/writes run under the user's RLS policies.
 */
export async function getMentorSession(): Promise<MentorSession> {
  const userId = await ensureAnonymousSession();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { userId, accessToken: session?.access_token ?? "" };
}
