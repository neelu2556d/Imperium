const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

const csvFilePath = path.join(__dirname, '..', 'index.csv');
const sqlFilePath = path.join(__dirname, 'ifct-seed.sql');

const foods = [];

fs.createReadStream(csvFilePath)
  .pipe(parse({ delimiter: ',', from_line: 2 })) // Skip header row (line 1)
  .on('data', (row) => {
    // row is an array of strings
    const food_code = row[0]?.trim() || '';
    const name = row[1]?.trim() || '';
    const food_group = row[4]?.trim() || null;
    const energy_kj = parseFloat(row[7]) || 0;
    const fat_per_100g = parseFloat(row[15]) || 0;
    const fiber_per_100g = parseFloat(row[19]) || 0;
    const carbs_per_100g = parseFloat(row[21]) || 0;
    const protein_per_100g = parseFloat(row[23]) || 0;

    if (!name || energy_kj === 0) {
      return;
    }

    const calories_per_100g = Math.round((energy_kj / 4.184) * 100) / 100; // round to 2 decimal places

    foods.push({
      food_code,
      name,
      food_group,
      calories_per_100g,
      protein_per_100g,
      fat_per_100g,
      carbs_per_100g,
      fiber_per_100g,
    });
  })
  .on('end', () => {
    // Generate SQL
    let sql = `-- First, ensure the table exists:\n`;
    sql += `CREATE TABLE IF NOT EXISTS ifct_foods (\n`;
    sql += `  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n`;
    sql += `  food_code text UNIQUE,\n`;
    sql += `  name text NOT NULL,\n`;
    sql += `  food_group text,\n`;
    sql += `  calories_per_100g numeric(8,2) NOT NULL,\n`;
    sql += `  protein_per_100g numeric(8,2) NOT NULL DEFAULT 0,\n`;
    sql += `  fat_per_100g numeric(8,2) NOT NULL DEFAULT 0,\n`;
    sql += `  carbs_per_100g numeric(8,2) NOT NULL DEFAULT 0,\n`;
    sql += `  fiber_per_100g numeric(8,2) NOT NULL DEFAULT 0,\n`;
    sql += `  -- editable overrides (user can correct values):\n`;
    sql += `  user_overrides jsonb DEFAULT NULL,\n`;
    sql += `  created_at timestamptz DEFAULT now()\n`;
    sql += `);\n\n`;
    sql += `CREATE INDEX IF NOT EXISTS idx_ifct_name \n`;
    sql += `ON ifct_foods USING gin(to_tsvector('english', name));\n\n`;
    sql += `-- Then all INSERT statements:\n`;
    sql += `INSERT INTO ifct_foods \n`;
    sql += `(food_code, name, food_group, calories_per_100g,\n`;
    sql += ` protein_per_100g, fat_per_100g, carbs_per_100g,\n`;
    sql += ` fiber_per_100g)\n`;
    sql += `VALUES\n`;

    const values = foods.map((f) => {
      // Escape single quotes in strings by doubling them
      const escapeSql = (str) => str.replace(/'/g, "''");
      return `('${escapeSql(f.food_code)}', '${escapeSql(f.name)}', ${f.food_group ? `'${escapeSql(f.food_group)}'` : 'NULL'}, ${f.calories_per_100g}, ${f.protein_per_100g}, ${f.fat_per_100g}, ${f.carbs_per_100g}, ${f.fiber_per_100g})`;
    });

    sql += values.join(',\n');
    sql += `\nON CONFLICT (food_code) DO UPDATE SET\n`;
    sql += `  name = EXCLUDED.name,\n`;
    sql += `  calories_per_100g = EXCLUDED.calories_per_100g,\n`;
    sql += `  protein_per_100g = EXCLUDED.protein_per_100g,\n`;
    sql += `  fat_per_100g = EXCLUDED.fat_per_100g,\n`;
    sql += `  carbs_per_100g = EXCLUDED.carbs_per_100g,\n`;
    sql += `  fiber_per_100g = EXCLUDED.fiber_per_100g;\n`;

    fs.writeFileSync(sqlFilePath, sql, 'utf8');

    console.log(`Generated scripts/ifct-seed.sql with ${foods.length} rows. Copy this into Supabase SQL Editor.`);
    console.log('\\nFirst 5 INSERT rows:');
    console.log(values.slice(0, 5).join(',\n'));
  })
  .on('error', (err) => {
    console.error('Error processing CSV:', err);
    process.exit(1);
  });