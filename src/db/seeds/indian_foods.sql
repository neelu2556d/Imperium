CREATE TABLE IF NOT EXISTS indian_foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  calories_per_100g numeric(8,2) NOT NULL,
  protein_per_100g numeric(8,2) NOT NULL,
  fat_per_100g numeric(8,2) NOT NULL,
  carbs_per_100g numeric(8,2) NOT NULL,
  fiber_per_100g numeric(8,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_indian_foods_name ON indian_foods USING gin(to_tsvector('english', name));
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
INSERT INTO indian_foods (name, category, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, fiber_per_100g) VALUES
-- Cereals & Breads
('Chapati / Roti (plain, no oil)', 'Cereals & Breads', 256, 8.0, 0.5, 54.5, 3.9),
('Chapati / Roti (with ghee)', 'Cereals & Breads', 297, 7.9, 3.7, 56.5, 3.8),
('Paratha (plain, with oil)', 'Cereals & Breads', 308, 8.0, 11.0, 44.0, 2.5),
('Paratha (aloo stuffed)', 'Cereals & Breads', 280, 6.5, 9.5, 43.0, 2.8),
('Puri', 'Cereals & Breads', 340, 6.0, 18.0, 41.0, 1.8),
('Bhature', 'Cereals & Breads', 350, 8.5, 14.0, 48.0, 1.5),
('Naan (plain)', 'Cereals & Breads', 310, 9.0, 5.5, 56.0, 2.0),
('Naan (butter)', 'Cereals & Breads', 340, 9.0, 9.5, 55.0, 2.0),
('Rice (cooked, white)', 'Cereals & Breads', 130, 2.7, 0.2, 28.7, 0.4),
('Rice (raw, white)', 'Cereals & Breads', 345, 6.8, 0.5, 78.2, 0.5),
('Brown Rice (cooked)', 'Cereals & Breads', 123, 2.7, 0.9, 25.6, 1.8),
('Basmati Rice (cooked)', 'Cereals & Breads', 130, 3.5, 0.3, 28.0, 0.4),
('Wheat Flour / Atta (whole wheat)', 'Cereals & Breads', 341, 11.8, 1.7, 69.4, 11.2),
('Maida / Refined Flour', 'Cereals & Breads', 348, 10.3, 0.9, 73.9, 2.7),
('Sooji / Semolina (rava)', 'Cereals & Breads', 349, 10.4, 0.8, 73.3, 3.9),
('Poha / Flattened Rice', 'Cereals & Breads', 76, 1.5, 0.2, 16.7, 0.8),
('Poha dish (cooked with vegetables)', 'Cereals & Breads', 110, 2.0, 3.0, 17.0, 1.5),
('Upma', 'Cereals & Breads', 120, 2.5, 4.5, 17.0, 1.2),
('Idli (1 piece ~40g)', 'Cereals & Breads', 58, 2.0, 0.3, 11.5, 0.5),
('Dosa (plain)', 'Cereals & Breads', 133, 3.5, 4.0, 19.5, 0.8),
('Dosa (masala)', 'Cereals & Breads', 150, 3.8, 5.0, 22.0, 1.2),
('Uttapam', 'Cereals & Breads', 107, 3.5, 2.5, 17.5, 1.0),
('Vada / Medu Vada', 'Cereals & Breads', 270, 8.0, 14.0, 29.0, 2.5),
('Biryani (chicken)', 'Cereals & Breads', 150, 8.0, 5.0, 18.0, 0.8),
('Biryani (veg)', 'Cereals & Breads', 140, 3.5, 4.5, 21.0, 1.5),
('Khichdi', 'Cereals & Breads', 124, 5.5, 2.5, 21.5, 2.0),
('Pongal', 'Cereals & Breads', 130, 4.0, 4.0, 19.0, 1.5),
('Pulao (veg)', 'Cereals & Breads', 148, 3.5, 4.5, 23.0, 1.2),

-- Dals & Pulses (cooked)
('Toor Dal / Arhar Dal (cooked)', 'Dal & Pulses', 116, 7.2, 0.4, 20.0, 3.5),
('Moong Dal (cooked)', 'Dal & Pulses', 105, 7.0, 0.4, 18.5, 3.0),
('Masoor Dal / Red Lentil (cooked)', 'Dal & Pulses', 116, 9.0, 0.7, 19.5, 4.0),
('Chana Dal (cooked)', 'Dal & Pulses', 164, 9.0, 2.0, 27.0, 5.0),
('Urad Dal (cooked)', 'Dal & Pulses', 105, 7.0, 0.6, 18.0, 1.8),
('Rajma / Kidney Beans (cooked)', 'Dal & Pulses', 124, 8.7, 0.5, 22.8, 7.4),
('Chole / Chickpeas (cooked)', 'Dal & Pulses', 164, 8.9, 2.6, 27.4, 7.6),
('Moong (whole, cooked)', 'Dal & Pulses', 105, 7.0, 0.5, 18.8, 4.1),
('Chana (whole black, cooked)', 'Dal & Pulses', 164, 9.5, 2.5, 27.0, 6.0),
('Dal Tadka', 'Dal & Pulses', 100, 6.0, 3.5, 13.0, 3.0),
('Dal Makhani', 'Dal & Pulses', 130, 6.5, 6.0, 14.0, 3.5),
('Sambhar', 'Dal & Pulses', 50, 2.5, 2.0, 6.5, 2.0),
('Rasam', 'Dal & Pulses', 25, 1.0, 0.5, 3.5, 0.5),

-- Dairy & Eggs
('Paneer (full fat)', 'Dairy & Eggs', 265, 18.3, 20.8, 1.2, 0.0),
('Paneer (low fat)', 'Dairy & Eggs', 170, 18.0, 10.0, 2.0, 0.0),
('Curd / Dahi (full fat)', 'Dairy & Eggs', 60, 3.1, 3.4, 4.6, 0.0),
('Curd / Dahi (low fat)', 'Dairy & Eggs', 37, 3.5, 1.0, 4.0, 0.0),
('Lassi (sweet)', 'Dairy & Eggs', 100, 3.0, 3.5, 14.0, 0.0),
('Lassi (salted)', 'Dairy & Eggs', 55, 3.2, 3.0, 3.5, 0.0),
('Chaas / Buttermilk', 'Dairy & Eggs', 33, 1.8, 1.5, 3.2, 0.0),
('Milk (full fat, cow)', 'Dairy & Eggs', 67, 3.2, 4.1, 4.4, 0.0),
('Milk (toned)', 'Dairy & Eggs', 49, 3.5, 1.5, 5.0, 0.0),
('Milk (skimmed)', 'Dairy & Eggs', 35, 3.5, 0.3, 5.0, 0.0),
('Ghee', 'Dairy & Eggs', 900, 0.0, 99.5, 0.0, 0.0),
('Butter', 'Dairy & Eggs', 717, 0.9, 81.0, 0.0, 0.0),
('Khoya / Mawa', 'Dairy & Eggs', 421, 20.0, 25.0, 35.0, 0.0),
('Malai / Cream', 'Dairy & Eggs', 260, 2.0, 26.5, 3.5, 0.0),
('Egg (whole, boiled)', 'Dairy & Eggs', 155, 13.0, 11.0, 1.1, 0.0),
('Egg (white only)', 'Dairy & Eggs', 52, 11.0, 0.2, 0.7, 0.0),
('Egg (yolk only)', 'Dairy & Eggs', 322, 16.0, 27.0, 3.6, 0.0),
('Egg Bhurji', 'Dairy & Eggs', 150, 10.0, 11.0, 2.5, 0.5),

-- Vegetables (cooked, without oil unless noted)
('Aloo / Potato (boiled)', 'Vegetables', 87, 1.9, 0.1, 20.1, 1.8),
('Palak / Spinard (cooked)', 'Vegetables', 26, 2.0, 0.7, 2.9, 2.0),
('Bhindi / Okra (cooked)', 'Vegetables', 35, 1.9, 0.2, 6.4, 3.2),
('Baingan / Brinjal (cooked)', 'Vegetables', 25, 1.4, 0.3, 4.0, 2.5),
('Lauki / Bottle Gourd (cooked)', 'Vegetables', 15, 0.5, 0.1, 2.5, 0.5),
('Karela / Bitter Gourd (cooked)', 'Vegetables', 25, 1.6, 0.2, 4.2, 2.8),
('Tinda / Apple Gourd (cooked)', 'Vegetables', 21, 1.0, 0.2, 3.7, 1.0),
('Tori / Ridge Gourd (cooked)', 'Vegetables', 20, 0.8, 0.1, 3.5, 0.5),
('Parwal / Pointed Gourd (cooked)', 'Vegetables', 22, 1.2, 0.3, 3.5, 2.5),
('Peas / Matar (cooked)', 'Vegetables', 93, 5.4, 0.4, 16.8, 5.7),
('Cauliflower / Gobi (cooked)', 'Vegetables', 30, 2.6, 0.4, 4.0, 2.9),
('Cabbage / Patta Gobi (cooked)', 'Vegetables', 27, 1.8, 0.1, 4.6, 4.0),
('Onion (raw)', 'Vegetables', 50, 1.2, 0.1, 11.0, 1.7),
('Tomato (raw)', 'Vegetables', 20, 0.9, 0.2, 3.6, 1.2),
('Capsicum / Shimla Mirch', 'Vegetables', 24, 1.3, 0.3, 4.2, 1.8),
('Cucumber / Kheera (raw)', 'Vegetables', 15, 0.7, 0.1, 2.5, 0.5),
('Carrot / Gajar (raw)', 'Vegetables', 48, 0.9, 0.2, 10.6, 2.8),
('Beetroot (cooked)', 'Vegetables', 44, 1.7, 0.1, 9.6, 2.0),
('Corn / Makai', 'Vegetables', 96, 3.2, 1.2, 19.0, 2.7),
('Mushroom (cooked)', 'Vegetables', 38, 3.1, 0.3, 5.3, 1.0),
('Drumstick / Moringa (cooked)', 'Vegetables', 37, 2.5, 0.1, 6.5, 4.8),
('Colocasia / Arbi (cooked)', 'Vegetables', 97, 3.0, 0.3, 21.0, 4.1),
('Raw Banana / Kela (cooked)', 'Vegetables', 110, 1.3, 0.3, 26.0, 2.0),
('Sweet Potato / Shakarkand (cooked)', 'Vegetables', 90, 2.0, 0.1, 20.5, 3.0),
('Yam / Suran (cooked)', 'Vegetables', 118, 1.5, 0.1, 27.5, 4.0),

-- Curries & Cooked Dishes
('Aloo Gobi (curry)', 'Curries & Dishes', 80, 2.0, 4.5, 9.0, 2.5),
('Aloo Matar (curry)', 'Curries & Dishes', 95, 3.0, 4.0, 12.5, 2.5),
('Aloo Palak (curry)', 'Curries & Dishes', 85, 2.5, 4.5, 9.5, 2.8),
('Palak Paneer', 'Curries & Dishes', 150, 8.0, 11.0, 5.0, 2.0),
('Matar Paneer', 'Curries & Dishes', 165, 8.0, 11.0, 9.0, 2.5),
('Shahi Paneer', 'Curries & Dishes', 180, 8.5, 13.5, 7.5, 1.0),
('Butter Chicken / Murgh Makhani', 'Curries & Dishes', 165, 14.0, 11.0, 2.5, 0.5),
('Chicken Curry', 'Curries & Dishes', 130, 14.0, 8.0, 1.5, 0.5),
('Chicken Tikka Masala', 'Curries & Dishes', 155, 15.0, 9.0, 4.0, 0.8),
('Tandoori Chicken', 'Curries & Dishes', 165, 25.0, 7.0, 2.0, 0.5),
('Mutton Curry', 'Curries & Dishes', 180, 16.0, 12.0, 2.0, 0.3),
('Fish Curry', 'Curries & Dishes', 120, 15.0, 6.0, 3.0, 0.5),
('Egg Curry', 'Curries & Dishes', 140, 10.0, 10.0, 3.0, 0.8),
('Dal Fry', 'Curries & Dishes', 100, 6.0, 3.5, 13.0, 3.0),
('Rajma Masala', 'Curries & Dishes', 130, 8.5, 4.0, 17.0, 5.5),
('Chole Masala', 'Curries & Dishes', 145, 8.0, 5.5, 18.0, 6.0),
('Baingan Bharta', 'Curries & Dishes', 70, 2.0, 4.5, 6.0, 3.0),
('Mixed Veg Curry', 'Curries & Dishes', 75, 2.5, 4.0, 8.0, 2.5),
('Kadhi', 'Curries & Dishes', 80, 3.0, 5.0, 6.0, 0.5),
('Kadhi Pakora', 'Curries & Dishes', 130, 4.0, 8.0, 11.0, 1.0),
('Pav Bhaji', 'Curries & Dishes', 100, 3.0, 4.5, 13.0, 2.5),
('Chole Bhature (per 100g)', 'Curries & Dishes', 240, 7.5, 9.5, 32.0, 4.0),

-- Chicken & Meat (cooked)
('Chicken Breast (boiled, no skin)', 'Meat & Fish', 165, 31.0, 3.6, 0.0, 0.0),
('Chicken Breast (grilled)', 'Meat & Fish', 175, 33.0, 4.5, 0.0, 0.0),
('Chicken Leg (cooked)', 'Meat & Fish', 195, 23.0, 11.0, 0.0, 0.0),
('Chicken Wings (cooked)', 'Meat & Fish', 220, 20.0, 15.0, 0.0, 0.0),
('Chicken Tikka', 'Meat & Fish', 165, 23.0, 8.0, 2.0, 0.5),
('Mutton (cooked)', 'Meat & Fish', 218, 20.0, 15.0, 0.0, 0.0),
('Fish (rohu, cooked)', 'Meat & Fish', 97, 16.6, 1.4, 4.4, 0.0),
('Fish (pomfret, cooked)', 'Meat & Fish', 105, 18.0, 3.0, 2.0, 0.0),
('Prawns (cooked)', 'Meat & Fish', 99, 18.0, 1.8, 2.5, 0.0),
('Tuna (in water)', 'Meat & Fish', 116, 25.5, 1.0, 0.0, 0.0),

-- Fruits
('Mango (ripe)', 'Fruits', 60, 0.5, 0.3, 15.0, 1.6),
('Banana', 'Fruits', 89, 1.1, 0.3, 22.8, 2.6),
('Apple', 'Fruits', 52, 0.3, 0.2, 13.8, 2.4),
('Orange / Mosambi', 'Fruits', 47, 0.9, 0.1, 11.8, 2.4),
('Grapes', 'Fruits', 67, 0.6, 0.4, 17.2, 0.9),
('Guava / Amrood', 'Fruits', 68, 2.6, 1.0, 14.3, 5.4),
('Papaya', 'Fruits', 43, 0.5, 0.3, 10.8, 1.8),
('Watermelon', 'Fruits', 30, 0.6, 0.2, 7.6, 0.4),
('Pomegranate / Anar', 'Fruits', 83, 1.7, 1.2, 18.7, 4.0),
('Chikoo / Sapodilla', 'Fruits', 83, 0.4, 1.1, 19.9, 5.3),
('Jamun / Java Plum', 'Fruits', 60, 0.7, 0.3, 15.6, 0.9),
('Litchi', 'Fruits', 66, 0.8, 0.4, 16.5, 1.3),
('Pineapple', 'Fruits', 50, 0.5, 0.1, 13.1, 1.4),
('Coconut (fresh)', 'Fruits', 354, 3.3, 33.5, 15.2, 9.0),
('Amla / Indian Gooseberry', 'Fruits', 44, 0.9, 0.6, 10.2, 3.4),

-- Snacks & Street Food
('Samosa (1 piece ~100g)', 'Snacks', 262, 5.0, 13.0, 32.0, 2.0),
('Pakora / Bhajiya (mix)', 'Snacks', 230, 7.0, 12.0, 24.0, 2.5),
('Dhokla', 'Snacks', 160, 5.0, 4.5, 25.0, 1.5),
('Khandvi', 'Snacks', 185, 7.0, 8.5, 20.0, 1.0),
('Sev (plain)', 'Snacks', 530, 16.0, 30.0, 50.0, 2.5),
('Chakli / Murukku', 'Snacks', 480, 9.0, 23.0, 61.0, 2.0),
('Mathri', 'Snacks', 490, 8.0, 26.0, 60.0, 2.0),
('Khakra (plain)', 'Snacks', 370, 11.0, 7.0, 65.0, 4.5),
('Pani Puri / Golgappa (10 pieces)', 'Snacks', 280, 6.0, 8.0, 45.0, 3.0),
('Bhel Puri', 'Snacks', 140, 3.5, 3.5, 24.0, 2.0),
('Dahi Puri', 'Snacks', 160, 5.0, 5.5, 23.0, 1.5),
('Aloo Tikki', 'Snacks', 200, 4.0, 9.0, 27.0, 2.5),
('Dabeli', 'Snacks', 220, 6.0, 8.0, 32.0, 2.0),
('Misal Pav (without pav)', 'Snacks', 150, 7.0, 6.5, 17.0, 5.0),

-- Sweets & Desserts
('Gulab Jamun (1 piece ~50g)', 'Sweets', 175, 4.0, 8.0, 23.0, 0.3),
('Rasgulla (1 piece ~50g)', 'Sweets', 93, 2.5, 2.5, 15.0, 0.0),
('Rasmalai (1 piece)', 'Sweets', 125, 5.5, 6.0, 13.5, 0.0),
('Kheer', 'Sweets', 150, 4.5, 5.5, 21.0, 0.2),
('Halwa (suji)', 'Sweets', 250, 4.0, 10.0, 36.0, 0.5),
('Halwa (gajar)', 'Sweets', 195, 3.5, 8.5, 27.5, 1.5),
('Besan Ladoo', 'Sweets', 435, 9.0, 22.0, 52.0, 2.5),
('Motichoor Ladoo', 'Sweets', 400, 7.0, 18.0, 53.0, 1.5),
('Barfi (plain milk)', 'Sweets', 380, 10.0, 17.0, 49.0, 0.0),
('Kaju Katli', 'Sweets', 490, 14.0, 25.0, 55.0, 1.5),
('Jalebi', 'Sweets', 330, 2.0, 12.0, 53.0, 0.5),
('Peda', 'Sweets', 380, 9.0, 14.0, 56.0, 0.0),
('Sandesh', 'Sweets', 250, 10.0, 10.0, 30.0, 0.0),
('Rabri', 'Sweets', 220, 7.5, 12.0, 22.0, 0.0),
('Shrikhand', 'Sweets', 190, 8.5, 8.0, 23.0, 0.0),
('Malpua', 'Sweets', 295, 5.0, 12.0, 42.0, 0.8),

-- Beverages
('Chai / Tea (with full fat milk, 1 tsp sugar)', 'Beverages', 40, 1.5, 1.5, 6.5, 0.0),
('Masala Chai', 'Beverages', 45, 1.5, 1.5, 7.5, 0.0),
('Filter Coffee (with milk)', 'Beverages', 50, 1.8, 2.0, 6.5, 0.0),
('Lassi (mango)', 'Beverages', 120, 3.0, 3.5, 20.0, 0.5),
('Nimbu Pani / Lemonade (with sugar)', 'Beverages', 40, 0.2, 0.0, 10.5, 0.2),
('Coconut Water', 'Beverages', 19, 0.7, 0.2, 3.7, 1.1),
('Aam Panna', 'Beverages', 55, 0.3, 0.0, 14.0, 0.5),
('Jaljeera', 'Beverages', 30, 0.5, 0.1, 7.0, 0.3),
('Thandai', 'Beverages', 95, 3.5, 4.0, 12.0, 0.5),

-- Nuts, Seeds & Oils
('Almonds / Badam', 'Nuts & Seeds', 579, 21.2, 49.9, 21.6, 12.5),
('Cashews / Kaju', 'Nuts & Seeds', 553, 18.2, 43.9, 30.2, 3.3),
('Peanuts / Moongphali (roasted)', 'Nuts & Seeds', 585, 25.8, 49.2, 16.1, 8.5),
('Walnuts / Akhrot', 'Nuts & Seeds', 654, 15.2, 65.2, 13.7, 6.7),
('Pistachios', 'Nuts & Seeds', 562, 20.2, 45.3, 27.5, 10.6),
('Sesame Seeds / Til', 'Nuts & Seeds', 573, 17.7, 49.7, 23.5, 11.8),
('Flax Seeds / Alsi', 'Nuts & Seeds', 534, 18.3, 42.2, 28.9, 27.3),
('Sunflower Seeds', 'Nuts & Seeds', 584, 20.8, 51.5, 20.0, 8.6),
('Coconut Oil', 'Nuts & Seeds', 892, 0.0, 99.1, 0.0, 0.0),
('Mustard Oil / Sarson Tel', 'Nuts & Seeds', 884, 0.0, 100.0, 0.0, 0.0),
('Sunflower Oil', 'Nuts & Seeds', 884, 0.0, 100.0, 0.0, 0.0),
('Olive Oil', 'Nuts & Seeds', 884, 0.0, 100.0, 0.0, 0.0),

-- Spices & Condiments
('Chutney (mint/pudina)', 'Spices & Condiments', 40, 2.0, 0.5, 7.0, 2.5),
('Chutney (tamarind/imli)', 'Spices & Condiments', 85, 1.5, 0.5, 20.0, 2.0),
('Chutney (coconut)', 'Spices & Condiments', 110, 2.5, 8.0, 7.5, 3.0),
('Pickle / Achar (mixed)', 'Spices & Condiments', 80, 1.0, 5.5, 7.5, 2.5),
('Tomato Ketchup', 'Spices & Condiments', 97, 1.0, 0.1, 23.5, 0.5),
('Honey', 'Spices & Condiments', 304, 0.3, 0.0, 82.4, 0.2),
('Sugar (white)', 'Spices & Condiments', 400, 0.0, 0.0, 100.0, 0.0),
('Jaggery / Gur', 'Spices & Condiments', 383, 0.4, 0.1, 98.0, 0.0);