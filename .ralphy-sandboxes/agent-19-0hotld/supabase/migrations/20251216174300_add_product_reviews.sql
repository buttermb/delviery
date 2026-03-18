-- Product Reviews System Migration
-- Adds complete review infrastructure with moderation and vendor responses

-- Product reviews table
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  
  -- Review content
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT NOT NULL,
  customer_name TEXT, -- For guest reviews or display name
  
  -- Verification and moderation
  is_verified_purchase BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Engagement metrics
  helpful_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Review responses (vendor replies)
CREATE TABLE IF NOT EXISTS review_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES profiles(id),
  responder_name TEXT, -- Display name
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_tenant ON product_reviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_store ON product_reviews(store_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_status ON product_reviews(status);
CREATE INDEX IF NOT EXISTS idx_product_reviews_rating ON product_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_product_reviews_created ON product_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_responses_review ON review_responses(review_id);

-- Enable RLS
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_reviews

-- Public: View approved reviews
CREATE POLICY "Public view approved reviews"
  ON product_reviews FOR SELECT
  USING (status = 'approved');

-- Customers: Create reviews for active stores
CREATE POLICY "Customers create reviews"
  ON product_reviews FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    store_id IN (SELECT id FROM stores WHERE is_active = true)
  );

-- Customers: View their own reviews (any status)
CREATE POLICY "Customers view own reviews"
  ON product_reviews FOR SELECT
  USING (customer_id = auth.uid());

-- Tenant admins: Full access to their reviews
CREATE POLICY "Tenants manage reviews"
  ON product_reviews FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users 
      WHERE user_id = auth.uid()
    )
  );

-- Platform admins: Full access
CREATE POLICY "Admins manage all reviews"
  ON product_reviews FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for review_responses

-- Public: View all responses (if parent review is approved)
CREATE POLICY "Public view responses"
  ON review_responses FOR SELECT
  USING (
    review_id IN (
      SELECT id FROM product_reviews WHERE status = 'approved'
    )
  );

-- Tenant admins: Create responses for their reviews
CREATE POLICY "Tenants create responses"
  ON review_responses FOR INSERT
  WITH CHECK (
    review_id IN (
      SELECT id FROM product_reviews 
      WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Tenant admins: Manage their responses
CREATE POLICY "Tenants manage responses"
  ON review_responses FOR ALL
  USING (
    review_id IN (
      SELECT id FROM product_reviews 
      WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_product_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_product_reviews_timestamp
  BEFORE UPDATE ON product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_product_reviews_updated_at();

-- Function to get average rating for a product
CREATE OR REPLACE FUNCTION get_product_average_rating(p_product_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(AVG(rating)::NUMERIC(3,2), 0)
  FROM product_reviews
  WHERE product_id = p_product_id
    AND status = 'approved';
$$ LANGUAGE SQL STABLE;

-- Function to get review count for a product
CREATE OR REPLACE FUNCTION get_product_review_count(p_product_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM product_reviews
  WHERE product_id = p_product_id
    AND status = 'approved';
$$ LANGUAGE SQL STABLE;

-- Add review aggregates to products view (if needed)
COMMENT ON TABLE product_reviews IS 'Customer reviews for products with moderation workflow';
COMMENT ON TABLE review_responses IS 'Vendor responses to customer reviews';
