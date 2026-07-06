/**
 * POST /api/mentor
 *
 * The brain behind the /mentor chat tab. Given a user's message it:
 *   1. Gathers today's real training / recovery / nutrition context from
 *      Supabase (scoped to the caller via their forwarded access token, so RLS
 *      returns their own rows).
 *   2. Builds a system prompt in the tone the user picked at onboarding.
 *   3. Calls Groq's OpenAI-compatible chat completions with the system prompt,
 *      the prior conversation history, and the new message.
 *   4. Persists both the user message and the mentor reply to mentor_messages,
 *      stamping the mentor row with the context snapshot that informed it.
 *
 * The Groq key stays server-side (GROQ_API_KEY) — the browser never sees it.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

/** How many prior turns to feed back as conversation history. */
const HISTORY_LIMIT = 50;

const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round = (n: number): number => Math.round(n);

/** Local YYYY-MM-DD, matching how the log tables store `log_date`. */
function localISODate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface NutritionGoals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

const DEFAULT_GOALS: NutritionGoals = {
  calories: 2200,
  protein: 110,
  fat: 73,
  carbs: 275,
};

interface MentorContext {
  name: string;
  tone: string;
  focus: string[];
  goal: string;
  sleepHours: number | null;
  sleepGoal: number;
  sleepDebt: number;
  waterMl: number;
  waterGoalMl: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  goals: NutritionGoals;
  sessionDay: string;
  setsToday: number;
}

/**
 * Pulls every slice of context the system prompt needs, in parallel. Each read
 * is defensive: a brand-new user (or a table that isn't user-scoped yet)
 * resolves to a sensible default rather than failing the whole request.
 */
