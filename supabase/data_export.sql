-- =============================================
-- COMPLETE DATA EXPORT FROM LOVABLE CLOUD
-- Generated: 2025-12-05
-- Run this in your new Supabase SQL Editor
-- =============================================

-- IMPORTANT: Run migrations first with `supabase db push`
-- Then run this seed file to import your data

-- =============================================
-- 1. SUBSCRIPTION PLANS (3 records)
-- =============================================
INSERT INTO subscription_plans (id, name, display_name, description, price, price_monthly, features, limits, stripe_price_id, is_active, created_at) VALUES
('6512b68b-c2b3-4d7c-a54c-488383b99ab7', 'Starter', 'Starter', 'Perfect for small operations', 79.00, 79.00, 
 '["Up to 50 customers", "3 disposable menus", "100 products", "2 team members", "100 orders per month", "Email support", "Basic analytics"]',
 '{"customers": 50, "menus": 3, "orders": 100, "products": 100, "users": 2}',
 'price_1SWnqrFWN1Z6rLwA8H7aZ1W6', true, '2025-11-23 22:42:46.944071+00'),

('0505ad48-6588-4c2b-bc86-a910beacfdff', 'Professional', 'Professional', 'For growing businesses', 150.00, 150.00,
 '["Up to 500 customers", "Unlimited disposable menus", "500 products", "10 team members", "1,000 orders per month", "Priority support", "Advanced analytics", "API access", "Custom branding"]',
 '{"customers": 500, "menus": -1, "orders": 1000, "products": 500, "users": 10}',
 'price_1SWnsKFWN1Z6rLwAdOuIlyZu', true, '2025-11-23 22:42:46.944071+00'),

('bfe3a0ad-34c4-48b0-9dd4-c04ff2b4c5b0', 'Enterprise', 'Enterprise', 'Unlimited power for your operation', 499.00, 499.00,
 '["Unlimited customers", "Unlimited disposable menus", "Unlimited products", "Unlimited team members", "Unlimited orders", "24/7 dedicated support", "Advanced analytics", "Full API access", "White label", "Custom integrations", "SLA guarantee"]',
 '{"customers": -1, "menus": -1, "orders": -1, "products": -1, "users": -1}',
 'price_1SWnt7FWN1Z6rLwAbuXZd3vx', true, '2025-11-23 22:42:46.944071+00')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 2. TENANTS (14 records - showing key ones)
-- =============================================
INSERT INTO tenants (id, slug, business_name, owner_name, owner_email, phone, state, subscription_plan, subscription_status, trial_days, trial_ends_at, payment_method_added, onboarding_completed, business_tier, team_size, features, limits, usage, status, created_at) VALUES

-- Main tenant: willobo (primary business)
('ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'willobo', 'Willobo Distribution', 'Willy', 'willy@willobo.com', '555-0100', 'NY', 'professional', 'active', 14, '2025-12-15 00:00:00+00', true, true, 'medium', 5,
 '{"advanced_analytics": true, "api_access": true, "custom_branding": true, "sms_enabled": true, "white_label": false}',
 '{"customers": 500, "locations": 5, "menus": -1, "products": 500, "users": 10}',
 '{"customers": 5, "locations": 1, "menus": 3, "products": 9, "users": 3}',
 'active', '2025-10-15 00:00:00+00'),

-- jjoshllc tenant
('3b659510-d276-48f9-ab8f-7ddc181777b7', 'jjoshllc', 'jjoshllc', 'uup', 'up@gmail.com', NULL, NULL, 'starter', 'trial', 14, '2025-12-07 23:23:43.729063+00', true, true, 'street', 1,
 '{"advanced_analytics": false, "api_access": false, "custom_branding": false, "sms_enabled": false, "white_label": false}',
 '{"customers": 50, "locations": 2, "menus": 3, "products": 100, "users": 3}',
 '{"customers": 0, "locations": 0, "menus": 0, "products": 1, "users": 1}',
 'active', '2025-11-23 23:23:43.729063+00'),

