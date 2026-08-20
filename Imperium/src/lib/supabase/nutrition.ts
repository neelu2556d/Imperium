export const fetchNutritionByName = async (name: string, quantity: number = 100) => {
  const search = name.toLowerCase().trim();

  // Step 1: Check Indian Foods Database (IFCT 2017)
  const indianFoodsQuery = supabase
    .from('indian_foods')
    .select('id, name, category, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g')
    .ilike('name', `%${search}%`)
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

  const mappedIndian = indianRes.data?.map((row: any) => ({
    id: `indian:${row.id}`,
    name: row.name,
    brand: row.category,
    source: 'indian',
    per100g: {
      calories: row.calories_per_100g,
      protein_g: row.protein_per_100g,
      fat_g: row.fat_per_100g,
      carbs_g: row.carbs_per_100g,
    },
  })) || [];

  const mappedUsda = usdaRes?.map((item: any) => ({
    id: `usda:${item.id}`,
    name: item.name,
    brand: item.brand_owner,
    source: 'usda',
    per100g: {
      calories: item.nutritions?.energy_100g || item.nutritions?.calories_100g || 0,
      protein_g: item.nutritions?.proteins_100g || 0,
      fat_g: item.nutritions?.fat_100g || 0,
      carbs_g: item.nutritions?.carbs_100g || 0,
    },
  })) || [];

  const mappedOff = offRes?.map((item: any) => ({
    id: `off:${item._id}`,
    name: item.product_name || item.name,
    brand: item.brands,
    source: 'open-food-facts',
    per100g: {
      calories: item.nutriments?.energy || 0,
      protein_g: item.nutriments?.proteins || 0,
      fat_g: item.nutriments?.fat || 0,
      carbs_g: item.nutriments?.carbs || 0,
    },
  })) || [];

  return [
    ...mappedIndian,
    ...mappedUsda,
    ...mappedOff,
  ].slice(0, 20);
};