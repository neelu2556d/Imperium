/**
 * Split-template catalog for the /onboarding/split screen. Pure data + the
 * recommendation logic — no React, so it can be reused by the screen, the
 * data layer, and any downstream exercise-picker.
 *
 * Each template describes a full Mon–Sun week as seven `days`, where a training
 * day carries the muscle-group name and a rest day is flagged. Selecting a
 * template writes these `days` verbatim into the training_split table.
 */

import type { TrainingAnswers } from "@/lib/onboarding/training/answers";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface SplitDay {
  /** Muscle-group / day label, e.g. "Chest & Shoulders". Ignored when resting. */
  name: string;
  isRest: boolean;
}

export interface SplitTemplate {
  id: string;
  title: string;
  /** Small italic descriptor under the title, e.g. "classic". */
  subtitle: string;
  difficulty: Difficulty;
  /** Frequency label, e.g. "4 × /WK" or "3 × /CYCLE". */
  frequencyLabel: string;
  /** One-line description shown in the info tooltip. */
  tooltip: string;
  /** Exactly seven entries, Mon → Sun. */
  days: SplitDay[];
}

const REST: SplitDay = { name: "Rest", isRest: true };
const train = (name: string): SplitDay => ({ name, isRest: false });

/**
 * The user's personalised split, built from their quiz answers. The dot
 * cadence is Chest & Shoulders / Back / rest / Legs / Arms / rest / rest.
 */
export const PERSONAL_SPLIT_ID = "personal-4";

export const SPLIT_TEMPLATES: SplitTemplate[] = [
  {
    id: PERSONAL_SPLIT_ID,
    title: "Your 4-Day Split",
    subtitle: "tailored to you",
    difficulty: "intermediate",
    frequencyLabel: "4 × /WK",
    tooltip:
      "Your personal split from the quiz: one focused muscle group each session, four days a week.",
    days: [
      train("Chest & Shoulders"),
      train("Back"),
      REST,
      train("Legs"),
      train("Arms"),
      REST,
      REST,
    ],
  },
  {
    id: "full-body-2",
    title: "Full Body",
    subtitle: "classic",
    difficulty: "beginner",
    frequencyLabel: "2 × /WK",
    tooltip:
      "Every muscle group, twice a week. The simplest way to start and hard to mess up.",
    days: [train("Full Body"), REST, REST, train("Full Body"), REST, REST, REST],
  },
  {
    id: "full-body-3",
    title: "Full Body",
    subtitle: "higher frequency",
    difficulty: "beginner",
    frequencyLabel: "3 × /WK",
    tooltip:
      "Full-body sessions three times a week, with a rest day between each. Great newbie driver of progress.",
    days: [
      train("Full Body"),
      REST,
      train("Full Body"),
      REST,
      train("Full Body"),
      REST,
      REST,
    ],
  },
  {
    id: "upper-lower-4",
    title: "Upper / Lower",
    subtitle: "balanced",
    difficulty: "intermediate",
    frequencyLabel: "4 × /WK",
    tooltip:
      "Alternate upper-body and lower-body days, twice through the week. Even split of volume and recovery.",
    days: [
      train("Upper"),
      train("Lower"),
      REST,
      train("Upper"),
      train("Lower"),
      REST,
      REST,
    ],
  },
  {
    id: "ppl-3",
    title: "Push Pull Legs",
    subtitle: "rotating",
    difficulty: "intermediate",
    frequencyLabel: "3 × /CYCLE",
    tooltip:
      "Push, pull, then legs on a rolling 3-day cycle — train whenever you're ready, rest when you're not.",
    days: [
      train("Push"),
      train("Pull"),
      train("Legs"),
      REST,
      train("Push"),
      train("Pull"),
      train("Legs"),
    ],
  },
  {
    id: "bro-5",
    title: "Bro Split",
    subtitle: "heavy + volume",
    difficulty: "intermediate",
    frequencyLabel: "5 × /WK",
    tooltip:
      "One body part a day across five days — maximum focus and volume per muscle group.",
    days: [
      train("Chest"),
      train("Back"),
      train("Delts"),
      train("Arms"),
      train("Legs"),
      REST,
      REST,
    ],
  },
  {
    id: "ppl-6",
    title: "Push Pull Legs",
    subtitle: "twice through",
    difficulty: "advanced",
    frequencyLabel: "6 × /WK",
    tooltip:
      "Push / pull / legs run twice a week — high frequency and volume for advanced lifters with the recovery for it.",
    days: [
      train("Push"),
      train("Pull"),
      train("Legs"),
      train("Push"),
      train("Pull"),
      train("Legs"),
      REST,
    ],
  },
];

export function getSplitTemplate(id: string): SplitTemplate | undefined {
  return SPLIT_TEMPLATES.find((t) => t.id === id);
}

/** Quiz labels from Step06 (`preferred_split`). */
const SPLIT_ONE_BODY_PART = "One body part a day";
const SPLIT_PPL = "Push, pull, legs";
const SPLIT_UPPER_LOWER = "Upper / lower";
const SPLIT_FULL_BODY = "Everything every session";

/** Falls back to a sensible default keyed purely on training days per week. */
function recommendByDays(days: number): string {
  if (days <= 2) return "full-body-2";
  if (days === 3) return "full-body-3";
  if (days === 4) return PERSONAL_SPLIT_ID;
  if (days === 5) return "bro-5";
  return "ppl-6";
}

/**
 * Picks the template that best fits the quiz answers. Considers the preferred
 * training style first, then the weekly day budget. Defaults (4 days, "one
 * body part a day") resolve to the personalised 4-day split.
 */
export function recommendSplit(answers: TrainingAnswers): string {
  const days = answers.training_days_per_week ?? 4;

  switch (answers.preferred_split) {
    case SPLIT_ONE_BODY_PART:
      return days >= 5 ? "bro-5" : PERSONAL_SPLIT_ID;
    case SPLIT_PPL:
      return days >= 6 ? "ppl-6" : "ppl-3";
    case SPLIT_UPPER_LOWER:
      return "upper-lower-4";
    case SPLIT_FULL_BODY:
      return days >= 3 ? "full-body-3" : "full-body-2";
    default:
      // "Pick whatever fits best" or unanswered → key off day budget.
      return recommendByDays(days);
  }
}