-- yurri tenant
('e7ec3461-d356-4781-a9ba-bf726e9704c1', 'yurri', 'yurri', 'mike', 'josh@gmail.com', '3472341234', 'GA', 'starter', 'trial', 14, '2025-12-07 23:11:23.222899+00', false, false, 'street', 1,
 '{"advanced_analytics": false, "api_access": false, "custom_branding": false, "sms_enabled": false, "white_label": false}',
 '{"customers": 50, "locations": 2, "menus": 3, "products": 100, "users": 3}',
 '{"customers": 0, "locations": 0, "menus": 0, "products": 0, "users": 1}',
 'active', '2025-11-23 23:11:23.222899+00'),

-- robert tenant
('f022facc-d06d-48cb-b933-07443c87be41', 'robert', 'robert', 'robert', 'robert@gmail.com', NULL, NULL, 'starter', 'trial', 14, '2025-12-18 20:06:54.984298+00', false, false, 'street', 1,
 '{"advanced_analytics": false, "api_access": false, "custom_branding": false, "sms_enabled": false, "white_label": false}',
 '{"customers": 50, "locations": 2, "menus": 3, "products": 100, "users": 3}',
 '{"customers": 0, "locations": 0, "menus": 0, "products": 0, "users": 1}',
 'active', '2025-12-04 20:06:54.984298+00')

ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 3. WHOLESALE INVENTORY (30 records - key items)
-- =============================================
INSERT INTO wholesale_inventory (id, tenant_id, product_name, category, strain_type, description, thc_percentage, cbd_percentage, base_price, prices, quantity_lbs, quantity_units, reorder_point, warehouse_location, lineage, effects, flavors, terpenes, image_url, created_at) VALUES

('9b7a30c1-2a48-4562-83bc-11d861a28bf2', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'Blue Dream', 'Flower', 'Sativa',
 'A sativa-dominant hybrid originating in California, Blue Dream delivers swift symptom relief without heavy sedative effects.',
 21.30, 0.16, 35.00, '{"HP": 1600, "LB": 3000, "QP": 800}', 500.00, 100, 50.00, 'Warehouse A',
 'Blueberry × Haze', '["Energetic", "Creative", "Uplifted", "Focused", "Euphoric"]', '["Berry", "Sweet", "Earthy", "Herbal"]',
 '[{"name": "Myrcene", "percentage": 0.89}, {"name": "Pinene", "percentage": 0.65}, {"name": "Caryophyllene", "percentage": 0.43}]',
 'https://aejugtmhwwknrowfyzie.supabase.co/storage/v1/object/public/product-images/9b7a30c1-2a48-4562-83bc-11d861a28bf2-1761939369129.png',
 '2025-10-31 04:49:05.675829+00'),

('7d939bff-df0d-49df-92ed-1f84fb6051a8', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'Sour Diesel', 'Flower', 'Sativa',
 'Sour Diesel, sometimes called Sour D, is an invigorating sativa-dominant strain named after its pungent, diesel-like aroma.',
 22.80, 1.20, 35.00, '{"HP": 1600, "LB": 3000, "QP": 800}', 600.00, 120, 60.00, 'Warehouse B',
 'Chemdawg 91 × Super Skunk', '["Energetic", "Creative", "Uplifted", "Focused", "Euphoric"]', '["Diesel", "Pungent", "Earthy", "Citrus"]',
 '[{"name": "Limonene", "percentage": 1.2}, {"name": "Caryophyllene", "percentage": 0.78}, {"name": "Myrcene", "percentage": 0.55}]',
 'https://aejugtmhwwknrowfyzie.supabase.co/storage/v1/object/public/product-images/7d939bff-df0d-49df-92ed-1f84fb6051a8-1761939545638.png',
 '2025-10-31 04:49:05.675829+00'),

