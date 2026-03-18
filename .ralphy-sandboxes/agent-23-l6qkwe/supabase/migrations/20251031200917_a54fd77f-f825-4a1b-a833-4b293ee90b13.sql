-- Add comprehensive cannabis product fields to wholesale_inventory
ALTER TABLE wholesale_inventory
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS strain_type TEXT CHECK (strain_type IN ('Indica', 'Sativa', 'Hybrid', 'CBD')),
ADD COLUMN IF NOT EXISTS thc_percentage DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS cbd_percentage DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS terpenes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS effects JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS flavors JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS lineage TEXT,
ADD COLUMN IF NOT EXISTS grow_info TEXT;

-- Populate with realistic cannabis data for existing products
UPDATE wholesale_inventory 
SET 
  description = CASE 
    WHEN product_name ILIKE '%Blue Dream%' THEN 'A sativa-dominant hybrid originating in California, Blue Dream delivers swift symptom relief without heavy sedative effects. This makes Blue Dream a popular daytime medicine for patients treating pain, depression, nausea, and other ailments requiring a high THC content.'
    WHEN product_name ILIKE '%OG Kush%' THEN 'OG Kush makes up the genetic backbone of West Coast cannabis varieties, but in spite of its ubiquity, its genetic origins remain a mystery. Popular myth maintains that Chemdawg and a Hindu Kush landrace were crossed, creating a hybrid with a unique terpene profile.'
    WHEN product_name ILIKE '%Sour Diesel%' THEN 'Sour Diesel, sometimes called Sour D, is an invigorating sativa-dominant strain named after its pungent, diesel-like aroma. This fast-acting strain delivers energizing, dreamy cerebral effects that have pushed it to legendary status.'
    WHEN product_name ILIKE '%Purple%' THEN 'This indica-dominant strain delivers a powerful body high combined with cerebral euphoria. Perfect for evening relaxation and combating insomnia. Users report strong grape and berry flavors with earthy undertones.'
    WHEN product_name ILIKE '%Durban%' THEN 'A pure sativa landrace from South Africa, Durban Poison is known for its sweet smell and energetic, uplifting effects. This strain is perfect for staying productive during the day when you need to get things done.'
    ELSE 'Premium cannabis flower cultivated with care for maximum potency and flavor. Lab-tested and quality assured for consistency and purity.'
  END,
  strain_type = CASE 
    WHEN product_name ILIKE '%Blue Dream%' OR product_name ILIKE '%Sour Diesel%' OR product_name ILIKE '%Durban%' THEN 'Sativa'
    WHEN product_name ILIKE '%OG Kush%' OR product_name ILIKE '%Purple%' OR product_name ILIKE '%Granddaddy%' THEN 'Indica'
    ELSE 'Hybrid'
  END,
  thc_percentage = CASE 
    WHEN product_name ILIKE '%OG Kush%' THEN 24.5
    WHEN product_name ILIKE '%Blue Dream%' THEN 21.3
    WHEN product_name ILIKE '%Sour Diesel%' THEN 22.8
    WHEN product_name ILIKE '%Purple%' THEN 23.7
    WHEN product_name ILIKE '%Durban%' THEN 19.5
    ELSE 20.0 + (RANDOM() * 8)::DECIMAL(5,2)
  END,
  cbd_percentage = CASE 
    WHEN product_name ILIKE '%CBD%' THEN 15.0 + (RANDOM() * 5)::DECIMAL(5,2)
    ELSE (RANDOM() * 1.5)::DECIMAL(5,2)
  END,
  terpenes = CASE
    WHEN product_name ILIKE '%Blue Dream%' THEN '[
      {"name": "Myrcene", "percentage": 0.89},
      {"name": "Pinene", "percentage": 0.65},
      {"name": "Caryophyllene", "percentage": 0.43}
    ]'::jsonb
    WHEN product_name ILIKE '%Sour Diesel%' THEN '[
      {"name": "Limonene", "percentage": 1.2},
      {"name": "Caryophyllene", "percentage": 0.78},
      {"name": "Myrcene", "percentage": 0.55}
    ]'::jsonb
    WHEN product_name ILIKE '%OG Kush%' THEN '[
      {"name": "Caryophyllene", "percentage": 0.95},
      {"name": "Limonene", "percentage": 0.72},
      {"name": "Myrcene", "percentage": 0.68}
    ]'::jsonb
    ELSE '[
      {"name": "Myrcene", "percentage": 0.75},
      {"name": "Limonene", "percentage": 0.52},
      {"name": "Caryophyllene", "percentage": 0.38}
    ]'::jsonb
  END,
  effects = CASE 
    WHEN product_name ILIKE '%Blue Dream%' OR product_name ILIKE '%Sour Diesel%' OR product_name ILIKE '%Durban%' THEN '["Energetic", "Creative", "Uplifted", "Focused", "Euphoric"]'::jsonb
    WHEN product_name ILIKE '%OG Kush%' OR product_name ILIKE '%Purple%' OR product_name ILIKE '%Granddaddy%' THEN '["Relaxed", "Sleepy", "Happy", "Hungry", "Euphoric"]'::jsonb
    ELSE '["Happy", "Relaxed", "Euphoric", "Uplifted", "Creative"]'::jsonb
  END,
  flavors = CASE
    WHEN product_name ILIKE '%Diesel%' THEN '["Diesel", "Pungent", "Earthy", "Citrus"]'::jsonb
    WHEN product_name ILIKE '%Dream%' THEN '["Berry", "Sweet", "Earthy", "Herbal"]'::jsonb
    WHEN product_name ILIKE '%Kush%' THEN '["Earthy", "Pine", "Woody", "Spicy"]'::jsonb
    WHEN product_name ILIKE '%Purple%' THEN '["Grape", "Berry", "Sweet", "Earthy"]'::jsonb
    ELSE '["Citrus", "Sweet", "Fruity", "Pine"]'::jsonb
  END,
  lineage = CASE
    WHEN product_name ILIKE '%Blue Dream%' THEN 'Blueberry × Haze'
    WHEN product_name ILIKE '%OG Kush%' THEN 'Chemdawg × Hindu Kush'
    WHEN product_name ILIKE '%Sour Diesel%' THEN 'Chemdawg 91 × Super Skunk'
    ELSE 'Heritage genetics'
  END
WHERE description IS NULL OR description = '';