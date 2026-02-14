-- Advanced Promotions System Migration
-- Extends coupons table with flexible promotion rules
-- Supports: Buy X Get Y, Spending Thresholds, Customer Targeting, etc.

-- Add new columns to existing coupons table
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS promotion_type TEXT DEFAULT 'fixed_discount' 
  CHECK (promotion_type IN (
    'fixed_discount',
    'percentage_discount', 
    'buy_x_get_y',
    'spending_threshold',
    'free_shipping'
  ));

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT '{}'::jsonb;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'all'
  CHECK (target_type IN ('all', 'specific_products', 'specific_categories', 'customer_groups'));

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS target_ids TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Buy X Get Y specific fields
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS buy_quantity INTEGER;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS get_quantity INTEGER;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS get_discount_percent INTEGER CHECK (get_discount_percent >= 0 AND get_discount_percent <= 100);

-- Spending threshold fields
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS min_purchase_amount NUMERIC(10,2);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC(10,2);

-- Enhanced usage tracking
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS total_savings NUMERIC(10,2) DEFAULT 0;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS average_order_value NUMERIC(10,2);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_coupons_promotion_type ON coupons(promotion_type);
CREATE INDEX IF NOT EXISTS idx_coupons_target_type ON coupons(target_type);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active) WHERE is_active = true;

-- Comments for documentation
COMMENT ON COLUMN coupons.promotion_type IS 'Type of promotion: fixed_discount, percentage_discount, buy_x_get_y, spending_threshold, free_shipping';
COMMENT ON COLUMN coupons.conditions IS 'JSON conditions for complex rules: {min_purchase, max_discount, customer_groups, excluded_products}';
COMMENT ON COLUMN coupons.target_type IS 'What the promotion applies to: all, specific_products, specific_categories, customer_groups';
COMMENT ON COLUMN coupons.target_ids IS 'Array of product/category/group IDs that this promotion targets';

-- Example conditions JSON structure:
-- {
--   "min_items": 2,
--   "max_uses_per_customer": 3,
--   "customer_groups": ["wholesale", "vip"],
--   "excluded_products": ["product-id-1", "product-id-2"],
--   "excluded_categories": ["category-id-1"],
--   "first_time_customers_only": false,
--   "specific_payment_methods": ["card", "paypal"]
-- }

-- Function to validate promotion rules
CREATE OR REPLACE FUNCTION validate_coupon_promotion(
  p_coupon_id UUID,
  p_cart_items JSONB,
  p_customer_id UUID DEFAULT NULL,
  p_subtotal NUMERIC DEFAULT 0
)
RETURNS TABLE (
  is_valid BOOLEAN,
  discount_amount NUMERIC,
  error_message TEXT
) AS $$
DECLARE
  v_coupon RECORD;
  v_total_quantity INTEGER;
  v_eligible_items INTEGER;
BEGIN
  -- Get coupon details
  SELECT * INTO v_coupon FROM coupons WHERE id = p_coupon_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'Coupon not found or inactive';
    RETURN;
  END IF;

  -- Check if coupon has expired
  IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < NOW() THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'Coupon has expired';
    RETURN;
  END IF;

  -- Check if coupon hasn't started yet
  IF v_coupon.valid_from IS NOT NULL AND v_coupon.valid_from > NOW() THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'Coupon not yet valid';
    RETURN;
  END IF;

  -- Check usage limits
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'Coupon usage limit reached';
    RETURN;
  END IF;

  -- Check minimum purchase for spending threshold promotions
  IF v_coupon.promotion_type = 'spending_threshold' THEN
    IF v_coupon.min_purchase_amount IS NOT NULL AND p_subtotal < v_coupon.min_purchase_amount THEN
      RETURN QUERY SELECT 
        false, 
        0::NUMERIC, 
        format('Minimum purchase of $%s required', v_coupon.min_purchase_amount);
      RETURN;
    END IF;
  END IF;

  -- Check Buy X Get Y requirements
  IF v_coupon.promotion_type = 'buy_x_get_y' THEN
    SELECT COUNT(*) INTO v_total_quantity 
    FROM jsonb_array_elements(p_cart_items) 
    WHERE (value->>'quantity')::INTEGER >= v_coupon.buy_quantity;
    
    IF v_total_quantity < 1 THEN
      RETURN QUERY SELECT 
        false, 
        0::NUMERIC, 
        format('Purchase %s items to qualify', v_coupon.buy_quantity);
      RETURN;
    END IF;
  END IF;

  -- If all checks pass, calculate discount
  CASE v_coupon.promotion_type
    WHEN 'fixed_discount' THEN
      RETURN QUERY SELECT true, v_coupon.discount_value, NULL::TEXT;
    
    WHEN 'percentage_discount' THEN
      DECLARE
        v_discount NUMERIC := p_subtotal * (v_coupon.discount_value / 100);
      BEGIN
        IF v_coupon.max_discount_amount IS NOT NULL THEN
          v_discount := LEAST(v_discount, v_coupon.max_discount_amount);
        END IF;
        RETURN QUERY SELECT true, v_discount, NULL::TEXT;
      END;
    
    WHEN 'spending_threshold' THEN
      RETURN QUERY SELECT true, v_coupon.discount_value, NULL::TEXT;
    
    WHEN 'free_shipping' THEN
      RETURN QUERY SELECT true, 0::NUMERIC, 'Free shipping applied'::TEXT;
    
    ELSE
      RETURN QUERY SELECT true, 0::NUMERIC, NULL::TEXT;
  END CASE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to calc Buy X Get Y discount
CREATE OR REPLACE FUNCTION calculate_bxgy_discount(
  p_cart_items JSONB,
  p_buy_qty INTEGER,
  p_get_qty INTEGER,
  p_discount_percent INTEGER
)
RETURNS NUMERIC AS $$
DECLARE
  v_discount NUMERIC := 0;
  v_item RECORD;
  v_sets INTEGER;
  v_item_price NUMERIC;
BEGIN
  -- For each item in cart
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
  LOOP
    v_item_price := (v_item.value->>'price')::NUMERIC;
    v_sets := FLOOR((v_item.value->>'quantity')::INTEGER / (p_buy_qty + p_get_qty));
    
    IF v_sets > 0 THEN
      -- Apply discount to the "get" items
      v_discount := v_discount + (v_sets * p_get_qty * v_item_price * (p_discount_percent / 100.0));
    END IF;
  END LOOP;
  
  RETURN v_discount;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION validate_coupon_promotion IS 'Validates promotion rules and calculates discount amount';
COMMENT ON FUNCTION calculate_bxgy_discount IS 'Calculates discount for Buy X Get Y promotions';
