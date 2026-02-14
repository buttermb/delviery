-- ============================================================================
-- MARKETPLACE HELPER FUNCTIONS
-- ============================================================================
-- Database functions for marketplace operations
-- ============================================================================

-- ============================================================================
-- Decrement Listing Quantity
-- ============================================================================
-- Safely decrements listing quantity when order is placed
CREATE OR REPLACE FUNCTION decrement_listing_quantity(
  p_listing_id UUID,
  p_quantity NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE marketplace_listings
  SET 
    quantity_available = GREATEST(0, quantity_available - p_quantity),
    updated_at = NOW()
  WHERE id = p_listing_id;
  
  -- Mark as sold out if quantity reaches 0
  UPDATE marketplace_listings
  SET status = 'sold_out'
  WHERE id = p_listing_id AND quantity_available <= 0;
END;
$$;

-- ============================================================================
-- Update Marketplace Profile Ratings
-- ============================================================================
-- Updates average rating and total reviews count when review is created/updated
CREATE OR REPLACE FUNCTION update_marketplace_profile_ratings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Recalculate average rating and total reviews
  UPDATE marketplace_profiles
  SET
    average_rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM marketplace_reviews
      WHERE seller_profile_id = NEW.seller_profile_id
      AND status = 'published'
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM marketplace_reviews
      WHERE seller_profile_id = NEW.seller_profile_id
      AND status = 'published'
    ),
    updated_at = NOW()
  WHERE id = NEW.seller_profile_id;
  
  RETURN NEW;
END;
$$;

-- Trigger to update ratings when review is created/updated
DROP TRIGGER IF EXISTS trigger_update_profile_ratings ON marketplace_reviews;
CREATE TRIGGER trigger_update_profile_ratings
  AFTER INSERT OR UPDATE ON marketplace_reviews
  FOR EACH ROW
  WHEN (NEW.status = 'published')
  EXECUTE FUNCTION update_marketplace_profile_ratings();

-- ============================================================================
-- Update Listing Metrics
-- ============================================================================
-- Updates listing views, orders count, etc.
CREATE OR REPLACE FUNCTION increment_listing_views(p_listing_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE marketplace_listings
  SET 
    views = COALESCE(views, 0) + 1,
    updated_at = NOW()
  WHERE id = p_listing_id;
END;
$$;

-- ============================================================================
-- Generate Order Number
-- ============================================================================
-- Generates unique order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_number TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Format: WH-YYYYMMDD-HHMMSS-XXXXXX
    v_order_number := 'WH-' || 
      TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
      TO_CHAR(NOW(), 'HH24MISS') || '-' ||
      UPPER(SUBSTRING(MD5(RANDOM()::TEXT) || MD5(RANDOM()::TEXT), 1, 6));
    
    -- Check if exists
    SELECT EXISTS(SELECT 1 FROM marketplace_orders WHERE order_number = v_order_number)
    INTO v_exists;
    
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_order_number;
END;
$$;

-- ============================================================================
-- Calculate Platform Fee
-- ============================================================================
-- Calculates 2% platform fee on order subtotal
CREATE OR REPLACE FUNCTION calculate_platform_fee(p_subtotal NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN ROUND(p_subtotal * 0.02, 2);
END;
$$;

-- ============================================================================
-- Update Profile Order Count
-- ============================================================================
-- Updates total_orders count when order status changes to 'delivered'
CREATE OR REPLACE FUNCTION update_profile_order_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only update when status changes to 'delivered'
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    UPDATE marketplace_profiles
    SET
      total_orders = COALESCE(total_orders, 0) + 1,
      updated_at = NOW()
    WHERE id = NEW.seller_profile_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to update order count
DROP TRIGGER IF EXISTS trigger_update_profile_order_count ON marketplace_orders;
CREATE TRIGGER trigger_update_profile_order_count
  AFTER UPDATE OF status ON marketplace_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_order_count();

-- ============================================================================
-- Update Listing Order Count
-- ============================================================================
-- Updates orders_count when order is created
CREATE OR REPLACE FUNCTION update_listing_order_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Increment orders_count for each listing in the order
  UPDATE marketplace_listings
  SET
    orders_count = COALESCE(orders_count, 0) + 1,
    updated_at = NOW()
  WHERE id IN (
    SELECT listing_id
    FROM marketplace_order_items
    WHERE order_id = NEW.id
    AND listing_id IS NOT NULL
  );
  
  RETURN NEW;
END;
$$;

-- Trigger to update listing order count
DROP TRIGGER IF EXISTS trigger_update_listing_order_count ON marketplace_orders;
CREATE TRIGGER trigger_update_listing_order_count
  AFTER INSERT ON marketplace_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_listing_order_count();