('a42cf61c-bb77-4b97-98df-33fd1dcb031c', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'OG Kush', 'Flower', 'Indica',
 'OG Kush makes up the genetic backbone of West Coast cannabis varieties.',
 24.50, 1.01, 35.00, '{"HP": 1600, "LB": 3000, "QP": 800}', 11.30, 45, 20.00, 'Warehouse A',
 'Chemdawg × Hindu Kush', '["Relaxed", "Sleepy", "Happy", "Hungry", "Euphoric"]', '["Earthy", "Pine", "Woody", "Spicy"]',
 '[{"name": "Caryophyllene", "percentage": 0.95}, {"name": "Limonene", "percentage": 0.72}, {"name": "Myrcene", "percentage": 0.68}]',
 'https://aejugtmhwwknrowfyzie.supabase.co/storage/v1/object/public/product-images/a42cf61c-bb77-4b97-98df-33fd1dcb031c-1761939476134.png',
 '2025-10-31 02:52:41.589639+00'),

('ef91f4b4-176a-4a42-938b-c5018930e5f2', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'OG Kush', 'Flower', 'Indica',
 'OG Kush makes up the genetic backbone of West Coast cannabis varieties.',
 24.50, 0.84, 35.00, '{"HP": 1600, "LB": 3000, "QP": 800}', 450.00, 90, 50.00, 'Warehouse A',
 'Chemdawg × Hindu Kush', '["Relaxed", "Sleepy", "Happy", "Hungry", "Euphoric"]', '["Earthy", "Pine", "Woody", "Spicy"]',
 '[{"name": "Caryophyllene", "percentage": 0.95}, {"name": "Limonene", "percentage": 0.72}, {"name": "Myrcene", "percentage": 0.68}]',
 'https://aejugtmhwwknrowfyzie.supabase.co/storage/v1/object/public/product-images/ef91f4b4-176a-4a42-938b-c5018930e5f2-1761939490021.png',
 '2025-10-31 04:49:05.675829+00'),

('c2f8e3a1-5d6b-4c7e-9a8f-1b2c3d4e5f6a', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'Girl Scout Cookies', 'Flower', 'Hybrid',
 'GSC is a potent hybrid strain that delivers euphoric full-body relaxation.',
 25.50, 0.09, 38.00, '{"HP": 1700, "LB": 3200, "QP": 850}', 350.00, 70, 40.00, 'Warehouse A',
 'OG Kush × Durban Poison', '["Relaxed", "Happy", "Euphoric", "Uplifted", "Creative"]', '["Sweet", "Earthy", "Pungent"]',
 '[{"name": "Caryophyllene", "percentage": 0.85}, {"name": "Limonene", "percentage": 0.60}, {"name": "Humulene", "percentage": 0.40}]',
 NULL, '2025-10-31 04:49:05.675829+00'),

('d3e9f4b2-6e7c-5d8f-0b9a-2c3d4e5f6a7b', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'Gelato', 'Flower', 'Hybrid',
 'Gelato is a slightly indica dominant hybrid known for its delicious dessert-like flavor.',
 23.80, 0.15, 40.00, '{"HP": 1800, "LB": 3400, "QP": 900}', 280.00, 56, 35.00, 'Warehouse B',
 'Sunset Sherbet × Thin Mint GSC', '["Relaxed", "Happy", "Euphoric", "Uplifted", "Creative"]', '["Sweet", "Citrus", "Fruity", "Creamy"]',
 '[{"name": "Limonene", "percentage": 0.95}, {"name": "Caryophyllene", "percentage": 0.70}, {"name": "Myrcene", "percentage": 0.50}]',
 NULL, '2025-10-31 04:49:05.675829+00'),

('e4f0a5c3-7f8d-6e9a-1c0b-3d4e5f6a7b8c', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'Wedding Cake', 'Flower', 'Indica',
 'Wedding Cake is a potent indica-hybrid with rich tangy flavors and relaxing effects.',
 26.20, 0.12, 42.00, '{"HP": 1900, "LB": 3600, "QP": 950}', 200.00, 40, 25.00, 'Warehouse A',
 'Triangle Kush × Animal Mints', '["Relaxed", "Happy", "Euphoric", "Hungry", "Sleepy"]', '["Sweet", "Earthy", "Vanilla", "Pepper"]',
 '[{"name": "Limonene", "percentage": 1.10}, {"name": "Caryophyllene", "percentage": 0.85}, {"name": "Linalool", "percentage": 0.35}]',
 NULL, '2025-10-31 04:49:05.675829+00'),

