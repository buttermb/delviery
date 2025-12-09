-- Create storefront_analytics table if not exists
CREATE TABLE IF NOT EXISTS public.storefront_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'page_view', 'product_view', 'add_to_cart', 'checkout_start', 'purchase'
  product_id UUID,
  session_id TEXT,
  customer_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_storefront_analytics_store_id ON public.storefront_analytics(store_id);
CREATE INDEX IF NOT EXISTS idx_storefront_analytics_event_type ON public.storefront_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_storefront_analytics_created_at ON public.storefront_analytics(created_at);

-- Enable RLS
ALTER TABLE public.storefront_analytics ENABLE ROW LEVEL SECURITY;

-- Policy for tenant access
DROP POLICY IF EXISTS "Tenant members can view their store analytics" ON public.storefront_analytics;
CREATE POLICY "Tenant members can view their store analytics"
  ON public.storefront_analytics FOR SELECT
  USING (store_id IN (
    SELECT id FROM public.marketplace_stores 
    WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  ));

-- Policy for inserting analytics (public for tracking)
DROP POLICY IF EXISTS "Anyone can insert analytics" ON public.storefront_analytics;
CREATE POLICY "Anyone can insert analytics"
  ON public.storefront_analytics FOR INSERT
  WITH CHECK (true);

-- Create the get_marketplace_funnel RPC function
CREATE OR REPLACE FUNCTION public.get_marketplace_funnel(p_store_id UUID)
RETURNS TABLE (
  page_views BIGINT,
  product_views BIGINT,
  add_to_cart BIGINT,
  checkout_starts BIGINT,
  purchases BIGINT,
  conversion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_page_views BIGINT;
  v_purchases BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_page_views 
  FROM public.storefront_analytics 
  WHERE store_id = p_store_id 
    AND event_type = 'page_view' 
    AND created_at > now() - interval '30 days';
    
  SELECT COUNT(*) INTO v_purchases 
  FROM public.storefront_analytics 
  WHERE store_id = p_store_id 
    AND event_type = 'purchase' 
    AND created_at > now() - interval '30 days';

  RETURN QUERY
  SELECT
    COALESCE(v_page_views, 0::BIGINT) as page_views,
    COALESCE((SELECT COUNT(*) FROM public.storefront_analytics WHERE store_id = p_store_id AND event_type = 'product_view' AND created_at > now() - interval '30 days'), 0::BIGINT) as product_views,
    COALESCE((SELECT COUNT(*) FROM public.storefront_analytics WHERE store_id = p_store_id AND event_type = 'add_to_cart' AND created_at > now() - interval '30 days'), 0::BIGINT) as add_to_cart,
    COALESCE((SELECT COUNT(*) FROM public.storefront_analytics WHERE store_id = p_store_id AND event_type = 'checkout_start' AND created_at > now() - interval '30 days'), 0::BIGINT) as checkout_starts,
    COALESCE(v_purchases, 0::BIGINT) as purchases,
    CASE 
      WHEN v_page_views > 0 THEN ROUND((v_purchases::NUMERIC / v_page_views::NUMERIC) * 100, 2)
      ELSE 0::NUMERIC 
    END as conversion_rate;
END;
$function$;