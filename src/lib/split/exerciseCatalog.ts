/**
 * Exercise library for the /onboarding/pick-exercises screen. Pure data, no
 * React, so the screen, the search box, and the data layer can all share it.
 *
 * This mirrors the shared library seeded in `0010_exercises.sql` (same names,
 * muscle groups, and one-line form cues). The screen searches and pre-populates
 * from this catalog so it works instantly offline; on save the data layer
 * resolves each name to a real `exercises` row id in Supabase.
 */

/** The muscle groups the info icon + row glyph key off. */
export type MuscleGroup =
  | "Chest"
  | "Shoulders"
  | "Back"
  | "Legs"
  | "Glutes"
  | "Calves"
  | "Arms"
  | "Core";

export interface CatalogExercise {
  name: string;
  muscleGroup: MuscleGroup;
  /** One-line form cue shown in the info tooltip. */
  formCue: string;
}

/** Default prescription every freshly-added pick starts on. */
export const DEFAULT_SETS = 3;
export const DEFAULT_REPS = 12;

export const EXERCISE_CATALOG: CatalogExercise[] = [
  // Chest & Shoulders
  { name: "Incline Machine Press", muscleGroup: "Chest", formCue: "Drive up and slightly in; stop before the elbows lock." },
  { name: "Cable Flies", muscleGroup: "Chest", formCue: "Soft elbows, hug the arms together, squeeze at the middle." },
  { name: "Bench Press", muscleGroup: "Chest", formCue: "Bar to mid-chest, elbows tucked ~45°, press in an arc." },
  { name: "Incline DB Press", muscleGroup: "Chest", formCue: "Wrists stacked over elbows; lower until you feel a stretch." },
  { name: "Pec Deck", muscleGroup: "Chest", formCue: "Lead with the elbows, pause on the squeeze." },
  { name: "Push-ups", muscleGroup: "Chest", formCue: "Rigid plank, elbows back, chest to the floor." },
  { name: "Front Raises", muscleGroup: "Shoulders", formCue: "Raise to eye level, thumbs up, no swinging." },
  { name: "Lateral Raises", muscleGroup: "Shoulders", formCue: "Lead with the elbows, pour-the-jug tilt at the top." },
  { name: "Cable Lateral Raise", muscleGroup: "Shoulders", formCue: "Cable behind the body; smooth arc out to shoulder height." },
  { name: "Overhead Press", muscleGroup: "Shoulders", formCue: "Brace hard, bar over the crown, ribs down." },
  { name: "Arnold Press", muscleGroup: "Shoulders", formCue: "Rotate palms out as you press; control the twist down." },
  { name: "Rear Delt Flies", muscleGroup: "Shoulders", formCue: "Hinge forward, pinkies up, spread the arms wide." },
  { name: "Face Pulls", muscleGroup: "Shoulders", formCue: "Pull to the forehead, elbows high, thumbs back." },
  // Back
  { name: "Lat Pulldown", muscleGroup: "Back", formCue: "Chest up, drive elbows to the hips, no leaning back." },
  { name: "Seated Row", muscleGroup: "Back", formCue: "Neutral spine, pull to the navel, squeeze the blades." },
  { name: "Cable Pullovers", muscleGroup: "Back", formCue: "Tall chest, sweep the bar down with straight-ish arms." },
  { name: "Pull-ups", muscleGroup: "Back", formCue: "Full hang to chin over the bar; drive elbows down." },
  { name: "Barbell Row", muscleGroup: "Back", formCue: "Hinge ~45°, pull to the lower ribs, control the drop." },
  { name: "T-Bar Row", muscleGroup: "Back", formCue: "Flat back, elbows tight, squeeze at the top." },
  { name: "Deadlift", muscleGroup: "Back", formCue: "Bar over mid-foot, push the floor away, hips and chest rise together." },
  { name: "Shrugs", muscleGroup: "Back", formCue: "Straight up to the ears, pause, no rolling." },
  // Legs
  { name: "Barbell Squats", muscleGroup: "Legs", formCue: "Brace, break at the hips and knees, chest tall out of the hole." },
  { name: "Leg Curls", muscleGroup: "Legs", formCue: "Curl hard, pause, resist the way back." },
  { name: "Leg Extensions", muscleGroup: "Legs", formCue: "Squeeze the quads at the top, slow negative." },
  { name: "Romanian Deadlifts", muscleGroup: "Legs", formCue: "Soft knees, push hips back, feel the hamstring stretch." },
  { name: "Calf Raises", muscleGroup: "Calves", formCue: "Full stretch at the bottom, tall pause at the top." },
  { name: "Leg Press", muscleGroup: "Legs", formCue: "Feet shoulder-width, lower to 90°, no lower-back rounding." },
  { name: "Goblet Squat", muscleGroup: "Legs", formCue: "Elbows inside the knees, upright torso, sit tall." },
  { name: "Bulgarian Split Squat", muscleGroup: "Legs", formCue: "Weight on the front heel, drop straight down." },
  { name: "Walking Lunges", muscleGroup: "Legs", formCue: "Long stride, tall torso, knee tracks over the toe." },
  { name: "Hip Thrust", muscleGroup: "Glutes", formCue: "Chin tucked, ribs down, squeeze the glutes at lockout." },
  { name: "Seated Calf Raise", muscleGroup: "Calves", formCue: "Drive through the ball of the foot, full range." },
  // Arms
  { name: "Preacher Curl", muscleGroup: "Arms", formCue: "Armpits on the pad, full stretch, no swinging up." },
  { name: "BB Overhead Extension", muscleGroup: "Arms", formCue: "Elbows tight to the head, stretch behind, lock out overhead." },
  { name: "Incline Curls", muscleGroup: "Arms", formCue: "Arms hang back on the incline for a deep biceps stretch." },
  { name: "Rope Pushdowns", muscleGroup: "Arms", formCue: "Elbows pinned, split the rope at the bottom." },
  { name: "Hammer Curls", muscleGroup: "Arms", formCue: "Neutral grip, controlled, hits the brachialis." },
  { name: "Barbell Curl", muscleGroup: "Arms", formCue: "Elbows still, curl the bar, no back-swing." },
  { name: "Concentration Curl", muscleGroup: "Arms", formCue: "Elbow braced on the thigh, peak squeeze." },
  { name: "Cable Curl", muscleGroup: "Arms", formCue: "Constant tension, wrists neutral, slow negative." },
  { name: "Tricep Dips", muscleGroup: "Arms", formCue: "Lean slightly forward, elbows back, full depth." },
  { name: "Close-Grip Bench", muscleGroup: "Arms", formCue: "Shoulder-width grip, elbows tucked, press straight." },
  { name: "Skull Crushers", muscleGroup: "Arms", formCue: "Lower to the forehead, elbows fixed, extend fully." },
  // Core
  { name: "Plank", muscleGroup: "Core", formCue: "Straight line head to heels, brace, breathe." },
  { name: "Hanging Leg Raise", muscleGroup: "Core", formCue: "No swing; curl the pelvis up, lower slowly." },
  { name: "Cable Crunch", muscleGroup: "Core", formCue: "Round the spine down, pull with the abs not the arms." },
];

