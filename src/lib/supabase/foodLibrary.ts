import { supabase } from "@/lib/supabase/client";

export interface FoodEntry {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  brand?: string;
  source: string;
}

/**
 * Search the Indian Foods Database (IFCT 2017) and external sources for a food
 * by name. Returns up to 20 results, Indian foods first, then USDA, then Open
 * Food Facts.
 */
export async function fetchNutritionByName(
  name: string,
  quantity: number = 100
): Promise<FoodEntry[]> {
  const search = name.toLowerCase().trim();

  // Step 1: Check Indian Foods Database (IFCT 2017)
  const indianFoodsQuery = supabase
    .from("indian_foods")
    .select(
      "id, name, category, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g"
    )
    .ilike("name", `%${search}%`)
    .limit(8);

  // Step 2: Check USDA database
  const usdaResult = await fetchUSDA(search);

  // Step 3: Check Open Food Facts
  const offResult = await fetchOpenFoodFacts(search);

  // Merge results: Indian foods first, then USDA, then Open Food Facts
  const [indianRes, usdaRes, offRes] = await Promise.all([
    indianFoodsQuery,
    usdaResult,
    offResult,
  ]);

  const mappedIndian: FoodEntry[] = (indianRes.data || []).map((row: any) => ({
    id: `indian:${row.id}`,
    name: row.name,
    brand: row.category,
    source: "indian",
    calories: row.calories_per_100g,
    protein_g: row.protein_per_100g,
    fat_g: row.fat_per_100g,
    carbs_g: row.carbs_per_100g,
  }));

  const mappedUsda: FoodEntry[] = (usdaRes || []).map((item: any) => ({
    id: `usda:${item.id}`,
    name: item.name,
    brand: item.brand_owner,
    source: "usda",
    calories: item.nutritions?.energy_100g || item.nutritions?.calories_100g || 0,
    protein_g: item.nutritions?.proteins_100g || 0,
    fat_g: item.nutritions?.fat_100g || 0,
    carbs_g: item.nutritions?.carbs_100g || 0,
  }));

  const mappedOff: FoodEntry[] = (offRes || []).map((item: any) => ({
    id: `off:${item._id}`,
    name: item.product_name || item.name,
    brand: item.brands,
    source: "open-food-facts",
    calories: item.nutriments?.energy || 0,
    protein_g: item.nutriments?.proteins || 0,
    fat_g: item.nutriments?.fat || 0,
    carbs_g: item.nutriments?.carbs || 0,
  }));

  return [...mappedIndian, ...mappedUsda, ...mappedOff].slice(0, 20);
}

async function fetchUSDA(search: string): Promise<any[]> {
  try {
    const res = await fetch(
      `/api/search-food?query=${encodeURIComponent(search)}&source=usda`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function fetchOpenFoodFacts(search: string): Promise<any[]> {
  try {
    const res = await fetch(
      `/api/search-food?query=${encodeURIComponent(search)}&source=openfoodfacts`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

/**
 * Search the Indian Foods Database only (fast, no external calls).
 */
export async function fetchIndianFoods(search: string): Promise<FoodEntry[]> {
  const { data, error } = await supabase
    .from("indian_foods")
    .select(
      "id, name, category, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g"
    )
    .ilike("name", `%${search}%`)
    .limit(20);

  if (error) {
    console.error("Indian foods search error:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: `indian:${row.id}`,
    name: row.name,
    brand: row.category,
    source: "indian",
    calories: row.calories_per_100g,
    protein_g: row.protein_per_100g,
    fat_g: row.fat_per_100g,
    carbs_g: row.carbs_per_100g,
  }));
}

/**
 * Get a single food by its id (e.g. "indian:<uuid>" or "usda:123").
 */
export async function fetchFoodById(id: string): Promise<FoodEntry | null> {
  if (id.startsWith("indian:")) {
    const { data, error } = await supabase
      .from("indian_foods")
      .select(
        "id, name, category, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g"
      )
      .eq("id", id.replace("indian:", ""))
      .single();

    if (error || !data) return null;

    return {
      id: `indian:${data.id}`,
      name: data.name,
      brand: data.category,
      source: "indian",
      calories: data.calories_per_100g,
      protein_g: data.protein_per_100g,
      fat_g: data.fat_per_100g,
      carbs_g: data.carbs_per_100g,
    };
  }

  // For USDA / Open Food Facts, we'd need to store them locally or re-fetch.
  // For now, return null — the caller should pass a name to search.
  return null;
}