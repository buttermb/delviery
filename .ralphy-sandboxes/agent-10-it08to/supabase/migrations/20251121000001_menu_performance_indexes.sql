
-- Performance indexes for disposable menus system

-- Index for fast lookup by encrypted token (most common query)
CREATE INDEX IF NOT EXISTS idx_menus_token_status 
  ON disposable_menus(encrypted_url_token, status);

-- Index for listing active menus for a tenant
CREATE INDEX IF NOT EXISTS idx_active_menus 
  ON disposable_menus(tenant_id) 
  WHERE status = 'active';

-- Index for auto-burn queries (finding active menus with auto-burn enabled)
CREATE INDEX IF NOT EXISTS idx_pending_burns 
  ON disposable_menus(auto_burn_hours, created_at) 
  WHERE status = 'active' AND auto_burn_hours IS NOT NULL;

-- Index for whitelist checks
CREATE INDEX IF NOT EXISTS idx_whitelist_menu_status 
  ON menu_access_whitelist(menu_id, status);

-- Index for access logs (for analytics and velocity checks)
CREATE INDEX IF NOT EXISTS idx_logs_menu_timestamp 
  ON menu_access_logs(menu_id, accessed_at DESC);

-- Index for orders by menu
CREATE INDEX IF NOT EXISTS idx_orders_menu_id 
  ON menu_orders(menu_id);
