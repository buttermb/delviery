-- ============================================================================
-- MARKETPLACE TABLES MIGRATION
-- ============================================================================
-- Creates all tables needed for B2B wholesale marketplace functionality
-- Includes: profiles, listings, orders, messages, reviews, cart, platform transactions
-- ============================================================================

-- ============================================================================
-- MARKETPLACE_PROFILES
-- ============================================================================
-- Seller profiles with license verification for marketplace access
CREATE TABLE IF NOT EXISTS public.marketplace_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Business Information
  business_name TEXT NOT NULL,
  business_description TEXT,
  logo_url TEXT,
  cover_image_url TEXT,
  
  -- License Information
  license_number TEXT,
  license_type TEXT, -- 'adult_use', 'medical', 'distributor', etc.
  license_state TEXT,
  license_expiry_date TIMESTAMPTZ,
  license_document_url TEXT, -- PDF upload
  
  -- Verification Status
  license_verified BOOLEAN DEFAULT false,
  license_verified_at TIMESTAMPTZ,
  license_verified_by UUID REFERENCES public.super_admin_users(id),
  license_verification_notes TEXT,
  
  -- Marketplace Status
  marketplace_status TEXT NOT NULL DEFAULT 'pending' CHECK (marketplace_status IN ('pending', 'active', 'suspended', 'rejected')),
  can_sell BOOLEAN DEFAULT false,
  verified_badge BOOLEAN DEFAULT false,
  
  -- Shipping Information
  shipping_states TEXT[], -- Array of state codes where seller ships
  shipping_policy TEXT,
  return_policy TEXT,
  
  -- Ratings & Reviews
  average_rating NUMERIC(3,2) DEFAULT 0 CHECK (average_rating >= 0 AND average_rating <= 5),
  total_reviews INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(tenant_id) -- One profile per tenant
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_profiles_tenant_id ON public.marketplace_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_profiles_status ON public.marketplace_profiles(marketplace_status);
CREATE INDEX IF NOT EXISTS idx_marketplace_profiles_license_verified ON public.marketplace_profiles(license_verified);
CREATE INDEX IF NOT EXISTS idx_marketplace_profiles_can_sell ON public.marketplace_profiles(can_sell);