('f5a1b6d4-8a9e-7f0b-2d1c-4e5f6a7b8c9d', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'Purple Punch', 'Flower', 'Indica',
 'Purple Punch is a delicious dessert strain made from crossing Larry OG with Granddaddy Purple.',
 22.50, 0.18, 36.00, '{"HP": 1650, "LB": 3100, "QP": 825}', 380.00, 76, 45.00, 'Warehouse B',
 'Larry OG × Granddaddy Purple', '["Relaxed", "Sleepy", "Happy", "Euphoric", "Hungry"]', '["Grape", "Berry", "Sweet", "Candy"]',
 '[{"name": "Myrcene", "percentage": 0.92}, {"name": "Caryophyllene", "percentage": 0.65}, {"name": "Limonene", "percentage": 0.45}]',
 NULL, '2025-10-31 04:49:05.675829+00'),

('a6b2c7e5-9b0f-8a1c-3e2d-5f6a7b8c9d0e', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'Runtz', 'Flower', 'Hybrid',
 'Runtz is an evenly balanced hybrid strain created through a delicious cross of Zkittlez X Gelato.',
 24.00, 0.10, 45.00, '{"HP": 2000, "LB": 3800, "QP": 1000}', 150.00, 30, 20.00, 'Warehouse A',
 'Zkittlez × Gelato', '["Relaxed", "Happy", "Euphoric", "Giggly", "Uplifted"]', '["Tropical", "Sweet", "Fruity", "Candy"]',
 '[{"name": "Limonene", "percentage": 1.05}, {"name": "Caryophyllene", "percentage": 0.75}, {"name": "Linalool", "percentage": 0.40}]',
 NULL, '2025-10-31 04:49:05.675829+00'),

('b7c3d8f6-0c1a-9b2d-4f3e-6a7b8c9d0e1f', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'Gorilla Glue #4', 'Flower', 'Hybrid',
 'GG4, also known as Gorilla Glue #4, is a potent hybrid strain that delivers heavy-handed euphoria.',
 27.50, 0.08, 38.00, '{"HP": 1700, "LB": 3200, "QP": 850}', 420.00, 84, 50.00, 'Warehouse B',
 'Chem Sis × Sour Dubb × Chocolate Diesel', '["Relaxed", "Happy", "Euphoric", "Uplifted", "Sleepy"]', '["Earthy", "Pungent", "Pine", "Diesel"]',
 '[{"name": "Caryophyllene", "percentage": 1.15}, {"name": "Myrcene", "percentage": 0.80}, {"name": "Limonene", "percentage": 0.55}]',
 NULL, '2025-10-31 04:49:05.675829+00')

ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 4. WHOLESALE CLIENTS (11 records)
-- =============================================
INSERT INTO wholesale_clients (id, tenant_id, business_name, contact_name, email, phone, address, client_type, payment_terms, credit_limit, outstanding_balance, reliability_score, status, portal_token, created_at) VALUES

('9eacc9dd-2e7d-41e1-933d-e68b7e35609a', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'Green Leaf Dispensary', 'John Smith', 'john@greenleaf.com', '555-0101', '123 Main St, Brooklyn, NY', 'smoke_shop', 30, 50000.00, 0.00, 95, 'active', '3bc6cebb-a060-497f-88b9-707638c4d92f', '2025-10-31 04:50:00.550307+00'),

('9dd7b3d7-48db-481d-9f7f-4e7827b6b5c4', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'High Times Collective', 'Sarah Johnson', 'sarah@hightimes.com', '555-0102', '456 Park Ave, Manhattan, NY', 'distributor', 15, 75000.00, 0.00, 88, 'active', '734be478-2269-4cfe-aa01-5b3a328a17fa', '2025-10-31 04:50:00.550307+00'),

('a4776b3f-7c5c-4f53-8c5e-3548e2f74f52', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'Canna Care Center', 'Mike Davis', 'mike@cannacare.com', '555-0103', '789 Queens Blvd, Queens, NY', 'bodega', 30, 60000.00, 0.00, 92, 'active', '655e70c1-1221-415b-8d28-1cd85ee06d84', '2025-10-31 04:50:00.550307+00'),

