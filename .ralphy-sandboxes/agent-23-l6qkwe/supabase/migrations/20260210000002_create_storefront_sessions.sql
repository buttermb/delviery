-- ============================================================================
-- Migration: Create Storefront Sessions Table
-- Description: Tracks customer browsing sessions on storefront and menus
-- Date: 2026-02-10
-- Task: task-073 - Create order storefront session link
-- ============================================================================

-- ============================================================================
-- 1. CREATE storefront_sessions TABLE
-- ============================================================================
-- This table tracks customer browsing sessions from storefronts and menus.
-- Links to orders via source_session_id for customer journey insights.

CREATE TABLE IF NOT EXISTS public.storefront_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Session identification
  session_token TEXT NOT NULL UNIQUE,
  visitor_id TEXT, -- Anonymous visitor tracking (cookie-based)

  -- Source information
  source_type TEXT NOT NULL DEFAULT 'storefront' CHECK (source_type IN ('storefront', 'menu', 'api')),
  menu_id UUID REFERENCES public.disposable_menus(id) ON DELETE SET NULL,
  store_id UUID, -- Reference to marketplace_stores if applicable

  -- Customer info (if known)
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_email TEXT,
  customer_name TEXT,

  -- Session timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,

  -- Session metrics
  browsing_duration_seconds INTEGER DEFAULT 0,
  page_views INTEGER DEFAULT 0,
  items_viewed INTEGER DEFAULT 0,
  items_added_to_cart INTEGER DEFAULT 0,

  -- Journey tracking (JSONB for flexibility)
  viewed_products JSONB DEFAULT '[]'::jsonb, -- Array of {product_id, name, viewed_at, duration_seconds}
  cart_history JSONB DEFAULT '[]'::jsonb, -- Array of cart add/remove actions
  page_history JSONB DEFAULT '[]'::jsonb, -- Array of {page, timestamp}

  -- Device/context info
  user_agent TEXT,
  ip_address INET,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,

  -- Order linkage
  order_id UUID, -- Set when session converts to order
  converted_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Tenant-scoped lookups
CREATE INDEX IF NOT EXISTS idx_storefront_sessions_tenant_id
ON public.storefront_sessions(tenant_id);

-- Session token lookups (for active session retrieval)
CREATE INDEX IF NOT EXISTS idx_storefront_sessions_token
ON public.storefront_sessions(session_token);

-- Menu-based sessions
CREATE INDEX IF NOT EXISTS idx_storefront_sessions_menu_id
ON public.storefront_sessions(tenant_id, menu_id)
WHERE menu_id IS NOT NULL;

-- Order linkage lookups
CREATE INDEX IF NOT EXISTS idx_storefront_sessions_order_id
ON public.storefront_sessions(order_id)
WHERE order_id IS NOT NULL;

-- Customer journey analysis
CREATE INDEX IF NOT EXISTS idx_storefront_sessions_customer_id
ON public.storefront_sessions(tenant_id, customer_id)
WHERE customer_id IS NOT NULL;

-- Time-based queries for analytics
CREATE INDEX IF NOT EXISTS idx_storefront_sessions_started_at
ON public.storefront_sessions(tenant_id, started_at DESC);

-- Active sessions (not ended)
CREATE INDEX IF NOT EXISTS idx_storefront_sessions_active
ON public.storefront_sessions(tenant_id, last_activity_at DESC)
WHERE ended_at IS NULL;

-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.storefront_sessions ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY "storefront_sessions_tenant_isolation"
ON public.storefront_sessions
FOR ALL
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    UNION
    SELECT id FROM public.tenants WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    UNION
    SELECT id FROM public.tenants WHERE owner_id = auth.uid()
  )
);

-- Allow anon users to create/update their own sessions (for storefront)
CREATE POLICY "storefront_sessions_anon_insert"
ON public.storefront_sessions
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "storefront_sessions_anon_update"
ON public.storefront_sessions
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 4. TRIGGER FOR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_storefront_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_storefront_sessions_updated_at ON public.storefront_sessions;
CREATE TRIGGER trg_storefront_sessions_updated_at
  BEFORE UPDATE ON public.storefront_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_storefront_session_timestamp();