const CATALOG_BY_NAME = new Map(
  EXERCISE_CATALOG.map((exercise) => [exercise.name.toLowerCase(), exercise])
);

/** Looks up a catalog entry by exact (case-insensitive) name. */
export function getCatalogExercise(name: string): CatalogExercise | undefined {
  return CATALOG_BY_NAME.get(name.toLowerCase());
}

/**
 * The picks each training day starts with, keyed by the day's name. The
 * pick-exercises screen seeds a day's list from here when nothing is saved yet.
 */
export const DEFAULT_PICKS: Record<string, string[]> = {
  "Chest & Shoulders": [
    "Incline Machine Press",
    "Cable Flies",
    "Front Raises",
    "Lateral Raises",
  ],
  Back: ["Lat Pulldown", "Seated Row", "Cable Pullovers", "Rear Delt Flies"],
  Legs: [
    "Barbell Squats",
    "Leg Curls",
    "Leg Extensions",
    "Romanian Deadlifts",
    "Calf Raises",
  ],
  Arms: [
    "Preacher Curl",
    "BB Overhead Extension",
    "Incline Curls",
    "Rope Pushdowns",
    "Hammer Curls",
  ],
};

/** Default picks for a day, resolved to catalog entries (unknown names dropped). */
export function defaultPicksFor(dayName: string): CatalogExercise[] {
  return (DEFAULT_PICKS[dayName] ?? [])
    .map((name) => getCatalogExercise(name))
    .filter((exercise): exercise is CatalogExercise => Boolean(exercise));
}

/**
 * Case-insensitive name search over the local catalog, ranked so prefix matches
 * come first. Used as the instant/offline fallback for the search box.
 */
export function searchCatalog(query: string, limit = 12): CatalogExercise[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored = EXERCISE_CATALOG.map((exercise) => {
    const name = exercise.name.toLowerCase();
    if (name.startsWith(q)) return { exercise, rank: 0 };
    if (name.includes(q)) return { exercise, rank: 1 };
    if (exercise.muscleGroup.toLowerCase().includes(q)) return { exercise, rank: 2 };
    return null;
  }).filter((hit): hit is { exercise: CatalogExercise; rank: number } => Boolean(hit));

  scored.sort((a, b) => a.rank - b.rank || a.exercise.name.localeCompare(b.exercise.name));
  return scored.slice(0, limit).map((hit) => hit.exercise);
}
