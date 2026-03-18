-- ============================================================
-- HOTBOX 5-TIER BUSINESS SYSTEM
-- ============================================================
-- Tiers: street, trap, block, hood, empire
-- Based on revenue, locations, and team size
-- ============================================================

-- 1. Add business_tier column to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS business_tier TEXT 
  CHECK (business_tier IN ('street', 'trap', 'block', 'hood', 'empire'))
  DEFAULT 'street',
ADD COLUMN IF NOT EXISTS monthly_revenue NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tier_detected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tier_override BOOLEAN DEFAULT FALSE;

-- 2. Create user_patterns table for smart detection
CREATE TABLE IF NOT EXISTS public.user_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  most_used_features JSONB DEFAULT '[]'::jsonb,
  feature_usage_counts JSONB DEFAULT '{}'::jsonb,
  typical_login_hour INTEGER, -- 0-23
  avg_session_minutes INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  primary_workflow TEXT,
  quick_actions JSONB DEFAULT '[]'::jsonb,
  last_features_accessed JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_patterns_tenant ON public.user_patterns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_patterns_user ON public.user_patterns(user_id);

-- 3. Create attention_queue table for priority items
CREATE TABLE IF NOT EXISTS public.attention_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  priority TEXT NOT NULL CHECK (priority IN ('critical', 'important', 'info')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  action_url TEXT,
  action_label TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMPTZ,
  dismissed_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for attention queue
CREATE INDEX IF NOT EXISTS idx_attention_queue_tenant ON public.attention_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attention_queue_priority ON public.attention_queue(priority);
CREATE INDEX IF NOT EXISTS idx_attention_queue_active ON public.attention_queue(tenant_id, dismissed, expires_at);

-- 4. Create function to calculate monthly revenue from all sources
CREATE OR REPLACE FUNCTION public.calculate_monthly_revenue(p_tenant_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orders_revenue NUMERIC := 0;
  v_pos_revenue NUMERIC := 0;
  v_wholesale_revenue NUMERIC := 0;
  v_invoices_revenue NUMERIC := 0;
  v_total_revenue NUMERIC := 0;
  v_start_of_month TIMESTAMPTZ;
BEGIN
  v_start_of_month := DATE_TRUNC('month', NOW());
  
  -- Sum from orders table (retail orders)
  SELECT COALESCE(SUM(total_amount), 0) INTO v_orders_revenue
  FROM orders
  WHERE tenant_id = p_tenant_id
    AND created_at >= v_start_of_month
    AND status NOT IN ('cancelled', 'rejected', 'refunded');
  
  -- Sum from pos_transactions table (in-store sales)
  SELECT COALESCE(SUM(total_amount), 0) INTO v_pos_revenue
  FROM pos_transactions
  WHERE tenant_id = p_tenant_id
    AND created_at >= v_start_of_month
    AND payment_status = 'paid';
  
  -- Sum from wholesale_orders table (B2B orders)
  SELECT COALESCE(SUM(total_amount), 0) INTO v_wholesale_revenue
  FROM wholesale_orders
  WHERE tenant_id = p_tenant_id
    AND created_at >= v_start_of_month
    AND status NOT IN ('cancelled', 'rejected');
  
  -- Sum from invoices table (if paid this month)
  SELECT COALESCE(SUM(total), 0) INTO v_invoices_revenue
  FROM invoices
  WHERE tenant_id = p_tenant_id
    AND paid_at >= v_start_of_month
    AND status = 'paid';
  
  -- Total (avoid double counting - invoices may be linked to orders)
  v_total_revenue := v_orders_revenue + v_pos_revenue + v_wholesale_revenue;
  
  RETURN v_total_revenue;
END;
$$;

-- 5. Create 5-tier detection function
CREATE OR REPLACE FUNCTION public.detect_business_tier(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_monthly_revenue NUMERIC;
  v_location_count INTEGER;
  v_team_size INTEGER;
  v_tier TEXT;
BEGIN
  -- Calculate current monthly revenue
  v_monthly_revenue := calculate_monthly_revenue(p_tenant_id);
  
  -- Get location count
  SELECT COALESCE((usage->>'locations')::INTEGER, 1) INTO v_location_count
  FROM tenants WHERE id = p_tenant_id;
  
  -- Get team size
  SELECT COUNT(*) INTO v_team_size
  FROM tenant_users
  WHERE tenant_id = p_tenant_id AND status = 'active';
  
  -- Tier classification logic
  -- Empire: $500K+/month OR 5+ locations OR 30+ team
  IF v_monthly_revenue >= 500000 OR v_location_count >= 5 OR v_team_size >= 30 THEN
    v_tier := 'empire';
  -- Hood: $200K-500K/month OR 3-5 locations OR 15-30 team
  ELSIF v_monthly_revenue >= 200000 OR v_location_count >= 3 OR v_team_size >= 15 THEN
    v_tier := 'hood';
  -- Block: $50K-200K/month OR 2-3 locations OR 5-15 team
  ELSIF v_monthly_revenue >= 50000 OR v_location_count >= 2 OR v_team_size >= 5 THEN
    v_tier := 'block';
  -- Trap: $10K-50K/month OR 1-2 locations OR 2-5 team
  ELSIF v_monthly_revenue >= 10000 OR v_team_size >= 2 THEN
    v_tier := 'trap';
  -- Street: <$10K/month, 1 location, solo
  ELSE
    v_tier := 'street';
  END IF;
  
  RETURN v_tier;
END;
$$;

-- 6. Create function to update tenant tier and revenue
CREATE OR REPLACE FUNCTION public.update_tenant_tier(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_tier TEXT;
  v_monthly_revenue NUMERIC;
  v_tier_override BOOLEAN;
BEGIN
  -- Check if tier is manually overridden
  SELECT tier_override INTO v_tier_override FROM tenants WHERE id = p_tenant_id;
  
  IF v_tier_override = TRUE THEN
    RETURN; -- Don't auto-update if manually overridden
  END IF;
  
  -- Calculate new values
  v_monthly_revenue := calculate_monthly_revenue(p_tenant_id);
  v_new_tier := detect_business_tier(p_tenant_id);
  
  -- Update tenant
  UPDATE tenants
  SET 
    monthly_revenue = v_monthly_revenue,
    business_tier = v_new_tier,
    tier_detected_at = NOW(),
    updated_at = NOW()
  WHERE id = p_tenant_id;
END;
$$;

-- 7. Create trigger to auto-update tier on order creation
CREATE OR REPLACE FUNCTION public.trigger_update_tier_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only update tier once per day to avoid excessive calculations
  IF NOT EXISTS (
    SELECT 1 FROM tenants 
    WHERE id = NEW.tenant_id 
    AND tier_detected_at > NOW() - INTERVAL '1 day'
  ) THEN
    PERFORM update_tenant_tier(NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers on revenue-generating tables
DROP TRIGGER IF EXISTS trigger_update_tier_on_order_insert ON orders;
CREATE TRIGGER trigger_update_tier_on_order_insert
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_tier_on_order();

DROP TRIGGER IF EXISTS trigger_update_tier_on_pos_insert ON pos_transactions;
CREATE TRIGGER trigger_update_tier_on_pos_insert
  AFTER INSERT ON pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_tier_on_order();

DROP TRIGGER IF EXISTS trigger_update_tier_on_wholesale_insert ON wholesale_orders;
CREATE TRIGGER trigger_update_tier_on_wholesale_insert
  AFTER INSERT ON wholesale_orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_tier_on_order();

-- 8. Create function to track feature usage patterns
CREATE OR REPLACE FUNCTION public.track_feature_usage(
  p_user_id UUID,
  p_tenant_id UUID,
  p_feature_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_counts JSONB;
  v_last_features JSONB;
  v_new_count INTEGER;
BEGIN
  -- Insert or update user patterns
  INSERT INTO user_patterns (user_id, tenant_id, feature_usage_counts, last_features_accessed, updated_at)
  VALUES (
    p_user_id, 
    p_tenant_id, 
    jsonb_build_object(p_feature_id, 1),
    jsonb_build_array(jsonb_build_object('feature', p_feature_id, 'timestamp', NOW())),
    NOW()
  )
  ON CONFLICT (user_id, tenant_id) DO UPDATE SET
    feature_usage_counts = CASE 
      WHEN user_patterns.feature_usage_counts ? p_feature_id 
      THEN jsonb_set(
        user_patterns.feature_usage_counts,
        ARRAY[p_feature_id],
        to_jsonb((user_patterns.feature_usage_counts->>p_feature_id)::INTEGER + 1)
      )
      ELSE user_patterns.feature_usage_counts || jsonb_build_object(p_feature_id, 1)
    END,
    last_features_accessed = (
      SELECT jsonb_agg(f)
      FROM (
        SELECT f 
        FROM jsonb_array_elements(
          jsonb_build_array(jsonb_build_object('feature', p_feature_id, 'timestamp', NOW())) || 
          COALESCE(user_patterns.last_features_accessed, '[]'::jsonb)
        ) AS f
        LIMIT 10
      ) sub
    ),
    updated_at = NOW();
    
  -- Update most_used_features based on counts
  UPDATE user_patterns
  SET most_used_features = (
    SELECT jsonb_agg(key ORDER BY value::INTEGER DESC)
    FROM jsonb_each_text(feature_usage_counts)
    LIMIT 10
  )
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id;
END;
$$;

-- 9. Create view for hotbox attention items
CREATE OR REPLACE VIEW public.hotbox_attention_items AS
SELECT 
  aq.*,
  CASE 
    WHEN aq.priority = 'critical' THEN 1
    WHEN aq.priority = 'important' THEN 2
    ELSE 3
  END as priority_order
FROM attention_queue aq
WHERE 
  aq.dismissed = FALSE
  AND (aq.expires_at IS NULL OR aq.expires_at > NOW())
ORDER BY priority_order, created_at DESC;

-- 10. Create function to generate attention items
CREATE OR REPLACE FUNCTION public.generate_attention_items(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_orders INTEGER;
  v_pending_menu_orders INTEGER;
  v_low_stock_items INTEGER;
  v_overdue_tabs NUMERIC;
  v_stuck_deliveries INTEGER;
BEGIN
  -- Clear expired items
  DELETE FROM attention_queue 
  WHERE tenant_id = p_tenant_id AND expires_at < NOW();
  
  -- Check pending orders
  SELECT COUNT(*) INTO v_pending_orders
  FROM orders
  WHERE tenant_id = p_tenant_id AND status = 'pending';
  
  IF v_pending_orders > 0 THEN
    INSERT INTO attention_queue (tenant_id, priority, category, title, description, action_url, action_label, metadata)
    VALUES (
      p_tenant_id,
      CASE WHEN v_pending_orders > 5 THEN 'critical' ELSE 'important' END,
      'orders',
      v_pending_orders || ' orders waiting',
      'Process pending orders to keep customers happy',
      '/admin/orders?status=pending',
      'View Orders',
      jsonb_build_object('count', v_pending_orders)
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Check pending menu orders
  SELECT COUNT(*) INTO v_pending_menu_orders
  FROM menu_orders
  WHERE tenant_id = p_tenant_id AND status = 'pending';
  
  IF v_pending_menu_orders > 0 THEN
    INSERT INTO attention_queue (tenant_id, priority, category, title, description, action_url, action_label, metadata)
    VALUES (
      p_tenant_id,
      'critical',
      'menu_orders',
      v_pending_menu_orders || ' Disposable Menu orders waiting',
      'These are wholesale orders from your secure menus',
      '/admin/disposable-menu-orders',
      'Process',
      jsonb_build_object('count', v_pending_menu_orders)
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Check low stock items
  SELECT COUNT(*) INTO v_low_stock_items
  FROM products
  WHERE tenant_id = p_tenant_id 
    AND stock_quantity IS NOT NULL 
    AND stock_quantity < COALESCE(low_stock_threshold, 10);
  
  IF v_low_stock_items > 0 THEN
    INSERT INTO attention_queue (tenant_id, priority, category, title, description, action_url, action_label, metadata)
    VALUES (
      p_tenant_id,
      'important',
      'inventory',
      v_low_stock_items || ' items low on stock',
      'Reorder to avoid running out',
      '/admin/inventory-dashboard',
      'Reorder',
      jsonb_build_object('count', v_low_stock_items)
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
END;
$$;

-- 11. RLS Policies
ALTER TABLE public.user_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attention_queue ENABLE ROW LEVEL SECURITY;

-- User patterns: users can only see their own patterns
CREATE POLICY "Users can view own patterns"
  ON public.user_patterns FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own patterns"
  ON public.user_patterns FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own patterns"
  ON public.user_patterns FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Attention queue: tenant admins can manage their tenant's items
CREATE POLICY "Admins can view tenant attention items"
  ON public.attention_queue FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Admins can update tenant attention items"
  ON public.attention_queue FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- 12. Initialize existing tenants with tier detection
DO $$
DECLARE
  tenant_record RECORD;
BEGIN
  FOR tenant_record IN SELECT id FROM tenants WHERE business_tier IS NULL LOOP
    PERFORM update_tenant_tier(tenant_record.id);
  END LOOP;
END $$;

-- Add comments
COMMENT ON TABLE public.user_patterns IS 'Tracks user feature usage patterns for smart UI personalization';
COMMENT ON TABLE public.attention_queue IS 'Priority-based items requiring user attention in the Hotbox';
COMMENT ON FUNCTION public.calculate_monthly_revenue IS 'Calculates total monthly revenue from all sources';
COMMENT ON FUNCTION public.detect_business_tier IS 'Determines business tier based on revenue, locations, and team size';