-- ============================================================================
-- 5. RPC: Get session details with order linkage
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_storefront_session_details(
  p_session_id UUID,
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_menu RECORD;
  v_result JSONB;
BEGIN
  -- Get session details
  SELECT *
  INTO v_session
  FROM public.storefront_sessions
  WHERE id = p_session_id
    AND tenant_id = p_tenant_id;

  IF v_session IS NULL THEN
    RETURN NULL;
  END IF;

  -- Build result
  v_result := jsonb_build_object(
    'id', v_session.id,
    'session_token', v_session.session_token,
    'source_type', v_session.source_type,
    'started_at', v_session.started_at,
    'ended_at', v_session.ended_at,
    'browsing_duration_seconds', v_session.browsing_duration_seconds,
    'page_views', v_session.page_views,
    'items_viewed', v_session.items_viewed,
    'items_added_to_cart', v_session.items_added_to_cart,
    'viewed_products', v_session.viewed_products,
    'cart_history', v_session.cart_history,
    'converted_at', v_session.converted_at,
    'order_id', v_session.order_id,
    'referrer', v_session.referrer,
    'utm_source', v_session.utm_source,
    'utm_medium', v_session.utm_medium,
    'utm_campaign', v_session.utm_campaign
  );

  -- Add menu info if available
  IF v_session.menu_id IS NOT NULL THEN
    SELECT id, name, created_at, expires_at, status
    INTO v_menu
    FROM public.disposable_menus
    WHERE id = v_session.menu_id;

    IF v_menu IS NOT NULL THEN
      v_result := v_result || jsonb_build_object(
        'menu', jsonb_build_object(
          'id', v_menu.id,
          'name', v_menu.name,
          'created_at', v_menu.created_at,
          'expires_at', v_menu.expires_at,
          'status', v_menu.status
        )
      );
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 6. RPC: Update session activity
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_session_activity(
  p_session_token TEXT,
  p_tenant_id UUID,
  p_page_view TEXT DEFAULT NULL,
  p_product_viewed JSONB DEFAULT NULL,
  p_cart_action JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
BEGIN
  -- Get and lock session
  SELECT *
  INTO v_session
  FROM public.storefront_sessions
  WHERE session_token = p_session_token
    AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found');
  END IF;

  -- Update session
  UPDATE public.storefront_sessions
  SET
    last_activity_at = NOW(),
    browsing_duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER,
    page_views = CASE WHEN p_page_view IS NOT NULL THEN page_views + 1 ELSE page_views END,
    items_viewed = CASE WHEN p_product_viewed IS NOT NULL THEN items_viewed + 1 ELSE items_viewed END,
    viewed_products = CASE
      WHEN p_product_viewed IS NOT NULL
      THEN viewed_products || jsonb_build_array(p_product_viewed)
      ELSE viewed_products
    END,
    page_history = CASE
      WHEN p_page_view IS NOT NULL
      THEN page_history || jsonb_build_array(jsonb_build_object('page', p_page_view, 'timestamp', NOW()))
      ELSE page_history
    END,
    cart_history = CASE
      WHEN p_cart_action IS NOT NULL
      THEN cart_history || jsonb_build_array(p_cart_action)
      ELSE cart_history
    END,
    items_added_to_cart = CASE
      WHEN p_cart_action IS NOT NULL AND (p_cart_action->>'action') = 'add'
      THEN items_added_to_cart + 1
      ELSE items_added_to_cart
    END
  WHERE id = v_session.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- 7. RPC: Link session to order
-- ============================================================================

CREATE OR REPLACE FUNCTION public.link_session_to_order(
  p_session_id UUID,
  p_order_id UUID,
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update session with order link
  UPDATE public.storefront_sessions
  SET
    order_id = p_order_id,
    converted_at = NOW(),
    ended_at = NOW(),
    browsing_duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
  WHERE id = p_session_id
    AND tenant_id = p_tenant_id;

  -- Update orders table with session link (try unified_orders first, then orders)
  UPDATE public.unified_orders
  SET source_session_id = p_session_id
  WHERE id = p_order_id
    AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    UPDATE public.orders
    SET source_session_id = p_session_id
    WHERE id = p_order_id
      AND tenant_id = p_tenant_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- 8. GRANTS
-- ============================================================================

GRANT SELECT ON public.storefront_sessions TO authenticated;
GRANT INSERT, UPDATE ON public.storefront_sessions TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_storefront_session_details(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_session_activity(TEXT, UUID, TEXT, JSONB, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.link_session_to_order(UUID, UUID, UUID) TO authenticated, anon;

-- ============================================================================
-- 9. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.storefront_sessions IS
'Tracks customer browsing sessions from storefronts and disposable menus. Links to orders for customer journey insights.';

COMMENT ON COLUMN public.storefront_sessions.viewed_products IS
'Array of products viewed during session with timestamps and duration';

COMMENT ON COLUMN public.storefront_sessions.cart_history IS
'Array of cart add/remove actions for understanding purchase intent';

COMMENT ON FUNCTION public.get_storefront_session_details IS
'Returns detailed session info including menu details for order traceability';

COMMENT ON FUNCTION public.link_session_to_order IS
'Links a storefront session to an order when the customer completes checkout';