async function gatherContext(
  supabase: SupabaseClient,
  userId: string
): Promise<MentorContext> {
  const today = localISODate();

  const profileP = supabase
    .from("profiles")
    .select("name, first_name, mentor_tone, mentor_focus, headline_goal")
    .eq("user_id", userId)
    .maybeSingle();

  const sleepP = supabase
    .from("sleep_logs")
    .select("hours, goal_hours, log_date")
    .eq("user_id", userId)
    .order("log_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const waterP = supabase
    .from("water_logs")
    .select("amount_liters, goal_liters")
    .eq("user_id", userId)
    .eq("log_date", today);

  const foodP = supabase
    .from("food_logs")
    .select("calories, protein, fat, carbs")
    .eq("user_id", userId)
    .eq("log_date", today);

  const goalsP = supabase
    .from("nutrition_goals")
    .select("calories, protein_g, fat_g, carbs_g")
    .eq("user_id", userId)
    .maybeSingle();

  const setsP = supabase
    .from("set_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("log_date", today);

  const splitP = supabase
    .from("training_split")
    .select("name, day_order")
    .eq("user_id", userId)
    .order("day_order", { ascending: true });

  const [profileR, sleepR, waterR, foodR, goalsR, setsR, splitR] =
    await Promise.all([profileP, sleepP, waterP, foodP, goalsP, setsP, splitP]);

  const profile = (profileR.data ?? {}) as Record<string, unknown>;
  const name = (profile.name as string) || (profile.first_name as string) || "there";
  const tone = (profile.mentor_tone as string) || "Encouraging";
  const focus = (profile.mentor_focus as string[]) ?? [];
  const goal = (profile.headline_goal as string) || "get healthier";

  // Sleep + debt (goal minus actual, never negative).
  const sleepHours = sleepR.data ? num(sleepR.data.hours) : null;
  const sleepGoal = sleepR.data ? num(sleepR.data.goal_hours) || 7.15 : 7.15;
  const sleepDebt =
    sleepHours === null ? 0 : Math.max(0, round((sleepGoal - sleepHours) * 10) / 10);

  // Water: table stores litres, the prompt talks in millilitres.
  const waterRows = waterR.data ?? [];
  const waterLitres = waterRows.reduce((s, r) => s + num(r.amount_liters), 0);
  const waterGoalLitres = num(waterRows[0]?.goal_liters) || 3.5;
  const waterMl = round(waterLitres * 1000);
  const waterGoalMl = round(waterGoalLitres * 1000);

  // Food totals so far today.
  const foodRows = foodR.data ?? [];
  const totals = foodRows.reduce(
    (acc, r) => ({
      calories: acc.calories + num(r.calories),
      protein: acc.protein + num(r.protein),
      carbs: acc.carbs + num(r.carbs),
      fat: acc.fat + num(r.fat),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const goals: NutritionGoals = goalsR.data
    ? {
        calories: num(goalsR.data.calories) || DEFAULT_GOALS.calories,
        protein: num(goalsR.data.protein_g) || DEFAULT_GOALS.protein,
        fat: num(goalsR.data.fat_g) || DEFAULT_GOALS.fat,
        carbs: num(goalsR.data.carbs_g) || DEFAULT_GOALS.carbs,
      }
    : DEFAULT_GOALS;

  // Today's split day. day_order 1..7 maps Mon..Sun; index by local weekday.
  const splitRows = splitR.data ?? [];
  const mondayIndex = (new Date().getDay() + 6) % 7;
  const sessionDay =
    (splitRows[mondayIndex]?.name as string) ||
    (splitRows[splitRows.length - 1]?.name as string) ||
    WEEKDAY_NAMES[mondayIndex];

  return {
    name,
    tone,
    focus,
    goal,
    sleepHours,
    sleepGoal,
    sleepDebt,
    waterMl,
    waterGoalMl,
    calories: round(totals.calories),
    protein: round(totals.protein),
    carbs: round(totals.carbs),
    fat: round(totals.fat),
    goals,
    sessionDay,
    setsToday: setsR.count ?? 0,
  };
}

/** Assembles the tone-aware system prompt from the gathered context. */
function buildSystemPrompt(ctx: MentorContext): string {
  const sleep =
    ctx.sleepHours === null
      ? `no sleep logged yet (goal ${ctx.sleepGoal} hrs)`
      : `${ctx.sleepHours} hrs (goal ${ctx.sleepGoal} hrs, ${ctx.sleepDebt} hrs of sleep debt)`;
  const focus = ctx.focus.length ? ctx.focus.join(", ") : "overall wellness";

  return (
    `You are Imperium, a personal fitness and wellness coach. ` +
    `Your tone is ${ctx.tone}. The user's name is ${ctx.name}. ` +
    `Their goal is ${ctx.goal}. Current context: ` +
    `Sleep last night: ${sleep}. ` +
    `Water today: ${ctx.waterMl}ml / ${ctx.waterGoalMl}ml. ` +
    `Calories today: ${ctx.calories} kcal / ${ctx.goals.calories} kcal ` +
    `(Protein: ${ctx.protein}g / ${ctx.goals.protein}g, ` +
    `Carbs: ${ctx.carbs}g / ${ctx.goals.carbs}g, ` +
    `Fat: ${ctx.fat}g / ${ctx.goals.fat}g). ` +
    `Today's session: ${ctx.sessionDay}, ${ctx.setsToday} sets logged so far. ` +
    `Your focus areas: ${focus}. ` +
    `Keep responses under 150 words unless the user asks for detail. ` +
    `Be direct and specific to their actual data.`
  );
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!apiKey || !supabaseUrl || !anonKey) {
    return Response.json(
      { error: "The mentor is not configured on this server." },
      { status: 500 }
    );
  }

  // The client forwards its Supabase access token so server-side reads/writes
  // run as the user and satisfy row-level security.
  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  let body: { message?: unknown; userId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const userId = typeof body.userId === "string" ? body.userId : "";

  if (!message) {
    return Response.json({ error: "Message is required." }, { status: 400 });
  }
  if (!userId || !accessToken) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1–3. Context + system prompt.
  let ctx: MentorContext;
  try {
    ctx = await gatherContext(supabase, userId);
  } catch {
    return Response.json(
      { error: "Couldn't load your data. Try again." },
      { status: 502 }
    );
  }
  const systemPrompt = buildSystemPrompt(ctx);

  // Prior turns (oldest → newest) become the running conversation history.
  const { data: historyRows } = await supabase
    .from("mentor_messages")
    .select("role, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  const history: ChatMessage[] = (historyRows ?? [])
    .reverse()
    .map((r) => ({
      role: r.role === "mentor" ? "assistant" : "user",
      content: String(r.content),
    }));

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: message },
  ];

  // 4. Groq chat completion.
  let groqRes: Response;
  try {
    groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.7,
        max_tokens: 512,
        messages,
      }),
    });
  } catch {
    return Response.json(
      { error: "Couldn't reach your coach. Try again." },
      { status: 502 }
    );
  }

  if (!groqRes.ok) {
    return Response.json(
      { error: "Your coach is unavailable right now. Try again." },
      { status: 502 }
    );
  }

  const payload = await groqRes.json().catch(() => null);
  const reply: unknown = payload?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) {
    return Response.json(
      { error: "No reply came back. Try rephrasing." },
      { status: 422 }
    );
  }
  const replyText = reply.trim();

  // 5. Persist both turns. The mentor row carries the context snapshot that
  // shaped it; a write failure shouldn't cost the user their answer, so we
  // don't fail the request on it.
  await supabase.from("mentor_messages").insert([
    { user_id: userId, role: "user", content: message },
    {
      user_id: userId,
      role: "mentor",
      content: replyText,
      context_snapshot: ctx,
    },
  ]);

  return Response.json({ reply: replyText });
}
