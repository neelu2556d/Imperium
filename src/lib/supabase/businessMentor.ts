import { ensureAnonymousSession, supabase } from "@/lib/supabase/client";

export type BusinessMentorRole = "user" | "mentor";

export type ContextType =
  | "morning_briefing"
  | "pre_visit"
  | "post_day"
  | "chat";

export interface BusinessMentorMessage {
  id: string;
  role: BusinessMentorRole;
  content: string;
}

/**
 * Loads the last {@link limit} messages for the current user, oldest → newest
 * (so the most recent sits at the bottom of the thread). Defensive: a brand-new
 * user has no rows, and any read failure resolves to an empty thread rather
 * than blocking the chat from opening.
 */
export async function fetchBusinessMentorHistory(
  limit = 30
): Promise<BusinessMentorMessage[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("business_mentor_messages")
      .select("id, role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    return (data ?? [])
      .reverse()
      .map((r) => ({
        id: String(r.id),
        role: (r.role as BusinessMentorRole) === "mentor" ? "mentor" : "user",
        content: String(r.content),
      }));
  } catch {
    return [];
  }
}

/**
 * Deletes all business mentor messages for the current user.
 */
export async function clearBusinessMentorHistory(): Promise<void> {
  const userId = await ensureAnonymousSession();
  await supabase
    .from("business_mentor_messages")
    .delete()
    .eq("user_id", userId);
}

export interface BusinessMentorSession {
  userId: string;
  accessToken: string;
}

/**
 * The identity the /api/business-mentor route needs: the user's id plus the
 * access token it forwards so server-side reads/writes run under the user's
 * RLS policies.
 */
export async function getBusinessMentorSession(): Promise<BusinessMentorSession> {
  const userId = await ensureAnonymousSession();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { userId, accessToken: session?.access_token ?? "" };
}