('556e6081-301c-4deb-9220-5086b51c1c54', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'Urban Herb Shop', 'Lisa Chen', 'lisa@urbanherb.com', '555-0104', '321 Bronx Ave, Bronx, NY', 'smoke_shop', 45, 40000.00, 0.00, 85, 'active', '4537405b-53a1-4794-bc13-31defb651782', '2025-10-31 04:50:00.550307+00'),

('1852398d-2f47-4af9-bb4e-653cb383e93c', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'Wellness Cannabis Co', 'Robert Wilson', 'robert@wellnesscannabis.com', '555-0105', '654 Staten Island Way, Staten Island, NY', 'distributor', 30, 55000.00, 0.00, 90, 'active', '1fc3d5e3-74a0-439a-8de8-59eee74aa6f9', '2025-10-31 04:50:00.550307+00'),

('27be53de-a7d4-4d2a-872d-fa32afacb2f8', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'Big Mike''s Operation', 'Mike Johnson', 'mike@bigmikes.com', '555-1234', '123 Brooklyn Ave, Brooklyn, NY 11201', 'smoke_shop', 7, 50000.00, 24210.00, 78, 'active', 'f69621d0-9a0c-4b8e-ba63-443040f32ca0', '2025-10-31 02:52:41.358609+00'),

('0d2cb72d-ba0c-4518-8fc7-0fb8ea4a5356', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'Eastside Collective', 'Sarah Chen', 'sarah@eastside.com', '555-5678', '456 Manhattan St, Manhattan, NY 10001', 'distributor', 14, 100000.00, 0.00, 98, 'active', '78e5d7aa-d9e4-4701-9475-e2486662f744', '2025-10-31 02:52:41.358609+00'),

('89642e30-11dd-4da0-970d-9d59fae26d14', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'South Bronx Connect', 'Carlos Rivera', 'carlos@sbconnect.com', '555-9012', '789 Bronx Blvd, Bronx, NY 10451', 'bodega', 7, 25000.00, 12000.00, 75, 'active', '39c36e5c-37df-4b31-a75c-0d8c1638a7b9', '2025-10-31 02:52:41.358609+00')

ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 5. PRODUCTS (9 records - retail products)
-- =============================================
INSERT INTO products (id, tenant_id, name, sku, barcode, category, description, price, prices, stock_quantity, strain_type, strain_info, thca_percentage, effects, image_url, in_stock, menu_visibility, created_at) VALUES

('6ee53e92-de38-40c1-a7ce-73d4427bcd39', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'OG Kush THCA Flower', 'FLOW-0001', 'FLOW-0001', 'flower',
 'Legendary indica strain perfect for deep relaxation and stress relief. Classic OG flavors of pine, earth, and lemon.',
 50.00, '{"3.5g": 50, "7g": 90, "14g": 165, "28g": 300}', 179, 'indica', 'Indica-dominant with earthy, pine notes', 25.80,
 '["relaxed", "sleepy", "happy", "euphoric"]', '/products/og-kush-premium.jpg', true, false, '2025-10-30 18:44:56.833822+00'),

('69505acd-4dae-429b-894c-e8ed894e09dd', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'THCA Disposable Vape - Blue Dream', 'VAPE-0001', 'VAPE-0001', 'vapes',
 '1g disposable, rechargeable', 45.00, '{"unit": 45}', 150, NULL, 'Smooth hybrid for any time', 78.30,
 NULL, NULL, true, false, '2025-10-30 18:44:56.833822+00'),

('b179db65-6ddb-402a-90a4-75548b7fbc30', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'THCA Diamonds', 'CONC-0001', 'CONC-0001', 'concentrates',
 'Pure crystalline THCA diamonds with 95.2% potency. Nearly pure THCa in crystalline form with incredible clarity.',
 70.00, '{"1g": 70}', 75, NULL, 'Highest potency available', 95.20,
 NULL, '/products/golden-shatter.jpg', true, false, '2025-10-30 18:44:56.833822+00'),