-- ============================================================================
-- MARKETPLACE_LISTINGS
-- ============================================================================
-- Product listings on the marketplace with encrypted lab data
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  marketplace_profile_id UUID NOT NULL REFERENCES public.marketplace_profiles(id) ON DELETE CASCADE,
  
  -- Product Information
  product_name TEXT NOT NULL,
  product_type TEXT, -- 'flower', 'concentrate', 'edible', 'vape', etc.
  strain_type TEXT, -- 'indica', 'sativa', 'hybrid'
  description TEXT,
  
  -- Pricing
  base_price NUMERIC(10,2) NOT NULL,
  bulk_pricing JSONB DEFAULT '[]'::jsonb, -- Array of {quantity: number, price: number}
  min_order_quantity INTEGER DEFAULT 1,
  max_order_quantity INTEGER,
  
  -- Inventory
  quantity_available NUMERIC(10,2) DEFAULT 0,
  unit_type TEXT DEFAULT 'lb', -- 'lb', 'oz', 'g', 'unit'
  
  -- Lab Results (Encrypted)
  lab_results JSONB, -- Encrypted JSONB with AES-256: {thc_percent, cbd_percent, terpenes, batch_number, lab_certificate_url}
  lab_results_encrypted BOOLEAN DEFAULT true,
  
  -- Images
  images TEXT[] DEFAULT '{}', -- Array of image URLs (max 6)
  
  -- Visibility & Status
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'verified_only', 'private')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'active', 'paused', 'sold_out', 'removed')),
  
  -- SEO & Discovery
  tags TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  slug TEXT UNIQUE, -- URL-friendly slug
  
  -- Metrics
  views INTEGER DEFAULT 0,
  favorites_count INTEGER DEFAULT 0,
  orders_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  
  -- Constraints
  CHECK (base_price > 0),
  CHECK (quantity_available >= 0),
  CHECK (min_order_quantity > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_tenant_id ON public.marketplace_listings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_profile_id ON public.marketplace_listings(marketplace_profile_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON public.marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_visibility ON public.marketplace_listings(visibility);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_product_type ON public.marketplace_listings(product_type);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_strain_type ON public.marketplace_listings(strain_type);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_slug ON public.marketplace_listings(slug);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_created_at ON public.marketplace_listings(created_at DESC);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_search ON public.marketplace_listings USING gin(to_tsvector('english', coalesce(product_name, '') || ' ' || coalesce(description, '')));

-- ============================================================================
-- MARKETPLACE_ORDERS
-- ============================================================================
-- Wholesale orders from marketplace buyers
CREATE TABLE IF NOT EXISTS public.marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  
  -- Buyer Information
  buyer_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  buyer_user_id UUID REFERENCES public.customer_users(id),
  buyer_business_name TEXT,
  
  -- Seller Information
  seller_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  seller_profile_id UUID NOT NULL REFERENCES public.marketplace_profiles(id) ON DELETE RESTRICT,
  
  -- Order Details
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'processing', 'shipped', 'delivered', 'cancelled', 'rejected')),
  
  -- Pricing
  subtotal NUMERIC(10,2) NOT NULL,
  platform_fee NUMERIC(10,2) NOT NULL DEFAULT 0, -- 2% transaction fee
  tax NUMERIC(10,2) DEFAULT 0,
  shipping_cost NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL,
  
  -- Payment Terms
  payment_terms TEXT DEFAULT 'prepaid' CHECK (payment_terms IN ('prepaid', 'net_30', 'net_60')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partial', 'overdue')),
  paid_at TIMESTAMPTZ,
  
  -- Shipping Information
  shipping_address JSONB NOT NULL, -- {street, city, state, zip, country}
  shipping_method TEXT,
  tracking_number TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Notes
  buyer_notes TEXT,
  seller_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CHECK (subtotal > 0),
  CHECK (total_amount > 0),
  CHECK (platform_fee >= 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer_tenant_id ON public.marketplace_orders(buyer_tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_seller_tenant_id ON public.marketplace_orders(seller_tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_seller_profile_id ON public.marketplace_orders(seller_profile_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status ON public.marketplace_orders(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_payment_status ON public.marketplace_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_order_number ON public.marketplace_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_created_at ON public.marketplace_orders(created_at DESC);

-- ============================================================================
-- MARKETPLACE_ORDER_ITEMS
-- ============================================================================
-- Individual items in marketplace orders
CREATE TABLE IF NOT EXISTS public.marketplace_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
  
  -- Product Information (snapshot at time of order)
  product_name TEXT NOT NULL,
  product_type TEXT,
  quantity NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CHECK (quantity > 0),
  CHECK (unit_price > 0),
  CHECK (total_price > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_order_items_order_id ON public.marketplace_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_order_items_listing_id ON public.marketplace_order_items(listing_id);

-- ============================================================================
-- MARKETPLACE_MESSAGES
-- ============================================================================
-- Encrypted buyer-seller messaging
CREATE TABLE IF NOT EXISTS public.marketplace_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Participants
  sender_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender_user_id UUID, -- Can be tenant_user or customer_user
  receiver_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  receiver_user_id UUID,
  
  -- Context
  listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.marketplace_orders(id) ON DELETE SET NULL,
  
  -- Message Content (Encrypted)
  subject TEXT,
  message_text TEXT NOT NULL, -- Encrypted with AES-256
  message_encrypted BOOLEAN DEFAULT true,
  
  -- Status
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CHECK (sender_tenant_id != receiver_tenant_id) -- Can't message yourself
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_sender_tenant_id ON public.marketplace_messages(sender_tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_receiver_tenant_id ON public.marketplace_messages(receiver_tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_listing_id ON public.marketplace_messages(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_order_id ON public.marketplace_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_read ON public.marketplace_messages(read);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_created_at ON public.marketplace_messages(created_at DESC);

-- ============================================================================
-- MARKETPLACE_REVIEWS
-- ============================================================================
-- Supplier reviews and ratings
CREATE TABLE IF NOT EXISTS public.marketplace_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Review Context
  order_id UUID NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  seller_profile_id UUID NOT NULL REFERENCES public.marketplace_profiles(id) ON DELETE CASCADE,
  buyer_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Rating
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  
  -- Review Content
  title TEXT,
  review_text TEXT,
  
  -- Categories (optional detailed ratings)
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  shipping_rating INTEGER CHECK (shipping_rating >= 1 AND shipping_rating <= 5),
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('pending', 'published', 'hidden', 'removed')),
  
  -- Response
  seller_response TEXT,
  seller_response_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(order_id) -- One review per order
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_seller_profile_id ON public.marketplace_reviews(seller_profile_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_buyer_tenant_id ON public.marketplace_reviews(buyer_tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_order_id ON public.marketplace_reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_rating ON public.marketplace_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_status ON public.marketplace_reviews(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_created_at ON public.marketplace_reviews(created_at DESC);

-- ============================================================================
-- MARKETPLACE_CART
-- ============================================================================
-- Wholesale shopping cart (separate from retail cart)
CREATE TABLE IF NOT EXISTS public.marketplace_cart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Buyer
  buyer_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  buyer_user_id UUID REFERENCES public.customer_users(id),
  
  -- Cart Item
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  quantity NUMERIC(10,2) NOT NULL,
  
  -- Snapshot pricing (at time added to cart)
  unit_price NUMERIC(10,2) NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CHECK (quantity > 0),
  CHECK (unit_price > 0),
  UNIQUE(buyer_tenant_id, buyer_user_id, listing_id) -- One cart item per listing per buyer
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_cart_buyer_tenant_id ON public.marketplace_cart(buyer_tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_cart_buyer_user_id ON public.marketplace_cart(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_cart_listing_id ON public.marketplace_cart(listing_id);

-- ============================================================================
-- PLATFORM_TRANSACTIONS
-- ============================================================================
-- Platform fee tracking (transaction fees, subscription fees, etc.)
CREATE TABLE IF NOT EXISTS public.platform_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Transaction Context
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL, -- Can be null for platform-wide transactions
  order_id UUID REFERENCES public.marketplace_orders(id) ON DELETE SET NULL,
  
  -- Transaction Type
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('subscription_fee', 'platform_fee', 'transaction_fee', 'upgrade_fee', 'refund')),
  
  -- Amounts
  amount NUMERIC(10,2) NOT NULL,
  fee_percentage NUMERIC(5,2), -- e.g., 2.00 for 2%
  flat_fee NUMERIC(10,2), -- e.g., 2.50
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'collected', 'refunded', 'failed')),
  collected_at TIMESTAMPTZ,
  
  -- Payment Information
  payment_method TEXT,
  payment_reference TEXT, -- Stripe payment intent ID, etc.
  
  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CHECK (amount > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_platform_transactions_tenant_id ON public.platform_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_platform_transactions_order_id ON public.platform_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_platform_transactions_type ON public.platform_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_platform_transactions_status ON public.platform_transactions(status);
CREATE INDEX IF NOT EXISTS idx_platform_transactions_created_at ON public.platform_transactions(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.marketplace_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- MARKETPLACE_PROFILES RLS
-- ============================================================================
-- Sellers can see their own profile
CREATE POLICY "Sellers can view own profile"
  ON public.marketplace_profiles FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid));

-- Sellers can update their own profile
CREATE POLICY "Sellers can update own profile"
  ON public.marketplace_profiles FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid));

-- Buyers can see active profiles
CREATE POLICY "Buyers can view active profiles"
  ON public.marketplace_profiles FOR SELECT
  USING (marketplace_status = 'active' AND can_sell = true);

-- Super admins can see all profiles
CREATE POLICY "Super admins can view all profiles"
  ON public.marketplace_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admin_users 
      WHERE id = auth.uid()::text::uuid
    )
  );

-- ============================================================================
-- MARKETPLACE_LISTINGS RLS
-- ============================================================================
-- Sellers can see their own listings
CREATE POLICY "Sellers can view own listings"
  ON public.marketplace_listings FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid));

-- Sellers can manage their own listings
CREATE POLICY "Sellers can manage own listings"
  ON public.marketplace_listings FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid));

-- Buyers can see active public listings
CREATE POLICY "Buyers can view active public listings"
  ON public.marketplace_listings FOR SELECT
  USING (
    status = 'active' 
    AND visibility IN ('public', 'verified_only')
    AND EXISTS (
      SELECT 1 FROM public.marketplace_profiles mp
      WHERE mp.id = marketplace_listings.marketplace_profile_id
      AND mp.marketplace_status = 'active'
      AND mp.can_sell = true
    )
  );

-- Super admins can see all listings
CREATE POLICY "Super admins can view all listings"
  ON public.marketplace_listings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admin_users 
      WHERE id = auth.uid()::text::uuid
    )
  );

-- ============================================================================
-- MARKETPLACE_ORDERS RLS
-- ============================================================================
-- Buyers can see their own orders
CREATE POLICY "Buyers can view own orders"
  ON public.marketplace_orders FOR SELECT
  USING (buyer_tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid));

