-- Make access_whitelist_id nullable to support hybrid menu orders
ALTER TABLE menu_orders 
ALTER COLUMN access_whitelist_id DROP NOT NULL;