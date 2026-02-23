-- ============================================================================
-- MARKETPLACE TABLES MIGRATION
-- Creates all marketplace-related tables with proper RLS and indexes
-- ============================================================================

-- 1. MARKETPLACE PROFILES (Seller/Vendor Profiles)
CREATE TABLE IF NOT EXISTS public.marketplace_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  business_name TEXT,
  business_description TEXT,
  license_number TEXT,
  license_type TEXT,
  license_state TEXT,
  license_expiry_date TIMESTAMPTZ,
  license_document_url TEXT,
  license_verified BOOLEAN DEFAULT false,
  license_verified_at TIMESTAMPTZ,
  license_verification_notes TEXT,
  shipping_states TEXT[] DEFAULT '{}',
  logo_url TEXT,
  cover_image_url TEXT,
  shipping_policy TEXT,
  return_policy TEXT,
  marketplace_status TEXT DEFAULT 'pending' CHECK (marketplace_status IN ('pending', 'active', 'suspended', 'rejected')),
  can_sell BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. MARKETPLACE LISTINGS (Products for Sale)
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  marketplace_profile_id UUID REFERENCES public.marketplace_profiles(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_type TEXT,
  strain_name TEXT,
  description TEXT,
  images TEXT[] DEFAULT '{}',
  base_price NUMERIC NOT NULL CHECK (base_price >= 0),
  quantity_available NUMERIC NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
  unit_of_measure TEXT DEFAULT 'gram',
  thc_content NUMERIC,
  cbd_content NUMERIC,
  lab_results_url TEXT,
  lab_results_encrypted TEXT,
  available_states TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'out_of_stock')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. MARKETPLACE CART (Shopping Cart)
CREATE TABLE IF NOT EXISTS public.marketplace_cart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
  added_at TIMESTAMPTZ DEFAULT now()
);

-- 4. MARKETPLACE ORDERS (Order Header)
CREATE TABLE IF NOT EXISTS public.marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  buyer_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  buyer_user_id UUID,
  seller_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  seller_profile_id UUID REFERENCES public.marketplace_profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_terms TEXT DEFAULT 'prepaid' CHECK (payment_terms IN ('prepaid', 'net_30', 'net_60')),
  subtotal NUMERIC NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  platform_fee NUMERIC DEFAULT 0 CHECK (platform_fee >= 0),
  tax NUMERIC DEFAULT 0 CHECK (tax >= 0),
  shipping_cost NUMERIC DEFAULT 0 CHECK (shipping_cost >= 0),
  total_amount NUMERIC NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  shipping_address JSONB,
  shipping_method TEXT,
  tracking_number TEXT,
  buyer_notes TEXT,
  seller_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

-- 5. MARKETPLACE ORDER ITEMS (Order Line Items)
CREATE TABLE IF NOT EXISTS public.marketplace_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_type TEXT,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC NOT NULL CHECK (total_price >= 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. PLATFORM TRANSACTIONS (Fee Tracking)
CREATE TABLE IF NOT EXISTS public.platform_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.marketplace_orders(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('platform_fee', 'subscription_fee', 'refund', 'adjustment')),
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  fee_percentage NUMERIC,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'collected', 'failed', 'refunded')),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_marketplace_profiles_tenant ON public.marketplace_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_profiles_status ON public.marketplace_profiles(marketplace_status);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller ON public.marketplace_listings(seller_tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_profile ON public.marketplace_listings(marketplace_profile_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON public.marketplace_listings(status);

CREATE INDEX IF NOT EXISTS idx_marketplace_cart_buyer ON public.marketplace_cart(buyer_tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_cart_listing ON public.marketplace_cart(listing_id);

CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer ON public.marketplace_orders(buyer_tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_seller ON public.marketplace_orders(seller_tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_number ON public.marketplace_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status ON public.marketplace_orders(status);

CREATE INDEX IF NOT EXISTS idx_marketplace_order_items_order ON public.marketplace_order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_platform_transactions_tenant ON public.platform_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_platform_transactions_order ON public.platform_transactions(order_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE public.marketplace_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_transactions ENABLE ROW LEVEL SECURITY;

-- Marketplace Profiles RLS
CREATE POLICY "Sellers can view own profile"
  ON public.marketplace_profiles FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Sellers can create own profile"
  ON public.marketplace_profiles FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Sellers can update own profile"
  ON public.marketplace_profiles FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Buyers can view active profiles"
  ON public.marketplace_profiles FOR SELECT
  USING (marketplace_status = 'active' AND can_sell = true);

-- Marketplace Listings RLS
CREATE POLICY "Sellers can manage own listings"
  ON public.marketplace_listings FOR ALL
  USING (seller_tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Buyers can view active listings"
  ON public.marketplace_listings FOR SELECT
  USING (status = 'active' AND quantity_available > 0);

-- Marketplace Cart RLS
CREATE POLICY "Buyers can manage own cart"
  ON public.marketplace_cart FOR ALL
  USING (buyer_tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- Marketplace Orders RLS
CREATE POLICY "Buyers can view own orders"
  ON public.marketplace_orders FOR SELECT
  USING (buyer_tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Sellers can view orders for their products"
  ON public.marketplace_orders FOR SELECT
  USING (seller_tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "System can create orders"
  ON public.marketplace_orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Sellers can update order status"
  ON public.marketplace_orders FOR UPDATE
  USING (seller_tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- Marketplace Order Items RLS
CREATE POLICY "Order items inherit order access"
  ON public.marketplace_order_items FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM marketplace_orders
      WHERE buyer_tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
         OR seller_tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "System can create order items"
  ON public.marketplace_order_items FOR INSERT
  WITH CHECK (true);

-- Platform Transactions RLS
CREATE POLICY "Tenants can view own transactions"
  ON public.platform_transactions FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "System can create transactions"
  ON public.platform_transactions FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_marketplace_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_marketplace_profiles_updated_at
  BEFORE UPDATE ON public.marketplace_profiles
  FOR EACH ROW EXECUTE FUNCTION update_marketplace_updated_at();

CREATE TRIGGER update_marketplace_listings_updated_at
  BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION update_marketplace_updated_at();

CREATE TRIGGER update_marketplace_orders_updated_at
  BEFORE UPDATE ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION update_marketplace_updated_at();

-- ============================================================================
-- DATABASE FUNCTION FOR QUANTITY DECREMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION decrement_listing_quantity(
  p_listing_id UUID,
  p_quantity NUMERIC
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.marketplace_listings
  SET 
    quantity_available = quantity_available - p_quantity,
    status = CASE 
      WHEN quantity_available - p_quantity <= 0 THEN 'out_of_stock'
      ELSE status
    END
  WHERE id = p_listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.marketplace_profiles IS 'Seller/vendor profiles for the B2B marketplace';
COMMENT ON TABLE public.marketplace_listings IS 'Product listings available in the marketplace';
COMMENT ON TABLE public.marketplace_cart IS 'Shopping cart for marketplace buyers';
COMMENT ON TABLE public.marketplace_orders IS 'B2B orders placed through the marketplace';
COMMENT ON TABLE public.marketplace_order_items IS 'Line items for marketplace orders';
COMMENT ON TABLE public.platform_transactions IS 'Platform fee transactions (2% of order subtotal)';