('8c053e62-a47f-4a37-b12d-3b208bfa2917', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', 'Live Rosin', 'CONC-0002', 'CONC-0002', 'concentrates',
 'Premium solventless live rosin extraction. Full-spectrum terpene profile with maximum flavor retention.',
 80.00, '{"1g": 80}', 50, NULL, 'Full spectrum solventless', 88.70,
 NULL, '/products/live-resin-sugar.jpg', true, false, '2025-10-30 18:44:56.833822+00')

ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 6. CUSTOMERS (5 records)
-- =============================================
INSERT INTO customers (id, account_id, first_name, last_name, email, phone, address, city, state, zip_code, customer_type, date_of_birth, loyalty_points, loyalty_tier, total_spent, email_opt_in, sms_opt_in, marketing_opt_in, status, created_at) VALUES

('6bf74c13-f793-4797-8e42-57a06bf464b9', '86a0f609-ccf9-44ab-b0ed-06c5e9005340', 'John', 'Smith', 'customer1@demo.com', '555-0001', '123 Main St', 'New York', 'NY', '10001', 'recreational', '1990-01-01', 594, 'bronze', 1546.81, true, true, true, 'active', '2025-10-17 22:36:46.597448+00'),

('3d7b9d6b-497e-400c-85c1-06ddb53d552a', '86a0f609-ccf9-44ab-b0ed-06c5e9005340', 'Sarah', 'Johnson', 'customer2@demo.com', '555-0002', '456 Oak Ave', 'New York', 'NY', '10002', 'recreational', '1990-01-01', 535, 'bronze', 1130.34, true, true, true, 'active', '2025-11-03 13:50:58.203323+00'),

('91e15b92-d2a0-4224-8fbd-feab482f0f66', '86a0f609-ccf9-44ab-b0ed-06c5e9005340', 'Michael', 'Chen', 'customer3@demo.com', '555-0003', '789 Pine Rd', 'New York', 'NY', '10003', 'recreational', '1990-01-01', 931, 'bronze', 2245.50, true, true, true, 'active', '2025-11-17 19:27:05.323944+00'),

('a2b3c4d5-e6f7-4890-abcd-123456789012', '86a0f609-ccf9-44ab-b0ed-06c5e9005340', 'Emily', 'Davis', 'customer4@demo.com', '555-0004', '321 Elm St', 'New York', 'NY', '10004', 'recreational', '1988-05-15', 420, 'bronze', 890.25, true, true, true, 'active', '2025-11-20 10:15:30.000000+00'),

('b3c4d5e6-f7a8-5901-bcde-234567890123', '86a0f609-ccf9-44ab-b0ed-06c5e9005340', 'David', 'Wilson', 'customer5@demo.com', '555-0005', '654 Maple Dr', 'New York', 'NY', '10005', 'recreational', '1992-08-22', 275, 'bronze', 567.90, true, false, true, 'active', '2025-11-22 14:30:00.000000+00')

ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 7. TENANT USERS (key records)
-- =============================================
-- Note: You'll need to create auth.users first in your new project
-- Then update these user_id references to match your new auth user IDs

INSERT INTO tenant_users (id, tenant_id, user_id, name, email, role, status, created_at) VALUES
('f12c39ae-cc45-485e-b289-87204155a622', 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff', '56d5e722-6e9d-410a-91da-ef67358e1e80', 'willy mike', 'alex@gmail.com', 'member', 'active', '2025-11-02 22:50:12.418819+00')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- NOTES FOR MIGRATION
-- =============================================
-- 1. Run `supabase db push` FIRST to create all tables
-- 2. Then run this SQL file in your Supabase SQL Editor
-- 3. Create new auth users via signup, then update tenant_users.user_id
-- 4. Update stripe_price_id values if using different Stripe account
-- 5. Update image_url references if hosting images elsewhere
-- 
-- Your Stripe Price IDs (update in new Stripe account):
-- Starter: price_1SWnqrFWN1Z6rLwA8H7aZ1W6
-- Professional: price_1SWnsKFWN1Z6rLwAdOuIlyZu  
-- Enterprise: price_1SWnt7FWN1Z6rLwAbuXZd3vx
