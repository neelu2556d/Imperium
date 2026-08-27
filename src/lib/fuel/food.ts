/**
 * Shared Fuel-food domain helpers — the single source of truth for the standard
 * food-search result shape, per-serving unit→gram conversion, per-100g macro
 * maths, and the category colour system. Framework-neutral so both the API
 * routes (server) and the logger UI (client) import the same definitions.
 */

/** Per-100g macro block carried by every search result and scan item. */
export interface Per100g {
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
}

/**
 * The normalised result shape returned by /api/food-search, /api/food-barcode
 * and /api/food-meal-scan. Every source (Indian DB, My Foods, USDA, packaged,
 * barcode, AI scan) is mapped onto this so the logger renders them uniformly.
 */
export interface FoodSearchResult {
  id: string;
  name: string;
  brand: string | null;
  food_group: string | null;
  source: string;
  badge: string;
  badgeColor: string;
  per100g: Per100g;
  canEdit: boolean;
  /** Only present on meal-scan items — the model's gram estimate for the item. */
  estimated_grams?: number;
}

/** Coerces anything to a finite non-negative number (0 on failure). */
export function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/* ------------------------------- macro colours ------------------------------- */

export const CALORIE_COLOR = "#ffffff";
export const PROTEIN_COLOR = "var(--accent)";
export const CARBS_COLOR = "#F59E0B";
export const FAT_COLOR = "rgba(255,255,255,0.6)";
export const FIBER_COLOR = "var(--color-muted)";

/* ------------------------------- serving units ------------------------------ */

export const UNIT_OPTIONS = ["g", "ml", "pieces", "tbsp", "tsp", "cup"] as const;
export type ServingUnit = (typeof UNIT_OPTIONS)[number];

/** Fixed volumetric/spoon conversions to grams (approximate, per spec). */
const FIXED_UNIT_GRAMS: Partial<Record<ServingUnit, number>> = {
  tbsp: 15,
  tsp: 5,
  cup: 240,
};

/**
 * Keyword → grams-per-piece table for the "pieces" unit. Matched case-insensitive
 * as a substring of the food name; first hit wins, else 100g.
 */
const PIECE_WEIGHTS: { match: string; g: number }[] = [
  { match: "gulab jamun", g: 50 },
  { match: "rasgulla", g: 50 },
  { match: "samosa", g: 100 },
  { match: "vada", g: 50 },
  { match: "egg", g: 50 },
  { match: "chapati", g: 40 },
  { match: "roti", g: 40 },
  { match: "idli", g: 40 },
  { match: "paratha", g: 80 },
  { match: "puri", g: 30 },
  { match: "cookie", g: 15 },
  { match: "apple", g: 182 },
  { match: "banana", g: 118 },
  { match: "orange", g: 131 },
];

/** Grams for one "piece" of the given food, by name keyword (default 100g). */
export function pieceWeightFor(name: string): number {
  const lower = name.toLowerCase();
  for (const { match, g } of PIECE_WEIGHTS) {
    if (lower.includes(match)) return g;
  }
  return 100;
}

/**
 * Converts a serving `amount` in `unit` to grams. `pieceG` is the grams-per-piece
 * for this food (from {@link pieceWeightFor}) and only matters for "pieces".
 */
export function servingToGrams(
  amount: number,
  unit: ServingUnit,
  pieceG: number
): number {
  const a = safeNum(amount);
  if (unit === "g" || unit === "ml") return a;
  if (unit === "pieces") return a * (pieceG || 100);
  return a * (FIXED_UNIT_GRAMS[unit] ?? 1);
}

/** Scales a per-100g macro block to the given gram weight. */
export function scaleMacros(per100g: Per100g, grams: number): Per100g {
  const f = safeNum(grams) / 100;
  return {
    calories: per100g.calories * f,
    protein_g: per100g.protein_g * f,
    fat_g: per100g.fat_g * f,
    carbs_g: per100g.carbs_g * f,
    fiber_g: per100g.fiber_g * f,
  };
}

/* ------------------------------ category colours ----------------------------- */

export interface CategoryStyle {
  color: string;
  /** 1–2 letter abbreviation shown inside the circle. */
  abbr: string;
}

/**
 * Maps a food_group / category string to a circle colour + short abbreviation
 * for the search-result avatar. Matching is by keyword so both the Indian DB
 * categories ("Cereals & Breads") and looser USDA/OFF groups resolve sensibly.
 */
export function categoryStyle(group: string | null | undefined): CategoryStyle {
  const g = (group ?? "").toLowerCase();
  const abbr = (group ?? "?").trim().slice(0, 2).toUpperCase() || "?";
  const style = (color: string): CategoryStyle => ({ color, abbr });

  if (g.includes("cereal") || g.includes("bread") || g.includes("grain"))
    return style("#F59E0B"); // amber
  if (g.includes("dal") || g.includes("pulse") || g.includes("legume") || g.includes("bean"))
    return style("#FACC15"); // yellow
  if (g.includes("dairy") || g.includes("egg") || g.includes("milk"))
    return style("#60A5FA"); // blue
  if (g.includes("curr") || g.includes("dish") || g.includes("gravy"))
    return style("#FB923C"); // orange
  if (g.includes("meat") || g.includes("fish") || g.includes("chicken") || g.includes("poultry") || g.includes("seafood"))
    return style("#EF4444"); // red
  if (g.includes("veg")) return style("#22C55E"); // green
  if (g.includes("fruit")) return style("#F472B6"); // pink
  if (g.includes("snack")) return style("#A78BFA"); // purple
  if (g.includes("sweet") || g.includes("dessert")) return style("#FB7185"); // rose
  if (g.includes("beverage") || g.includes("drink")) return style("#2DD4BF"); // teal
  if (g.includes("nut") || g.includes("seed") || g.includes("oil"))
    return style("#B45309"); // brown
  return style("rgba(255,255,255,0.28)"); // default muted grey
}