-- Sellers can see orders for their listings
CREATE POLICY "Sellers can view own orders"
  ON public.marketplace_orders FOR SELECT
  USING (seller_tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid));

-- Buyers can create orders
CREATE POLICY "Buyers can create orders"
  ON public.marketplace_orders FOR INSERT
  WITH CHECK (buyer_tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid));

-- Sellers can update their orders
CREATE POLICY "Sellers can update own orders"
  ON public.marketplace_orders FOR UPDATE
  USING (seller_tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid));

-- Super admins can see all orders
CREATE POLICY "Super admins can view all orders"
  ON public.marketplace_orders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admin_users 
      WHERE id = auth.uid()::text::uuid
    )
  );

-- ============================================================================
-- MARKETPLACE_ORDER_ITEMS RLS
-- ============================================================================
-- Inherit from parent order policies
CREATE POLICY "Users can view order items for accessible orders"
  ON public.marketplace_order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_orders mo
      WHERE mo.id = marketplace_order_items.order_id
      AND (
        mo.buyer_tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid)
        OR mo.seller_tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid)
        OR EXISTS (
          SELECT 1 FROM public.super_admin_users 
          WHERE id = auth.uid()::text::uuid
        )
      )
    )
  );

-- ============================================================================
-- MARKETPLACE_MESSAGES RLS
-- ============================================================================
-- Participants can see their messages
CREATE POLICY "Users can view own messages"
  ON public.marketplace_messages FOR SELECT
  USING (
    sender_tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid)
    OR receiver_tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid)
  );

-- Users can send messages
CREATE POLICY "Users can send messages"
  ON public.marketplace_messages FOR INSERT
  WITH CHECK (sender_tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid));

-- Users can update their own messages (mark as read)
CREATE POLICY "Users can update received messages"
  ON public.marketplace_messages FOR UPDATE
  USING (receiver_tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid));

-- ============================================================================
-- MARKETPLACE_REVIEWS RLS
-- ============================================================================
-- Buyers can see all published reviews
CREATE POLICY "Buyers can view published reviews"
  ON public.marketplace_reviews FOR SELECT
  USING (status = 'published');

-- Buyers can create reviews for their orders
CREATE POLICY "Buyers can create reviews"
  ON public.marketplace_reviews FOR INSERT
  WITH CHECK (buyer_tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid));

-- Sellers can respond to reviews
CREATE POLICY "Sellers can respond to reviews"
  ON public.marketplace_reviews FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_profiles mp
      WHERE mp.id = marketplace_reviews.seller_profile_id
      AND mp.tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid)
    )
  );

-- ============================================================================
-- MARKETPLACE_CART RLS
-- ============================================================================
-- Buyers can see their own cart
CREATE POLICY "Buyers can view own cart"
  ON public.marketplace_cart FOR SELECT
  USING (buyer_tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid));

-- Buyers can manage their own cart
CREATE POLICY "Buyers can manage own cart"
  ON public.marketplace_cart FOR ALL
  USING (buyer_tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid));

-- ============================================================================
-- PLATFORM_TRANSACTIONS RLS
-- ============================================================================
-- Tenants can see their own transactions
CREATE POLICY "Tenants can view own transactions"
  ON public.platform_transactions FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid)
    OR EXISTS (
      SELECT 1 FROM public.marketplace_orders mo
      WHERE mo.id = platform_transactions.order_id
      AND (
        mo.buyer_tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid)
        OR mo.seller_tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid)
      )
    )
  );

-- Super admins can see all transactions
CREATE POLICY "Super admins can view all transactions"
  ON public.platform_transactions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admin_users 
      WHERE id = auth.uid()::text::uuid
    )
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_marketplace_profiles_updated_at
  BEFORE UPDATE ON public.marketplace_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_listings_updated_at
  BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_orders_updated_at
  BEFORE UPDATE ON public.marketplace_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_cart_updated_at
  BEFORE UPDATE ON public.marketplace_cart
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_reviews_updated_at
  BEFORE UPDATE ON public.marketplace_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.marketplace_profiles IS 'Seller profiles for marketplace with license verification';
COMMENT ON TABLE public.marketplace_listings IS 'Product listings on marketplace with encrypted lab data';
COMMENT ON TABLE public.marketplace_orders IS 'Wholesale orders from marketplace buyers';
COMMENT ON TABLE public.marketplace_order_items IS 'Individual items in marketplace orders';
COMMENT ON TABLE public.marketplace_messages IS 'Encrypted buyer-seller messaging';
COMMENT ON TABLE public.marketplace_reviews IS 'Supplier reviews and ratings';
COMMENT ON TABLE public.marketplace_cart IS 'Wholesale shopping cart (separate from retail)';
COMMENT ON TABLE public.platform_transactions IS 'Platform fee tracking and transaction records';

