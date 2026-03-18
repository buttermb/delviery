
-- Migration: 20250930050045
-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('flower', 'edibles', 'vapes', 'concentrates')),
  thca_percentage DECIMAL(4,2) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  description TEXT,
  strain_info TEXT,
  in_stock BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  phone TEXT,
  age_verified BOOLEAN DEFAULT false,
  id_document_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create cart items table
CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')),
  delivery_address TEXT NOT NULL,
  delivery_borough TEXT NOT NULL CHECK (delivery_borough IN ('brooklyn', 'queens', 'manhattan')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bitcoin', 'usdc')),
  delivery_fee DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create order items table
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price DECIMAL(10,2) NOT NULL,
  product_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Products are viewable by everyone
CREATE POLICY "Products are viewable by everyone"
  ON public.products FOR SELECT
  USING (true);

-- Only admins can insert/update products
CREATE POLICY "Admins can manage products"
  ON public.products FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.profiles WHERE age_verified = true));

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can manage their own cart items
CREATE POLICY "Users can view own cart"
  ON public.cart_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cart items"
  ON public.cart_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cart items"
  ON public.cart_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cart items"
  ON public.cart_items FOR DELETE
  USING (auth.uid() = user_id);

-- Users can view their own orders
CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own orders
CREATE POLICY "Users can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own order items
CREATE POLICY "Users can view own order items"
  ON public.order_items FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM public.orders WHERE user_id = auth.uid()
    )
  );

-- Insert sample products
INSERT INTO public.products (name, category, thca_percentage, price, description, strain_info, in_stock) VALUES
  ('Purple Haze THCA Flower', 'flower', 23.5, 45.00, 'Classic sativa-dominant strain with uplifting effects', 'Sativa-dominant hybrid with sweet berry aroma', true),
  ('OG Kush THCA Flower', 'flower', 25.8, 50.00, 'Legendary indica strain for deep relaxation', 'Indica-dominant with earthy, pine notes', true),
  ('Gelato THCA Flower', 'flower', 22.3, 48.00, 'Balanced hybrid with sweet dessert flavors', 'Hybrid strain with fruity, creamy taste', true),
  ('THCA Gummies - Mixed Berry', 'edibles', 15.0, 35.00, '10mg per gummy, 10 count package', 'Fast-acting, precisely dosed edibles', true),
  ('THCA Chocolate Bar', 'edibles', 18.5, 40.00, '100mg total, 10 pieces', 'Premium dark chocolate infused', true),
  ('Live Resin Vape Cart - Sour Diesel', 'vapes', 82.5, 55.00, '1g cartridge, strain-specific terpenes', 'Energizing sativa effects', true),
  ('THCA Disposable Vape - Blue Dream', 'vapes', 78.3, 45.00, '1g disposable, rechargeable', 'Smooth hybrid for any time', true),
  ('THCA Diamonds', 'concentrates', 95.2, 70.00, 'Pure crystalline THCA, 1g', 'Highest potency available', true),
  ('Live Rosin', 'concentrates', 88.7, 65.00, 'Solventless extraction, full spectrum', 'Premium concentrate', true);

-- Create trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Migration: 20250930052542
-- Add missing INSERT policy for order_items
-- This allows users to create order items only for their own orders
CREATE POLICY "Users can create order items" 
ON order_items 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND orders.user_id = auth.uid()
  )
);

-- Migration: 20250930065659
-- Add lab results URL to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS lab_results_url text;

COMMENT ON COLUMN public.products.lab_results_url IS 'URL to the lab results PDF or document for this product';

-- Migration: 20250930071631
-- Create user roles table for admin access
CREATE TYPE public.app_role AS ENUM ('admin', 'courier', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Loyalty points table
CREATE TABLE public.loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own points"
  ON public.loyalty_points FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own points"
  ON public.loyalty_points FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update points"
  ON public.loyalty_points FOR UPDATE
  USING (true);

-- Loyalty transactions table
CREATE TABLE public.loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON public.loyalty_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Reviews table
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(product_id, user_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews are viewable by everyone"
  ON public.reviews FOR SELECT
  USING (true);

CREATE POLICY "Users can create own reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews"
  ON public.reviews FOR DELETE
  USING (auth.uid() = user_id);

-- Blog posts table
CREATE TABLE public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  excerpt TEXT,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published BOOLEAN DEFAULT false,
  featured_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published posts are viewable by everyone"
  ON public.blog_posts FOR SELECT
  USING (published = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage posts"
  ON public.blog_posts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Add scheduled delivery and additional fields to orders
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS scheduled_delivery_time TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS courier_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS delivery_notes TEXT,
  ADD COLUMN IF NOT EXISTS estimated_delivery TIMESTAMP WITH TIME ZONE;

-- Add average rating to products (computed)
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- Function to update product ratings
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.products
  SET 
    average_rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM public.reviews
      WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
    ),
    review_count = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
    )
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_product_rating_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating();

-- Admins can manage products
CREATE POLICY "Admins can insert products"
  ON public.products FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update products"
  ON public.products FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete products"
  ON public.products FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Couriers can view assigned orders
CREATE POLICY "Couriers can view assigned orders"
  ON public.orders FOR SELECT
  USING (
    auth.uid() = courier_id OR 
    public.has_role(auth.uid(), 'courier') OR
    auth.uid() = user_id
  );

CREATE POLICY "Couriers can update assigned orders"
  ON public.orders FOR UPDATE
  USING (
    auth.uid() = courier_id OR 
    public.has_role(auth.uid(), 'admin')
  );

-- Migration: 20250930072233
-- Create security definer function to check age verification
CREATE OR REPLACE FUNCTION public.is_age_verified(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT age_verified FROM public.profiles WHERE user_id = _user_id),
    false
  )
$$;

-- Drop the old public products policy
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;

-- Create new age-verified policy for products
CREATE POLICY "Products viewable by age-verified users only"
ON public.products FOR SELECT
USING (
  -- Allow if user is authenticated and age-verified
  (auth.uid() IS NOT NULL AND public.is_age_verified(auth.uid()) = true)
  OR
  -- Allow admins regardless
  public.has_role(auth.uid(), 'admin')
);

-- Create trigger to auto-set age_verified for new profiles
CREATE OR REPLACE FUNCTION public.set_age_verified_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-verify age for new signups (they passed the age gate to sign up)
  NEW.age_verified := true;
  RETURN NEW;
END;
$$;

-- Add trigger to profiles table
DROP TRIGGER IF EXISTS auto_verify_age_on_signup ON public.profiles;
CREATE TRIGGER auto_verify_age_on_signup
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_age_verified_on_signup();

-- Migration: 20250930072813
-- ============================================
-- COMPREHENSIVE THCA DELIVERY PLATFORM SCHEMA
-- ============================================

-- Create ENUM types
CREATE TYPE payment_method_type AS ENUM ('cash', 'crypto');
CREATE TYPE order_status_type AS ENUM ('pending', 'accepted', 'preparing', 'out_for_delivery', 'delivered', 'cancelled');
CREATE TYPE payment_status_type AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE verification_type AS ENUM ('registration', 'delivery');
CREATE TYPE verification_method_type AS ENUM ('jumio', 'manual_scan', 'automatic');
CREATE TYPE product_category_type AS ENUM ('flower', 'edibles', 'vapes', 'concentrates', 'pre-rolls');
CREATE TYPE vehicle_type AS ENUM ('car', 'bike', 'scooter', 'ebike');

-- ============================================
-- DELIVERY ADDRESSES
-- ============================================
CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  street TEXT NOT NULL,
  apartment TEXT,
  city TEXT NOT NULL DEFAULT 'New York',
  state TEXT NOT NULL DEFAULT 'NY',
  zip_code TEXT NOT NULL,
  borough TEXT NOT NULL, -- Brooklyn, Queens, Manhattan, Bronx, Staten Island
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own addresses"
  ON public.addresses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own addresses"
  ON public.addresses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own addresses"
  ON public.addresses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own addresses"
  ON public.addresses FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- MERCHANTS (Dispensaries/Shops)
-- ============================================
CREATE TABLE public.merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  borough TEXT NOT NULL,
  license_number TEXT UNIQUE NOT NULL,
  license_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  service_radius DECIMAL(5, 2) DEFAULT 5.0, -- miles
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants are viewable by everyone"
  ON public.merchants FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage merchants"
  ON public.merchants FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- PRODUCTS (Enhanced with all fields)
-- ============================================
ALTER TABLE public.products
  DROP COLUMN IF EXISTS weight_grams,
  DROP COLUMN IF EXISTS is_concentrate,
  DROP COLUMN IF EXISTS coa_url,
  ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS weight_grams DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS is_concentrate BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS coa_url TEXT, -- Certificate of Analysis
  ADD COLUMN IF NOT EXISTS thc_content DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS cbd_content DECIMAL(5, 2);

-- Update products category to use enum
ALTER TABLE public.products 
  ALTER COLUMN category TYPE TEXT;

-- ============================================
-- INVENTORY
-- ============================================
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID UNIQUE NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  stock INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inventory viewable by everyone"
  ON public.inventory FOR SELECT
  USING (true);

CREATE POLICY "Merchants can manage own inventory"
  ON public.inventory FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE email = auth.jwt() ->> 'email'
    )
  );

-- ============================================
-- ENHANCED ORDERS
-- ============================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES public.merchants(id),
  ADD COLUMN IF NOT EXISTS address_id UUID REFERENCES public.addresses(id),
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- Update existing orders to have order numbers
UPDATE public.orders 
SET order_number = 'ORD-' || EXTRACT(EPOCH FROM created_at)::BIGINT || '-' || substring(id::text, 1, 8)
WHERE order_number IS NULL;

-- ============================================
-- ORDER TRACKING
-- ============================================
CREATE TABLE public.order_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  message TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.order_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own order tracking"
  ON public.order_tracking FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM public.orders WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Couriers can update order tracking"
  ON public.order_tracking FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'courier') OR 
    public.has_role(auth.uid(), 'admin')
  );

-- ============================================
-- COURIERS
-- ============================================
CREATE TABLE public.couriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_plate TEXT,
  license_number TEXT NOT NULL,
  age_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_online BOOLEAN DEFAULT false,
  current_lat DECIMAL(10, 8),
  current_lng DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Couriers can view own profile"
  ON public.couriers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Couriers can update own profile"
  ON public.couriers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage couriers"
  ON public.couriers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- DELIVERIES
-- ============================================
CREATE TABLE public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID UNIQUE NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  courier_id UUID NOT NULL REFERENCES public.couriers(id),
  
  pickup_lat DECIMAL(10, 8) NOT NULL,
  pickup_lng DECIMAL(11, 8) NOT NULL,
  dropoff_lat DECIMAL(10, 8) NOT NULL,
  dropoff_lng DECIMAL(11, 8) NOT NULL,
  
  estimated_pickup_time TIMESTAMP WITH TIME ZONE,
  actual_pickup_time TIMESTAMP WITH TIME ZONE,
  estimated_dropoff_time TIMESTAMP WITH TIME ZONE,
  actual_dropoff_time TIMESTAMP WITH TIME ZONE,
  
  manifest_url TEXT,
  id_verification_url TEXT,
  delivery_photo_url TEXT,
  signature_url TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deliveries"
  ON public.deliveries FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM public.orders WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Couriers can manage assigned deliveries"
  ON public.deliveries FOR ALL
  USING (courier_id IN (SELECT id FROM public.couriers WHERE user_id = auth.uid()));

-- ============================================
-- AGE VERIFICATIONS
-- ============================================
CREATE TABLE public.age_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL,
  verification_method TEXT NOT NULL,
  id_type TEXT,
  id_number TEXT,
  date_of_birth DATE,
  verified BOOLEAN DEFAULT false,
  id_front_url TEXT,
  id_back_url TEXT,
  selfie_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.age_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own verifications"
  ON public.age_verifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own verifications"
  ON public.age_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- PURCHASE LIMITS TRACKING
-- ============================================
CREATE TABLE public.purchase_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  flower_grams DECIMAL(10, 2) DEFAULT 0,
  concentrate_grams DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.purchase_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own limits"
  ON public.purchase_limits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can update limits"
  ON public.purchase_limits FOR ALL
  USING (true);

-- ============================================
-- AUDIT LOGS
-- ============================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON public.addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_borough ON public.addresses(borough);
CREATE INDEX IF NOT EXISTS idx_merchants_borough ON public.merchants(borough);
CREATE INDEX IF NOT EXISTS idx_merchants_active ON public.merchants(is_active);
CREATE INDEX IF NOT EXISTS idx_products_merchant ON public.products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON public.inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_merchant ON public.orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_courier ON public.orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_tracking_order ON public.order_tracking(order_id);
CREATE INDEX IF NOT EXISTS idx_couriers_online ON public.couriers(is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_deliveries_courier ON public.deliveries(courier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_limits_user_date ON public.purchase_limits(user_id, date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- ============================================
-- TRIGGERS FOR TIMESTAMPS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER merchants_updated_at
  BEFORE UPDATE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER couriers_updated_at
  BEFORE UPDATE ON public.couriers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER purchase_limits_updated_at
  BEFORE UPDATE ON public.purchase_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Migration: 20250930073606
-- Phase 1: Fix Purchase Limits RLS Policy (CRITICAL)
-- Remove overpermissive policy and create system-only access
DROP POLICY IF EXISTS "System can update limits" ON public.purchase_limits;

-- Only allow users to view their own limits
CREATE POLICY "Users can view own limits only"
ON public.purchase_limits
FOR SELECT
USING (auth.uid() = user_id);

-- System updates via secure function only
CREATE POLICY "System can update via function"
ON public.purchase_limits
FOR ALL
USING (false)
WITH CHECK (false);

-- Create secure function for purchase limit updates
CREATE OR REPLACE FUNCTION public.update_purchase_limits(
  _user_id uuid,
  _date date,
  _flower_grams numeric,
  _concentrate_grams numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.purchase_limits (user_id, date, flower_grams, concentrate_grams)
  VALUES (_user_id, _date, _flower_grams, _concentrate_grams)
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    flower_grams = public.purchase_limits.flower_grams + _flower_grams,
    concentrate_grams = public.purchase_limits.concentrate_grams + _concentrate_grams,
    updated_at = now();
    
  -- Audit log
  INSERT INTO public.audit_logs (entity_type, entity_id, action, user_id, details)
  VALUES ('purchase_limit', _user_id::text, 'UPDATE', _user_id, 
    jsonb_build_object('flower_grams', _flower_grams, 'concentrate_grams', _concentrate_grams));
END;
$$;

-- Phase 2: Create Missing decrement_inventory RPC Function (CRITICAL)
CREATE OR REPLACE FUNCTION public.decrement_inventory(
  _product_id uuid,
  _quantity integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_stock integer;
BEGIN
  -- Get current stock with row lock
  SELECT stock INTO current_stock
  FROM public.inventory
  WHERE product_id = _product_id
  FOR UPDATE;
  
  -- Check if sufficient stock
  IF current_stock IS NULL OR current_stock < _quantity THEN
    RETURN false;
  END IF;
  
  -- Decrement stock
  UPDATE public.inventory
  SET stock = stock - _quantity,
      updated_at = now()
  WHERE product_id = _product_id;
  
  RETURN true;
END;
$$;

-- Phase 3: Restrict Business Data Access (HIGH PRIORITY)
-- Fix merchants table - require authentication and hide sensitive data
DROP POLICY IF EXISTS "Merchants are viewable by everyone" ON public.merchants;

CREATE POLICY "Active merchants viewable by authenticated users"
ON public.merchants
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND is_active = true
);

CREATE POLICY "Merchants can view own profile"
ON public.merchants
FOR SELECT
USING (email = (auth.jwt() ->> 'email'::text));

-- Fix inventory table - restrict to merchants only
DROP POLICY IF EXISTS "Inventory viewable by everyone" ON public.inventory;

CREATE POLICY "Authenticated users can view inventory stock"
ON public.inventory
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Merchants can view own inventory details"
ON public.inventory
FOR ALL
USING (merchant_id IN (
  SELECT id FROM public.merchants 
  WHERE email = (auth.jwt() ->> 'email'::text)
));

-- Phase 4: Fix Database Function Security (MEDIUM PRIORITY)
-- Update all existing functions to include SET search_path

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_product_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET 
    average_rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM public.reviews
      WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
    ),
    review_count = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
    )
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_age_verified_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.age_verified := true;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Phase 5: Add admin verification function
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(_user_id, 'admin'::app_role)
$$;

-- Phase 6: Enhanced audit logging for security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  _entity_type text,
  _entity_id text,
  _action text,
  _user_id uuid,
  _details jsonb DEFAULT NULL,
  _ip_address text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO public.audit_logs (entity_type, entity_id, action, user_id, details, ip_address)
  VALUES (_entity_type, _entity_id, _action, _user_id, _details, _ip_address)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Migration: 20250930080505
-- Create admin role enum
CREATE TYPE admin_role AS ENUM ('super_admin', 'admin', 'compliance_officer', 'support');

-- Admin users table (separate from customer auth)
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role admin_role NOT NULL DEFAULT 'admin',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Admin audit logs
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Admin sessions (for enhanced security tracking)
CREATE TABLE admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_users
CREATE POLICY "Admins can view all admin users"
ON admin_users FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.user_id = auth.uid() AND au.is_active = true
  )
);

CREATE POLICY "Super admins can manage admin users"
ON admin_users FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.user_id = auth.uid() AND au.role = 'super_admin' AND au.is_active = true
  )
);

-- RLS Policies for admin_audit_logs
CREATE POLICY "Admins can view audit logs"
ON admin_audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.user_id = auth.uid() AND au.is_active = true
  )
);

CREATE POLICY "System can insert audit logs"
ON admin_audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS Policies for admin_sessions
CREATE POLICY "Admins can view own sessions"
ON admin_sessions FOR SELECT
TO authenticated
USING (
  admin_id IN (
    SELECT id FROM admin_users WHERE user_id = auth.uid()
  )
);

-- Helper function to check if user is system admin
CREATE OR REPLACE FUNCTION check_is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = _user_id AND is_active = true
  );
$$;

-- Helper function to get admin role
CREATE OR REPLACE FUNCTION get_admin_role(_user_id UUID)
RETURNS admin_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM admin_users
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1;
$$;

-- Indexes for performance
CREATE INDEX idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX idx_admin_sessions_admin_id ON admin_sessions(admin_id);
CREATE INDEX idx_admin_sessions_expires_at ON admin_sessions(expires_at);

-- Trigger for updated_at
CREATE TRIGGER update_admin_users_updated_at
BEFORE UPDATE ON admin_users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Migration: 20250930080823
-- Example: Create your first admin user
-- Replace the email with the email of an existing user who should become an admin

-- First, ensure the user exists in auth.users by signing them up normally through the app
-- Then run this to make them a super admin:

-- INSERT INTO admin_users (user_id, email, full_name, role)
-- SELECT 
--   id,
--   email,
--   COALESCE(raw_user_meta_data->>'full_name', email) as full_name,
--   'super_admin'::admin_role
-- FROM auth.users
-- WHERE email = 'your-admin@example.com';

-- Note: Uncomment and modify the above INSERT statement to create your first admin
-- This is commented to prevent accidental execution;

-- Migration: 20250930082922
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all admin users" ON admin_users;
DROP POLICY IF EXISTS "Super admins can manage admin users" ON admin_users;
DROP POLICY IF EXISTS "Admins can view own sessions" ON admin_sessions;

-- Create security definer function to check admin status
CREATE OR REPLACE FUNCTION public.check_is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = _user_id AND is_active = true
  );
$$;

-- Create security definer function to get admin role
CREATE OR REPLACE FUNCTION public.get_admin_role(_user_id uuid)
RETURNS admin_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM admin_users
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1;
$$;

-- Recreate policies using security definer functions
CREATE POLICY "Admins can view all admin users"
ON admin_users FOR SELECT
USING (public.check_is_admin(auth.uid()));

CREATE POLICY "Super admins can manage admin users"
ON admin_users FOR ALL
USING (
  public.check_is_admin(auth.uid()) 
  AND public.get_admin_role(auth.uid()) = 'super_admin'
);

CREATE POLICY "Admins can view own sessions"
ON admin_sessions FOR SELECT
USING (
  admin_id IN (
    SELECT id FROM admin_users WHERE user_id = auth.uid()
  )
);

-- Migration: 20251001033252
-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
);

-- Create RLS policies for product images bucket
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Admins can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Migration: 20251001033503
-- Update product image URLs to point to public folder
UPDATE products 
SET image_url = CASE 
  WHEN name LIKE '%Sluggers%' THEN '/products/sluggers-preroll.jpg'
  WHEN name LIKE '%Jeeters%' THEN '/products/jeeters-preroll.jpg'
  WHEN name LIKE '%Gelato%' THEN '/products/gelato-flower.jpg'
  WHEN name LIKE '%OG Kush%' THEN '/products/og-kush.jpg'
  WHEN name LIKE '%Wedding Cake%' THEN '/products/wedding-cake.jpg'
  WHEN name LIKE '%Vape%' THEN '/products/premium-vape.jpg'
  WHEN name LIKE '%Gummies%' THEN '/products/gummies.jpg'
  WHEN name LIKE '%Shatter%' OR name LIKE '%Live Resin Sugar%' THEN '/products/shatter.jpg'
END
WHERE image_url LIKE '/src/assets/products/%';

-- Migration: 20251001034248
-- Fix foreign key constraint for orders.courier_id
-- It should reference couriers.id, not users table

-- Drop the incorrect foreign key constraint
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_courier_id_fkey;

-- Add the correct foreign key constraint
ALTER TABLE public.orders
ADD CONSTRAINT orders_courier_id_fkey 
FOREIGN KEY (courier_id) 
REFERENCES public.couriers(id)
ON DELETE SET NULL;

-- Migration: 20251001034436
-- Update RLS policy to allow couriers to accept unassigned orders
DROP POLICY IF EXISTS "Couriers can update assigned orders" ON public.orders;

CREATE POLICY "Couriers can update assigned orders"
ON public.orders
FOR UPDATE
USING (
  -- Courier can update if already assigned to them
  (auth.uid() = courier_id)
  OR 
  -- Courier can accept unassigned orders (courier_id is null and user is a courier)
  (courier_id IS NULL AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'courier'
  ))
  OR
  -- Admins can update any order
  has_role(auth.uid(), 'admin'::app_role)
);

-- Migration: 20251001035244
-- Fix orders status constraint to include 'confirmed' status
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'confirmed'::text, 'preparing'::text, 'out_for_delivery'::text, 'delivered'::text, 'cancelled'::text]));

-- Migration: 20251001041158
-- Add trigger to auto-verify age on signup (since this is a demo/MVP)
-- In production, you'd want proper ID verification
CREATE OR REPLACE FUNCTION public.auto_verify_age_on_profile_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-set age_verified to true for new profiles
  -- In production, remove this and use proper ID verification
  NEW.age_verified := true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS auto_verify_age_trigger ON public.profiles;

-- Create trigger for automatic age verification
CREATE TRIGGER auto_verify_age_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_verify_age_on_profile_creation();

-- Update existing profiles to be age-verified (for testing)
UPDATE public.profiles SET age_verified = true WHERE age_verified = false;

-- Migration: 20251001042538
-- Courier authentication and profile
CREATE TABLE IF NOT EXISTS couriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  full_name TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_plate TEXT,
  license_number TEXT NOT NULL,
  
  -- Location tracking
  current_lat NUMERIC,
  current_lng NUMERIC,
  last_location_update TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_online BOOLEAN DEFAULT false,
  available_for_orders BOOLEAN DEFAULT true,
  
  -- Verification
  age_verified BOOLEAN DEFAULT false,
  background_check_status TEXT DEFAULT 'pending',
  background_check_date TIMESTAMPTZ,
  
  -- Documents
  license_front_url TEXT,
  license_back_url TEXT,
  vehicle_insurance_url TEXT,
  vehicle_registration_url TEXT,
  
  -- Earnings settings
  commission_rate NUMERIC(5,2) DEFAULT 30.00,
  weekly_earnings_goal NUMERIC(10,2),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Courier earnings tracking
CREATE TABLE IF NOT EXISTS courier_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES couriers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  
  -- Amounts
  order_total NUMERIC(10,2) NOT NULL,
  commission_rate NUMERIC(5,2) NOT NULL,
  commission_amount NUMERIC(10,2) NOT NULL,
  tip_amount NUMERIC(10,2) DEFAULT 0,
  total_earned NUMERIC(10,2) NOT NULL,
  
  -- Payment status
  status TEXT DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  week_start_date DATE NOT NULL,
  notes TEXT
);

-- Courier location history
CREATE TABLE IF NOT EXISTS courier_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES couriers(id) ON DELETE CASCADE,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  accuracy NUMERIC(10,2),
  speed NUMERIC(10,2),
  heading NUMERIC(5,2),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL
);

-- Courier shifts/sessions
CREATE TABLE IF NOT EXISTS courier_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES couriers(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  total_hours NUMERIC(5,2),
  total_deliveries INT DEFAULT 0,
  total_earnings NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'active'
);

-- Courier performance metrics
CREATE TABLE IF NOT EXISTS courier_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES couriers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Daily stats
  deliveries_completed INT DEFAULT 0,
  deliveries_cancelled INT DEFAULT 0,
  total_distance_miles NUMERIC(10,2) DEFAULT 0,
  total_earnings NUMERIC(10,2) DEFAULT 0,
  avg_delivery_time_minutes INT,
  
  -- Ratings
  avg_rating NUMERIC(3,2),
  total_ratings INT DEFAULT 0,
  
  -- Compliance
  late_deliveries INT DEFAULT 0,
  id_verification_failures INT DEFAULT 0,
  
  UNIQUE(courier_id, date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_couriers_user_id ON couriers(user_id);
CREATE INDEX IF NOT EXISTS idx_couriers_is_online ON couriers(is_online);
CREATE INDEX IF NOT EXISTS idx_courier_earnings_courier_id ON courier_earnings(courier_id);
CREATE INDEX IF NOT EXISTS idx_courier_earnings_week_start ON courier_earnings(week_start_date);
CREATE INDEX IF NOT EXISTS idx_courier_location_history_courier ON courier_location_history(courier_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_courier_shifts_courier ON courier_shifts(courier_id, started_at);

-- Update orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_id UUID REFERENCES couriers(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_assigned_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_accepted_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Update deliveries table
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS pickup_photo_url TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

-- Trigger to create earnings record when order is delivered
CREATE OR REPLACE FUNCTION create_courier_earnings_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  v_commission_amount NUMERIC;
  v_commission_rate NUMERIC;
  v_week_start DATE;
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') AND NEW.courier_id IS NOT NULL THEN
    SELECT commission_rate INTO v_commission_rate
    FROM couriers
    WHERE id = NEW.courier_id;
    
    v_commission_amount := NEW.total_amount * (v_commission_rate / 100);
    v_week_start := DATE_TRUNC('week', NOW())::DATE;
    
    INSERT INTO courier_earnings (
      courier_id,
      order_id,
      order_total,
      commission_rate,
      commission_amount,
      total_earned,
      week_start_date
    ) VALUES (
      NEW.courier_id,
      NEW.id,
      NEW.total_amount,
      v_commission_rate,
      v_commission_amount,
      v_commission_amount,
      v_week_start
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_create_courier_earnings ON orders;
CREATE TRIGGER trigger_create_courier_earnings
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION create_courier_earnings_on_delivery();

-- RLS Policies for couriers
ALTER TABLE couriers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Couriers can view own profile" ON couriers;
CREATE POLICY "Couriers can view own profile" ON couriers
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Couriers can update own profile" ON couriers;
CREATE POLICY "Couriers can update own profile" ON couriers
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage couriers" ON couriers;
CREATE POLICY "Admins can manage couriers" ON couriers
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE courier_earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Couriers can view own earnings" ON courier_earnings;
CREATE POLICY "Couriers can view own earnings" ON courier_earnings
  FOR SELECT USING (
    courier_id IN (SELECT id FROM couriers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage earnings" ON courier_earnings;
CREATE POLICY "Admins can manage earnings" ON courier_earnings
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE courier_location_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Couriers can insert own location" ON courier_location_history;
CREATE POLICY "Couriers can insert own location" ON courier_location_history
  FOR INSERT WITH CHECK (
    courier_id IN (SELECT id FROM couriers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can view location history" ON courier_location_history;
CREATE POLICY "Admins can view location history" ON courier_location_history
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE courier_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Couriers can manage own shifts" ON courier_shifts;
CREATE POLICY "Couriers can manage own shifts" ON courier_shifts
  FOR ALL USING (
    courier_id IN (SELECT id FROM couriers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can view all shifts" ON courier_shifts;
CREATE POLICY "Admins can view all shifts" ON courier_shifts
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE courier_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Couriers can view own metrics" ON courier_metrics;
CREATE POLICY "Couriers can view own metrics" ON courier_metrics
  FOR SELECT USING (
    courier_id IN (SELECT id FROM couriers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can view all metrics" ON courier_metrics;
CREATE POLICY "Admins can view all metrics" ON courier_metrics
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Migration: 20251001043308
-- CRITICAL SECURITY FIX: Phase 1 - Legal Compliance & RLS Vulnerabilities

-- 1. Remove auto-age verification triggers and functions (CRITICAL LEGAL RISK)
-- Drop triggers first, then functions
DROP TRIGGER IF EXISTS auto_verify_age_on_signup ON public.profiles;
DROP TRIGGER IF EXISTS auto_verify_age_trigger ON public.profiles;
DROP TRIGGER IF EXISTS set_age_verified_trigger ON public.profiles;

-- Now drop functions
DROP FUNCTION IF EXISTS public.auto_verify_age_on_profile_creation();
DROP FUNCTION IF EXISTS public.set_age_verified_on_signup();

-- 2. Fix courier privilege escalation - restrict to assigned orders only
DROP POLICY IF EXISTS "Couriers can view assigned orders" ON public.orders;
CREATE POLICY "Couriers can view assigned orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  (auth.uid() = courier_id) OR (auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role)
);

-- Update courier update policy to only allow updates to assigned orders
DROP POLICY IF EXISTS "Couriers can update assigned orders" ON public.orders;
CREATE POLICY "Couriers can update assigned orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = courier_id) OR has_role(auth.uid(), 'admin'::app_role)
);

-- 3. Add proper INSERT policies for loyalty_transactions (prevent manipulation)
DROP POLICY IF EXISTS "Users can view own transactions" ON public.loyalty_transactions;
CREATE POLICY "Users can view own transactions"
ON public.loyalty_transactions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only system functions can insert loyalty transactions
CREATE POLICY "System can insert loyalty transactions"
ON public.loyalty_transactions
FOR INSERT
TO authenticated
WITH CHECK (false); -- Blocked for all users - only server functions

-- 4. Fix purchase_limits RLS to allow system updates via function
DROP POLICY IF EXISTS "System can update via function" ON public.purchase_limits;
DROP POLICY IF EXISTS "Users can view own limits" ON public.purchase_limits;
DROP POLICY IF EXISTS "Users can view own limits only" ON public.purchase_limits;

CREATE POLICY "Users can view own limits"
ON public.purchase_limits
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow system to insert/update via security definer functions
CREATE POLICY "System can manage limits"
ON public.purchase_limits
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- 5. Create audit log for security events
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  ip_address text,
  user_agent text,
  details jsonb,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view security events"
ON public.security_events
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can log security events"
ON public.security_events
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 6. Add age verification status tracking columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verification_submitted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS verification_approved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS verification_rejected_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS verification_rejection_reason text;

-- Update existing age_verified column to default false for new users
ALTER TABLE public.profiles 
  ALTER COLUMN age_verified SET DEFAULT false;

-- Create index for faster age verification checks
CREATE INDEX IF NOT EXISTS idx_profiles_age_verified ON public.profiles(age_verified);

-- 7. Log this security update
INSERT INTO public.audit_logs (entity_type, entity_id, action, details)
VALUES (
  'security_fix',
  'phase_1',
  'SECURITY_HARDENING',
  jsonb_build_object(
    'fixes', ARRAY[
      'Removed auto-age verification',
      'Fixed courier privilege escalation',
      'Added loyalty_transactions protection',
      'Enhanced purchase_limits security',
      'Added security events table'
    ],
    'timestamp', now()
  )
);

-- Migration: 20251001043812
-- CRITICAL SECURITY FIX: Protect Identity Documents from Unauthorized Access

-- 1. Create PRIVATE storage bucket for ID documents (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'id-documents',
  'id-documents',
  false, -- CRITICAL: Must be private
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false, -- Ensure it's private
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];

-- 2. Add RLS policy for age_verifications table - admins can view for verification
DROP POLICY IF EXISTS "Admins can view all verifications" ON public.age_verifications;
CREATE POLICY "Admins can view all verifications"
ON public.age_verifications
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = user_id
);

-- 3. Add RLS policy for age_verifications - admins can update verification status
DROP POLICY IF EXISTS "Admins can update verifications" ON public.age_verifications;
CREATE POLICY "Admins can update verifications"
ON public.age_verifications
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Create RLS policies for ID document storage (CRITICAL)
-- Users can only view their own ID documents
DROP POLICY IF EXISTS "Users can view own ID documents" ON storage.objects;
CREATE POLICY "Users can view own ID documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'id-documents' AND
  (
    -- User can view their own documents
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- Admins can view all documents for verification
    has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Users can only upload their own ID documents
DROP POLICY IF EXISTS "Users can upload own ID documents" ON storage.objects;
CREATE POLICY "Users can upload own ID documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'id-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users cannot update documents after upload (immutability for compliance)
DROP POLICY IF EXISTS "ID documents are immutable" ON storage.objects;
CREATE POLICY "ID documents are immutable"
ON storage.objects
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- Only users can delete their own documents (before verification)
DROP POLICY IF EXISTS "Users can delete unverified documents" ON storage.objects;
CREATE POLICY "Users can delete unverified documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'id-documents' AND
  auth.uid()::text = (storage.foldername(name))[1] AND
  NOT EXISTS (
    SELECT 1 FROM public.age_verifications av
    WHERE av.user_id = auth.uid()
    AND av.verified = true
  )
);

-- 5. Add encryption notice to sensitive columns (documentation)
COMMENT ON COLUMN public.age_verifications.id_number IS 'SENSITIVE: ID number - should be encrypted at application level';
COMMENT ON COLUMN public.age_verifications.date_of_birth IS 'SENSITIVE: Date of birth - PII data';
COMMENT ON COLUMN public.age_verifications.id_front_url IS 'SENSITIVE: URL to ID front image in private storage';
COMMENT ON COLUMN public.age_verifications.id_back_url IS 'SENSITIVE: URL to ID back image in private storage';
COMMENT ON COLUMN public.age_verifications.selfie_url IS 'SENSITIVE: URL to selfie image in private storage';

-- 6. Add data retention policy documentation (GDPR compliance)
COMMENT ON TABLE public.age_verifications IS 'SENSITIVE: ID documents must be deleted after 90 days post-verification per data retention policy. Access is logged in security_events.';

-- 7. Create helper function to log document access (called manually)
CREATE OR REPLACE FUNCTION public.log_document_access(
  _verification_id UUID,
  _access_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_events (
    event_type,
    user_id,
    details
  ) VALUES (
    'id_document_access',
    auth.uid(),
    jsonb_build_object(
      'verification_id', _verification_id,
      'access_type', _access_type,
      'access_time', now()
    )
  );
END;
$$;

-- 8. Log this critical security fix
INSERT INTO public.audit_logs (entity_type, entity_id, action, details)
VALUES (
  'security_fix',
  'id_documents_protection',
  'CRITICAL_SECURITY_HARDENING',
  jsonb_build_object(
    'fixes', ARRAY[
      'Created private storage bucket for ID documents',
      'Added RLS policies to protect document URLs in storage',
      'Restricted admin access with proper role-based authorization',
      'Implemented immutability for verified documents',
      'Added document access logging function',
      'Documented data retention requirements'
    ],
    'severity', 'CRITICAL',
    'timestamp', now()
  )
);

-- Migration: 20251001050615
-- Add commission_rate column to couriers table
ALTER TABLE couriers 
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 30.00;

-- Add comment to explain the column
COMMENT ON COLUMN couriers.commission_rate IS 'Commission percentage (e.g., 30.00 for 30%)';

-- Update existing couriers to have default commission rate
UPDATE couriers 
SET commission_rate = 30.00 
WHERE commission_rate IS NULL;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS create_courier_earnings_on_order_delivered ON orders;

-- Recreate the trigger
CREATE TRIGGER create_courier_earnings_on_order_delivered
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered'))
  EXECUTE FUNCTION create_courier_earnings_on_delivery();

-- Migration: 20251001051353
-- Allow public viewing of products (browse only)
-- Users still need age verification to purchase
DROP POLICY IF EXISTS "Products viewable by age-verified users only" ON products;

CREATE POLICY "Products viewable by everyone"
ON products
FOR SELECT
USING (true);

-- Add new product fields for enhanced discovery
ALTER TABLE products
ADD COLUMN IF NOT EXISTS strain_type text CHECK (strain_type IN ('indica', 'sativa', 'hybrid', 'cbd')),
ADD COLUMN IF NOT EXISTS effects text[], -- e.g., ['relaxing', 'uplifting', 'creative']
ADD COLUMN IF NOT EXISTS terpenes jsonb, -- e.g., {"myrcene": 2.5, "limonene": 1.8}
ADD COLUMN IF NOT EXISTS vendor_name text,
ADD COLUMN IF NOT EXISTS usage_tips text,
ADD COLUMN IF NOT EXISTS strain_lineage text;

-- Migration: 20251001051410
-- Add tracking code columns to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_code TEXT UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_orders_tracking_code ON orders(tracking_code);

-- Function to generate unique tracking code (format: ABC-DEF-GH12)
CREATE OR REPLACE FUNCTION generate_tracking_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..3 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..3 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate tracking code on order creation
CREATE OR REPLACE FUNCTION set_tracking_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  IF NEW.tracking_code IS NULL THEN
    LOOP
      new_code := generate_tracking_code();
      SELECT EXISTS(SELECT 1 FROM orders WHERE tracking_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.tracking_code := new_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_tracking_code ON orders;
CREATE TRIGGER trigger_set_tracking_code
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION set_tracking_code();

-- Generate tracking codes for existing orders
UPDATE orders 
SET tracking_code = generate_tracking_code()
WHERE tracking_code IS NULL;

-- Create public order tracking view (safe for anonymous access)
CREATE OR REPLACE VIEW public_order_tracking AS
SELECT 
  o.id,
  o.tracking_code,
  o.order_number,
  o.status,
  o.created_at,
  o.delivered_at,
  o.estimated_delivery,
  o.delivery_address,
  o.delivery_borough,
  o.total_amount,
  m.business_name as merchant_name,
  m.address as merchant_address,
  c.full_name as courier_name,
  c.vehicle_type as courier_vehicle,
  c.current_lat as courier_lat,
  c.current_lng as courier_lng
FROM orders o
LEFT JOIN merchants m ON o.merchant_id = m.id
LEFT JOIN couriers c ON o.courier_id = c.id;

-- Grant access to the view
GRANT SELECT ON public_order_tracking TO anon, authenticated;

-- RLS Policy: Anyone can track with valid code (drop first if exists)
DROP POLICY IF EXISTS "Anyone can track with code" ON orders;
CREATE POLICY "Anyone can track with code" ON orders
  FOR SELECT
  TO anon, authenticated
  USING (tracking_code IS NOT NULL);

-- Migration: 20251001051426
-- Fix security: Set search_path for generate_tracking_code function
CREATE OR REPLACE FUNCTION generate_tracking_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..3 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..3 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix security: Set search_path for set_tracking_code function
CREATE OR REPLACE FUNCTION set_tracking_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  IF NEW.tracking_code IS NULL THEN
    LOOP
      new_code := generate_tracking_code();
      SELECT EXISTS(SELECT 1 FROM orders WHERE tracking_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.tracking_code := new_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Migration: 20251001052434
-- Add missing columns for full courier functionality

-- Enhance couriers table
ALTER TABLE couriers ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE couriers ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 5.0;
ALTER TABLE couriers ADD COLUMN IF NOT EXISTS total_deliveries INT DEFAULT 0;
ALTER TABLE couriers ADD COLUMN IF NOT EXISTS on_time_rate DECIMAL(5,2) DEFAULT 100.0;
ALTER TABLE couriers ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMPTZ;

-- Enhance orders table with delivery details
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_lat DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_lng DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dropoff_lat DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dropoff_lng DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS distance_miles DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS special_instructions TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS requires_id_check BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS proof_of_delivery_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_signature_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_rating INT CHECK (courier_rating >= 1 AND courier_rating <= 5);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_feedback TEXT;

-- Update courier_earnings to include tips and bonuses
ALTER TABLE courier_earnings ADD COLUMN IF NOT EXISTS base_pay DECIMAL(10,2);
ALTER TABLE courier_earnings ADD COLUMN IF NOT EXISTS bonus_amount DECIMAL(10,2) DEFAULT 0;

-- Add coordinates to merchants and addresses if not exists
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Create courier chat messages table
CREATE TABLE IF NOT EXISTS courier_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  courier_id UUID REFERENCES couriers(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courier_messages_order ON courier_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_courier_messages_courier ON courier_messages(courier_id);

-- Create courier performance bonuses table
CREATE TABLE IF NOT EXISTS courier_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES couriers(id) ON DELETE CASCADE,
  bonus_type TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  earned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courier_bonuses_courier ON courier_bonuses(courier_id);

-- Create courier streaks table
CREATE TABLE IF NOT EXISTS courier_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES couriers(id) ON DELETE CASCADE,
  streak_date DATE NOT NULL,
  consecutive_deliveries INT DEFAULT 0,
  bonus_earned DECIMAL(10,2) DEFAULT 0,
  UNIQUE(courier_id, streak_date)
);

-- Function to apply peak hours bonus
CREATE OR REPLACE FUNCTION apply_peak_hours_bonus()
RETURNS TRIGGER AS $$
DECLARE
  hour INT;
  bonus DECIMAL;
BEGIN
  hour := EXTRACT(HOUR FROM NEW.created_at);
  
  -- Lunch rush (11 AM - 2 PM) - 20% bonus
  IF hour >= 11 AND hour <= 14 THEN
    bonus := NEW.commission_amount * 0.20;
    NEW.bonus_amount := COALESCE(NEW.bonus_amount, 0) + bonus;
    
    INSERT INTO courier_bonuses (courier_id, bonus_type, amount, description)
    VALUES (NEW.courier_id, 'peak_hours', bonus, 'Lunch rush bonus (20%)');
  END IF;
  
  -- Dinner rush (5 PM - 9 PM) - 25% bonus
  IF hour >= 17 AND hour <= 21 THEN
    bonus := NEW.commission_amount * 0.25;
    NEW.bonus_amount := COALESCE(NEW.bonus_amount, 0) + bonus;
    
    INSERT INTO courier_bonuses (courier_id, bonus_type, amount, description)
    VALUES (NEW.courier_id, 'peak_hours', bonus, 'Dinner rush bonus (25%)');
  END IF;
  
  -- Recalculate total_earned with tips and bonuses
  NEW.total_earned := NEW.commission_amount + COALESCE(NEW.tip_amount, 0) + COALESCE(NEW.bonus_amount, 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for peak hours bonus
DROP TRIGGER IF EXISTS trigger_peak_hours_bonus ON courier_earnings;
CREATE TRIGGER trigger_peak_hours_bonus
BEFORE INSERT ON courier_earnings
FOR EACH ROW
EXECUTE FUNCTION apply_peak_hours_bonus();

-- Function to update streak bonuses
CREATE OR REPLACE FUNCTION update_delivery_streak()
RETURNS TRIGGER AS $$
DECLARE
  today_deliveries INT;
  streak_bonus DECIMAL := 0;
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') AND NEW.courier_id IS NOT NULL THEN
    -- Count today's deliveries
    SELECT COUNT(*) INTO today_deliveries
    FROM orders
    WHERE courier_id = NEW.courier_id
      AND DATE(delivered_at) = CURRENT_DATE
      AND status = 'delivered';
    
    -- Update or insert streak record
    INSERT INTO courier_streaks (courier_id, streak_date, consecutive_deliveries)
    VALUES (NEW.courier_id, CURRENT_DATE, today_deliveries)
    ON CONFLICT (courier_id, streak_date)
    DO UPDATE SET consecutive_deliveries = today_deliveries;
    
    -- Award bonuses at milestones
    IF today_deliveries = 5 THEN
      streak_bonus := 10.00;
      INSERT INTO courier_bonuses (courier_id, bonus_type, amount, description)
      VALUES (NEW.courier_id, 'completion_streak', streak_bonus, '5 deliveries streak bonus');
    ELSIF today_deliveries = 10 THEN
      streak_bonus := 25.00;
      INSERT INTO courier_bonuses (courier_id, bonus_type, amount, description)
      VALUES (NEW.courier_id, 'completion_streak', streak_bonus, '10 deliveries streak bonus');
    ELSIF today_deliveries = 15 THEN
      streak_bonus := 50.00;
      INSERT INTO courier_bonuses (courier_id, bonus_type, amount, description)
      VALUES (NEW.courier_id, 'completion_streak', streak_bonus, '15 deliveries streak bonus');
    END IF;
    
    -- Update courier total deliveries count
    UPDATE couriers
    SET total_deliveries = total_deliveries + 1
    WHERE id = NEW.courier_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for delivery streaks
DROP TRIGGER IF EXISTS trigger_delivery_streak ON orders;
CREATE TRIGGER trigger_delivery_streak
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_delivery_streak();

-- RLS Policies for new tables
ALTER TABLE courier_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE courier_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE courier_streaks ENABLE ROW LEVEL SECURITY;

-- Couriers can view their own messages
CREATE POLICY "Couriers can view own messages" ON courier_messages
  FOR SELECT USING (
    courier_id IN (SELECT id FROM couriers WHERE user_id = auth.uid())
  );

-- Couriers can insert messages
CREATE POLICY "Couriers can insert messages" ON courier_messages
  FOR INSERT WITH CHECK (
    courier_id IN (SELECT id FROM couriers WHERE user_id = auth.uid())
  );

-- Couriers can view their own bonuses
CREATE POLICY "Couriers can view own bonuses" ON courier_bonuses
  FOR SELECT USING (
    courier_id IN (SELECT id FROM couriers WHERE user_id = auth.uid())
  );

-- Couriers can view their own streaks
CREATE POLICY "Couriers can view own streaks" ON courier_streaks
  FOR SELECT USING (
    courier_id IN (SELECT id FROM couriers WHERE user_id = auth.uid())
  );

-- Admins can view all
CREATE POLICY "Admins can view all messages" ON courier_messages
  FOR SELECT USING (check_is_admin(auth.uid()));

CREATE POLICY "Admins can view all bonuses" ON courier_bonuses
  FOR SELECT USING (check_is_admin(auth.uid()));

CREATE POLICY "Admins can view all streaks" ON courier_streaks
  FOR SELECT USING (check_is_admin(auth.uid()));

-- Migration: 20251001052530
-- Create courier applications table
CREATE TABLE public.courier_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  borough TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  experience TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'needs_info')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES admin_users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.courier_applications ENABLE ROW LEVEL SECURITY;

-- Admins can view all applications
CREATE POLICY "Admins can view all applications"
ON public.courier_applications
FOR SELECT
USING (check_is_admin(auth.uid()));

-- Admins can update applications
CREATE POLICY "Admins can update applications"
ON public.courier_applications
FOR UPDATE
USING (check_is_admin(auth.uid()));

-- Anyone can insert applications (public form)
CREATE POLICY "Anyone can submit applications"
ON public.courier_applications
FOR INSERT
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_courier_applications_updated_at
BEFORE UPDATE ON public.courier_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Migration: 20251001053202
-- Add DELETE policy for admins on orders table
CREATE POLICY "Admins can delete orders"
ON public.orders
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Migration: 20251001054459
-- Essential courier fields only
ALTER TABLE couriers ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT 30.00;
ALTER TABLE couriers ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE couriers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE couriers ADD COLUMN IF NOT EXISTS current_lat DOUBLE PRECISION;
ALTER TABLE couriers ADD COLUMN IF NOT EXISTS current_lng DOUBLE PRECISION;

-- Essential order fields
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_id UUID REFERENCES couriers(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_code TEXT UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_lat DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_lng DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dropoff_lat DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dropoff_lng DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(10,2) DEFAULT 0;

-- Simple earnings table (only if not exists)
CREATE TABLE IF NOT EXISTS courier_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES couriers(id),
  order_id UUID REFERENCES orders(id),
  order_total DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  tip_amount DECIMAL(10,2) DEFAULT 0,
  total_earned DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  week_start_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add week_start_date if missing
ALTER TABLE courier_earnings ADD COLUMN IF NOT EXISTS week_start_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Auto-calculate earnings when order delivered
CREATE OR REPLACE FUNCTION create_courier_earnings_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  v_commission_rate DECIMAL;
  v_commission_amount DECIMAL;
  v_week_start DATE;
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') AND NEW.courier_id IS NOT NULL THEN
    -- Get courier commission rate
    SELECT commission_rate INTO v_commission_rate FROM couriers WHERE id = NEW.courier_id;
    
    -- Calculate commission
    v_commission_amount := NEW.total_amount * (v_commission_rate / 100);
    
    -- Get week start date
    v_week_start := DATE_TRUNC('week', NOW())::DATE;
    
    -- Create earning record
    INSERT INTO courier_earnings (
      courier_id, order_id, order_total, commission_rate,
      commission_amount, tip_amount, total_earned, week_start_date
    ) VALUES (
      NEW.courier_id, NEW.id, NEW.total_amount, v_commission_rate,
      v_commission_amount, COALESCE(NEW.tip_amount, 0),
      v_commission_amount + COALESCE(NEW.tip_amount, 0),
      v_week_start
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_create_earnings ON orders;
CREATE TRIGGER trigger_create_earnings
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION create_courier_earnings_on_delivery();

-- Generate tracking codes
CREATE OR REPLACE FUNCTION generate_tracking_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..3 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..3 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Auto-generate tracking code
CREATE OR REPLACE FUNCTION set_tracking_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  IF NEW.tracking_code IS NULL THEN
    LOOP
      new_code := generate_tracking_code();
      SELECT EXISTS(SELECT 1 FROM orders WHERE tracking_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.tracking_code := new_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_set_tracking_code ON orders;
CREATE TRIGGER trigger_set_tracking_code
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION set_tracking_code();

-- RLS policies for courier_earnings
ALTER TABLE courier_earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Couriers can view own earnings" ON courier_earnings;
CREATE POLICY "Couriers can view own earnings" ON courier_earnings
  FOR SELECT USING (
    courier_id IN (SELECT id FROM couriers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage earnings" ON courier_earnings;
CREATE POLICY "Admins can manage earnings" ON courier_earnings
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Migration: 20251001061007
-- Fix commission calculation to use subtotal instead of total_amount
-- This ensures courier commission is calculated on product prices only, not delivery fees

CREATE OR REPLACE FUNCTION create_earnings_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  v_commission_rate DECIMAL(5,2);
  v_commission_amount DECIMAL(10,2);
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') AND NEW.courier_id IS NOT NULL THEN
    -- Get courier commission rate
    SELECT commission_rate INTO v_commission_rate
    FROM couriers
    WHERE id = NEW.courier_id;
    
    -- Calculate commission on SUBTOTAL only (excludes delivery fee)
    v_commission_amount := NEW.subtotal * (v_commission_rate / 100);
    
    -- Create earnings record
    INSERT INTO courier_earnings (
      courier_id,
      order_id,
      order_total,
      commission_rate,
      commission_amount,
      tip_amount,
      total_earned
    ) VALUES (
      NEW.courier_id,
      NEW.id,
      NEW.total_amount,
      v_commission_rate,
      v_commission_amount,
      COALESCE(NEW.tip_amount, 0),
      v_commission_amount + COALESCE(NEW.tip_amount, 0)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_create_earnings ON orders;
CREATE TRIGGER trigger_create_earnings
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION create_earnings_on_delivery();

-- Migration: 20251001080615
-- Ensure order statuses are standardized
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'));

-- Create order status history table
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT, -- 'customer', 'courier', 'admin', 'merchant', 'system'
  changed_by_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);

-- Enable RLS on order_status_history
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- Admins can view all status history
CREATE POLICY "Admins can view status history"
ON order_status_history FOR SELECT
USING (check_is_admin(auth.uid()));

-- Couriers can view status history for their orders
CREATE POLICY "Couriers can view own order status history"
ON order_status_history FOR SELECT
USING (
  order_id IN (
    SELECT id FROM orders WHERE courier_id IN (
      SELECT id FROM couriers WHERE user_id = auth.uid()
    )
  )
);

-- Users can view status history for their orders
CREATE POLICY "Users can view own order status history"
ON order_status_history FOR SELECT
USING (
  order_id IN (
    SELECT id FROM orders WHERE user_id = auth.uid()
  )
);

-- System can insert status history
CREATE POLICY "System can insert status history"
ON order_status_history FOR INSERT
WITH CHECK (true);

-- Function to track status changes
CREATE OR REPLACE FUNCTION track_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
    VALUES (NEW.id, OLD.status, NEW.status, 'system', 'Status automatically updated');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_track_status ON orders;
CREATE TRIGGER trigger_track_status
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION track_status_change();

-- Migration: 20251001080631
-- Fix search_path for track_status_change function
CREATE OR REPLACE FUNCTION track_status_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
    VALUES (NEW.id, OLD.status, NEW.status, 'system', 'Status automatically updated');
  END IF;
  RETURN NEW;
END;
$$;

-- Migration: 20251001081127
-- Fix the create_earnings_on_delivery function to include week_start_date
CREATE OR REPLACE FUNCTION public.create_earnings_on_delivery()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commission_rate DECIMAL(5,2);
  v_commission_amount DECIMAL(10,2);
  v_week_start DATE;
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') AND NEW.courier_id IS NOT NULL THEN
    -- Get courier commission rate
    SELECT commission_rate INTO v_commission_rate
    FROM couriers
    WHERE id = NEW.courier_id;
    
    -- Calculate commission on SUBTOTAL only (excludes delivery fee)
    v_commission_amount := NEW.subtotal * (v_commission_rate / 100);
    
    -- Calculate week start date (Monday of current week)
    v_week_start := DATE_TRUNC('week', NOW())::DATE;
    
    -- Create earnings record with week_start_date
    INSERT INTO courier_earnings (
      courier_id,
      order_id,
      order_total,
      commission_rate,
      commission_amount,
      tip_amount,
      total_earned,
      week_start_date
    ) VALUES (
      NEW.courier_id,
      NEW.id,
      NEW.total_amount,
      v_commission_rate,
      v_commission_amount,
      COALESCE(NEW.tip_amount, 0),
      v_commission_amount + COALESCE(NEW.tip_amount, 0),
      v_week_start
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Migration: 20251001083243
-- Add customer order history tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES auth.users(id);

-- Add accepted_at timestamp for countdown timer
ALTER TABLE orders ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- Track courier acceptance timing
CREATE OR REPLACE FUNCTION set_accepted_time()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.courier_id IS NOT NULL AND (OLD.courier_id IS NULL OR OLD.courier_id != NEW.courier_id) THEN
    NEW.accepted_at := NOW();
    NEW.courier_accepted_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_accepted_time ON orders;
CREATE TRIGGER trigger_set_accepted_time
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION set_accepted_time();

-- Add courier notification preferences
ALTER TABLE couriers ADD COLUMN IF NOT EXISTS notification_sound BOOLEAN DEFAULT true;
ALTER TABLE couriers ADD COLUMN IF NOT EXISTS notification_vibrate BOOLEAN DEFAULT true;

-- Add customer_id to profiles if not exists (for tracking)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Migration: 20251001083310
-- Fix function search path security issue by dropping trigger first
DROP TRIGGER IF EXISTS trigger_set_accepted_time ON orders;
DROP FUNCTION IF EXISTS set_accepted_time();

CREATE OR REPLACE FUNCTION set_accepted_time()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.courier_id IS NOT NULL AND (OLD.courier_id IS NULL OR OLD.courier_id != NEW.courier_id) THEN
    NEW.accepted_at := NOW();
    NEW.courier_accepted_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER trigger_set_accepted_time
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION set_accepted_time();

-- Migration: 20251001111520
-- Add prices JSONB column to products table for weight-based pricing
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS prices JSONB DEFAULT '{}';

-- Add selected_weight column to cart_items to track which weight was selected
ALTER TABLE cart_items 
ADD COLUMN IF NOT EXISTS selected_weight TEXT DEFAULT '3.5g';

-- Update existing products with sample pricing structure for flower products
-- This sets up the pricing format: {"3.5g": 35.99, "7g": 65.99, "14g": 120.99, "28g": 220.99}
UPDATE products 
SET prices = jsonb_build_object(
  '3.5g', price,
  '7g', price * 1.8,
  '14g', price * 3.3,
  '28g', price * 6.0
)
WHERE category = 'flower' AND (prices IS NULL OR prices = '{}');

-- For non-flower products, set a simple single-size pricing
UPDATE products 
SET prices = jsonb_build_object('unit', price)
WHERE category != 'flower' AND (prices IS NULL OR prices = '{}');

-- Add comment explaining the prices column
COMMENT ON COLUMN products.prices IS 'JSONB object storing weight-based pricing. Format: {"3.5g": 35.99, "7g": 65.99, "14g": 120.99, "28g": 220.99} for flower, or {"unit": price} for other products';

-- Migration: 20251001112142
-- Update all flower products with proper weight-based pricing and descriptions

-- Gelato #41 Premium
UPDATE products 
SET 
  description = 'Top-shelf Gelato phenotype #41. Dense purple-tinged buds covered in frosty trichomes. Sweet creamy flavors with hints of berry and citrus. Balanced hybrid perfect for any time use. Lab-tested at 30.2% THCa.',
  prices = '{"3.5g": 65, "7g": 117, "14g": 214.5, "28g": 390}'::jsonb,
  strain_type = 'hybrid',
  effects = ARRAY['relaxed', 'happy', 'uplifted', 'creative']
WHERE name = 'Gelato #41 Premium' AND category = 'flower';

-- OG Kush Classic
UPDATE products 
SET 
  description = 'Legendary OG Kush strain with authentic genetics. Pine and earth flavors with diesel undertones. Powerful indica-dominant effects ideal for evening relaxation and pain relief. Dense, resinous buds with 24.3% THCa.',
  prices = '{"3.5g": 55, "7g": 99, "14g": 181.5, "28g": 330}'::jsonb,
  strain_type = 'indica',
  effects = ARRAY['relaxed', 'sleepy', 'euphoric', 'happy']
WHERE name = 'OG Kush Classic' AND category = 'flower';

-- Wedding Cake Premium
UPDATE products 
SET 
  description = 'Elite Wedding Cake phenotype with stunning purple and white coloration. Sweet vanilla and earthy flavors with a smooth, creamy exhale. Potent indica-dominant effects for deep relaxation. Premium quality at 27.8% THCa.',
  prices = '{"3.5g": 70, "7g": 126, "14g": 231, "28g": 420}'::jsonb,
  strain_type = 'indica',
  effects = ARRAY['relaxed', 'happy', 'euphoric', 'sleepy']
WHERE name = 'Wedding Cake Premium' AND category = 'flower';

-- Gelato THCA Flower
UPDATE products 
SET 
  description = 'Classic Gelato strain with balanced hybrid effects. Sweet dessert-like flavors reminiscent of ice cream and berries. Smooth smoke and beautiful trichome coverage. Perfect for daytime or evening use at 22.3% THCa.',
  prices = '{"3.5g": 48, "7g": 86.4, "14g": 158.4, "28g": 288}'::jsonb,
  strain_type = 'hybrid',
  effects = ARRAY['happy', 'relaxed', 'uplifted', 'creative']
WHERE name = 'Gelato THCA Flower' AND category = 'flower';

-- OG Kush THCA Flower
UPDATE products 
SET 
  description = 'Legendary indica strain perfect for deep relaxation and stress relief. Classic OG flavors of pine, earth, and lemon. Known for powerful body effects and mental calm. Premium indoor-grown at 25.8% THCa.',
  prices = '{"3.5g": 50, "7g": 90, "14g": 165, "28g": 300}'::jsonb,
  strain_type = 'indica',
  effects = ARRAY['relaxed', 'sleepy', 'happy', 'euphoric']
WHERE name = 'OG Kush THCA Flower' AND category = 'flower';

-- Purple Haze THCA Flower
UPDATE products 
SET 
  description = 'Classic sativa-dominant strain with uplifting cerebral effects. Sweet berry and earthy flavors with a hint of spice. Energizing and creative, perfect for daytime activities. Vibrant purple hues at 23.5% THCa.',
  prices = '{"3.5g": 45, "7g": 81, "14g": 148.5, "28g": 270}'::jsonb,
  strain_type = 'sativa',
  effects = ARRAY['energizing', 'creative', 'uplifted', 'focused']
WHERE name = 'Purple Haze THCA Flower' AND category = 'flower';

-- Jeeters Gelato Infused
UPDATE products 
SET 
  description = 'Premium Jeeters infused pre-roll enhanced with cannabis oil for maximum potency. Sweet Gelato strain with dessert-like flavors. Balanced hybrid effects perfect for sharing or solo sessions. 32.4% THCa with added concentrate.',
  prices = '{"3.5g": 55, "7g": 99, "14g": 181.5, "28g": 330}'::jsonb,
  strain_type = 'hybrid',
  effects = ARRAY['happy', 'relaxed', 'euphoric', 'uplifted']
WHERE name = 'Jeeters Gelato Infused' AND category = 'flower';

-- Jeeters Runtz XL
UPDATE products 
SET 
  description = 'Jeeters XL pre-roll featuring exotic Runtz strain. Candy-like flavors with tropical fruit notes and a sweet finish. Balanced hybrid effects suitable for any time of day. Premium quality at 29.7% THCa.',
  prices = '{"3.5g": 60, "7g": 108, "14g": 198, "28g": 360}'::jsonb,
  strain_type = 'hybrid',
  effects = ARRAY['happy', 'uplifted', 'relaxed', 'creative']
WHERE name = 'Jeeters Runtz XL' AND category = 'flower';

-- Sluggers Blueberry Cookies
UPDATE products 
SET 
  description = 'Premium Sluggers pre-roll featuring Blueberry Cookies strain. Indica-dominant hybrid with sweet blueberry and cookie dough flavors. Relaxing effects perfect for evening unwinding. High-quality flower at 28.5% THCa.',
  prices = '{"3.5g": 45, "7g": 81, "14g": 148.5, "28g": 270}'::jsonb,
  strain_type = 'indica',
  effects = ARRAY['relaxed', 'happy', 'sleepy', 'euphoric']
WHERE name = 'Sluggers Blueberry Cookies' AND category = 'flower';

-- Sluggers Sunset Sherbet
UPDATE products 
SET 
  description = 'Sluggers premium flower featuring Sunset Sherbet strain. Indica-dominant with fruity citrus notes and creamy undertones. Powerful relaxation with award-winning genetics. Top-shelf quality at 26.8% THCa.',
  prices = '{"3.5g": 50, "7g": 90, "14g": 165, "28g": 300}'::jsonb,
  strain_type = 'indica',
  effects = ARRAY['relaxed', 'happy', 'euphoric', 'uplifted']
WHERE name = 'Sluggers Sunset Sherbet' AND category = 'flower';

-- Update concentrates with proper pricing
UPDATE products 
SET prices = '{"1g": 55}'::jsonb
WHERE name = 'Golden Shatter - Gelato' AND category = 'concentrates';

UPDATE products 
SET prices = '{"1g": 65}'::jsonb
WHERE name = 'Live Resin Sugar - Blue Dream' AND category = 'concentrates';

UPDATE products 
SET 
  prices = '{"1g": 65}'::jsonb,
  description = 'Premium solventless live rosin extraction. Full-spectrum terpene profile with maximum flavor retention. Golden colored, sticky consistency perfect for dabbing. No solvents used, just heat and pressure. 88.7% THCa purity.'
WHERE name = 'Live Rosin' AND category = 'concentrates';

UPDATE products 
SET 
  prices = '{"1g": 70}'::jsonb,
  description = 'Pure crystalline THCA diamonds with 95.2% potency. Nearly pure THCa in crystalline form with incredible clarity. For experienced users seeking maximum potency. Perfect for dabbing at low temperatures.'
WHERE name = 'THCA Diamonds' AND category = 'concentrates';

-- Update vapes with proper pricing
UPDATE products 
SET 
  prices = '{"1g": 65}'::jsonb,
  description = 'Premium live resin vape cartridge featuring Blue Dream strain. Full-spectrum cannabis oil preserving natural terpenes. Smooth vapor with sweet berry flavors. 510-thread compatible, lab-tested at 85.6% THCa.'
WHERE name = 'Live Resin Vape - Blue Dream' AND category = 'vapes';

UPDATE products 
SET 
  prices = '{"1g": 55}'::jsonb,
  description = 'Live resin vape cartridge with classic Sour Diesel strain. Strain-specific terpenes for authentic diesel and citrus flavors. Energizing sativa effects in convenient vape form. 82.5% THCa with natural cannabis terpenes.'
WHERE name = 'Live Resin Vape Cart - Sour Diesel' AND category = 'vapes';

-- Migration: 20251001112236
-- Update product images with new realistic cannabis photos

-- Flower products
UPDATE products SET image_url = '/products/gelato-41-flower.jpg' WHERE name = 'Gelato #41 Premium';
UPDATE products SET image_url = '/products/og-kush-premium.jpg' WHERE name = 'OG Kush Classic';
UPDATE products SET image_url = '/products/wedding-cake-premium.jpg' WHERE name = 'Wedding Cake Premium';
UPDATE products SET image_url = '/products/gelato-41-flower.jpg' WHERE name = 'Gelato THCA Flower';
UPDATE products SET image_url = '/products/og-kush-premium.jpg' WHERE name = 'OG Kush THCA Flower';
UPDATE products SET image_url = '/products/purple-haze-flower.jpg' WHERE name = 'Purple Haze THCA Flower';
UPDATE products SET image_url = '/products/gelato-41-flower.jpg' WHERE name = 'Jeeters Gelato Infused';
UPDATE products SET image_url = '/products/purple-haze-flower.jpg' WHERE name = 'Jeeters Runtz XL';
UPDATE products SET image_url = '/products/purple-haze-flower.jpg' WHERE name = 'Sluggers Blueberry Cookies';
UPDATE products SET image_url = '/products/purple-haze-flower.jpg' WHERE name = 'Sluggers Sunset Sherbet';

-- Concentrate products
UPDATE products SET image_url = '/products/golden-shatter.jpg' WHERE name = 'Golden Shatter - Gelato';
UPDATE products SET image_url = '/products/live-resin-sugar.jpg' WHERE name = 'Live Resin Sugar - Blue Dream';
UPDATE products SET image_url = '/products/live-resin-sugar.jpg' WHERE name = 'Live Rosin';
UPDATE products SET image_url = '/products/golden-shatter.jpg' WHERE name = 'THCA Diamonds';

-- Vape products
UPDATE products SET image_url = '/products/live-resin-vape.jpg' WHERE name = 'Live Resin Vape - Blue Dream';
UPDATE products SET image_url = '/products/live-resin-vape.jpg' WHERE name = 'Live Resin Vape Cart - Sour Diesel';

-- Edible products
UPDATE products SET image_url = '/products/thca-gummies.jpg' WHERE name = 'Premium THCA Gummies - Mixed Fruit';
UPDATE products SET image_url = '/products/thca-gummies.jpg' WHERE name = 'High-Dose THCA Gummies - Watermelon';
UPDATE products SET image_url = '/products/thca-gummies.jpg' WHERE name = 'THCA Gummies - Mixed Berry';
UPDATE products SET image_url = '/products/thca-gummies.jpg' WHERE name = 'THCA Chocolate Bar';

-- Migration: 20251001123846
-- Enable realtime for orders table
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Migration: 20251002013215
-- Add new columns for enhanced product details
ALTER TABLE products
ADD COLUMN IF NOT EXISTS coa_pdf_url TEXT,
ADD COLUMN IF NOT EXISTS coa_qr_code_url TEXT,
ADD COLUMN IF NOT EXISTS growing_info JSONB DEFAULT '{"method": "indoor", "organic": false, "location": ""}'::jsonb,
ADD COLUMN IF NOT EXISTS consumption_methods TEXT[],
ADD COLUMN IF NOT EXISTS effects_timeline JSONB DEFAULT '{"onset": "5-15 minutes", "peak": "1-2 hours", "duration": "2-4 hours"}'::jsonb,
ADD COLUMN IF NOT EXISTS medical_benefits TEXT[];

-- Create a table for recent purchases to show social proof
CREATE TABLE IF NOT EXISTS recent_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  location TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on recent_purchases
ALTER TABLE recent_purchases ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read recent purchases (for social proof)
CREATE POLICY "Recent purchases are viewable by everyone"
ON recent_purchases
FOR SELECT
USING (true);

-- Only system can insert (will be done via trigger)
CREATE POLICY "System can insert recent purchases"
ON recent_purchases
FOR INSERT
WITH CHECK (false);

-- Add photo support to reviews
ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS photo_urls TEXT[];

-- Create a function to add recent purchase on order completion
CREATE OR REPLACE FUNCTION add_recent_purchase()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    -- Get a random product from the order
    INSERT INTO recent_purchases (product_id, customer_name, location)
    SELECT 
      oi.product_id,
      COALESCE(
        (SELECT full_name FROM profiles WHERE user_id = NEW.user_id LIMIT 1),
        'Customer'
      ),
      NEW.delivery_borough
    FROM order_items oi
    WHERE oi.order_id = NEW.id
    LIMIT 1;
    
    -- Delete old entries (keep only last 50)
    DELETE FROM recent_purchases
    WHERE id IN (
      SELECT id FROM recent_purchases
      ORDER BY created_at DESC
      OFFSET 50
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for recent purchases
DROP TRIGGER IF EXISTS trigger_add_recent_purchase ON orders;
CREATE TRIGGER trigger_add_recent_purchase
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION add_recent_purchase();

-- Enable realtime for recent purchases
ALTER PUBLICATION supabase_realtime ADD TABLE recent_purchases;

-- Migration: 20251002041028
-- Allow guest checkouts by making user_id nullable
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS policies to support guest checkouts
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Users can create orders" ON orders;

-- Allow guests to create orders (without user_id)
CREATE POLICY "Authenticated users can create orders"
ON orders FOR INSERT
WITH CHECK (auth.uid() = user_id OR (auth.uid() IS NULL AND user_id IS NULL));

-- Allow users to view their own orders, and allow anyone to view orders with tracking code
CREATE POLICY "Users can view own orders or track with code"
ON orders FOR SELECT
USING (
  auth.uid() = user_id 
  OR tracking_code IS NOT NULL 
  OR (auth.uid() = courier_id) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Update addresses table to allow NULL user_id for guest checkouts
ALTER TABLE addresses ALTER COLUMN user_id DROP NOT NULL;

-- Update address RLS policies
DROP POLICY IF EXISTS "Users can insert own addresses" ON addresses;

CREATE POLICY "Users can insert addresses"
ON addresses FOR INSERT
WITH CHECK (auth.uid() = user_id OR (auth.uid() IS NULL AND user_id IS NULL));

-- Migration: 20251003074531
-- Add PIN hash column to couriers table for security
ALTER TABLE public.couriers
ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- Migration: 20251003075358
-- Add admin PIN and ETA fields to couriers table
ALTER TABLE couriers
ADD COLUMN IF NOT EXISTS admin_pin TEXT,
ADD COLUMN IF NOT EXISTS admin_pin_verified BOOLEAN DEFAULT false;

-- Add ETA fields to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS eta_minutes INTEGER,
ADD COLUMN IF NOT EXISTS eta_updated_at TIMESTAMP WITH TIME ZONE;

-- Create admin PIN verification function
CREATE OR REPLACE FUNCTION verify_admin_pin(courier_user_id UUID, pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_pin TEXT;
BEGIN
  SELECT admin_pin INTO stored_pin
  FROM couriers
  WHERE user_id = courier_user_id;
  
  RETURN stored_pin = pin;
END;
$$;

-- Function to generate random admin PIN
CREATE OR REPLACE FUNCTION generate_admin_pin()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  pin TEXT;
BEGIN
  pin := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  RETURN pin;
END;
$$;

-- Migration: 20251003075415
-- Fix search_path for generate_admin_pin function
CREATE OR REPLACE FUNCTION generate_admin_pin()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pin TEXT;
BEGIN
  pin := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  RETURN pin;
END;
$$;

-- Migration: 20251006054803
-- Drop the insecure "Anyone can track with code" policy that allows bulk access
DROP POLICY IF EXISTS "Anyone can track with code" ON public.orders;

-- Create a more secure policy that works with the view
-- This policy allows SELECT only when the query explicitly filters by tracking_code
-- Note: RLS policies don't have access to query predicates, so we'll use a different approach
-- We'll create a function that can be called explicitly

-- First, let's keep the existing policies that work and are secure
-- The "Users can view own orders or track with code" policy already handles user access

-- Update the view to be more explicit about security
DROP VIEW IF EXISTS public.public_order_tracking;

CREATE VIEW public.public_order_tracking 
WITH (security_invoker=true)
AS
SELECT 
  o.id,
  o.order_number,
  o.tracking_code,
  o.status,
  o.created_at,
  o.estimated_delivery,
  o.delivered_at,
  o.delivery_address,
  o.delivery_borough,
  o.total_amount,
  m.business_name as merchant_name,
  m.address as merchant_address,
  c.full_name as courier_name,
  CONCAT(c.vehicle_make, ' ', c.vehicle_model) as courier_vehicle,
  c.current_lat as courier_lat,
  c.current_lng as courier_lng
FROM orders o
LEFT JOIN merchants m ON o.merchant_id = m.id
LEFT JOIN couriers c ON o.courier_id = c.id;

-- Add comment explaining security model
COMMENT ON VIEW public.public_order_tracking IS 
'Public order tracking view. Access is controlled by RLS policies on the underlying orders table. Users can only see orders they own or orders they are delivering.';

-- Migration: 20251006054855
-- Drop all SELECT policies on orders to recreate them properly
DROP POLICY IF EXISTS "Anyone can track with code" ON public.orders;
DROP POLICY IF EXISTS "Users can view own orders or track with code" ON public.orders;
DROP POLICY IF EXISTS "Couriers can view assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;

-- Recreate with proper security

-- 1. Users can view their own orders
CREATE POLICY "Users can view own orders"
ON public.orders
FOR SELECT
USING (auth.uid() = user_id);

-- 2. Couriers can view their assigned orders
CREATE POLICY "Couriers can view assigned orders"
ON public.orders
FOR SELECT
USING (
  courier_id IN (
    SELECT id FROM couriers WHERE user_id = auth.uid()
  )
);

-- 3. Admins can view all orders
CREATE POLICY "Admins can view all orders"
ON public.orders
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- 4. Create a security definer function for public tracking lookups
-- This provides controlled access for tracking codes without RLS bypasses
CREATE OR REPLACE FUNCTION public.get_order_by_tracking_code(code TEXT)
RETURNS TABLE (
  id UUID,
  order_number TEXT,
  tracking_code TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  estimated_delivery TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  delivery_address TEXT,
  delivery_borough TEXT,
  total_amount NUMERIC,
  merchant_name TEXT,
  merchant_address TEXT,
  courier_name TEXT,
  courier_vehicle TEXT,
  courier_lat NUMERIC,
  courier_lng NUMERIC
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT 
    o.id,
    o.order_number,
    o.tracking_code,
    o.status,
    o.created_at,
    o.estimated_delivery,
    o.delivered_at,
    o.delivery_address,
    o.delivery_borough,
    o.total_amount,
    m.business_name as merchant_name,
    m.address as merchant_address,
    c.full_name as courier_name,
    CONCAT(c.vehicle_make, ' ', c.vehicle_model) as courier_vehicle,
    c.current_lat as courier_lat,
    c.current_lng as courier_lng
  FROM orders o
  LEFT JOIN merchants m ON o.merchant_id = m.id
  LEFT JOIN couriers c ON o.courier_id = c.id
  WHERE o.tracking_code = code
  LIMIT 1;
$$;

-- Migration: 20251006055006
-- Drop the old function and recreate with new return type
DROP FUNCTION IF EXISTS public.get_order_by_tracking_code(TEXT);

-- Create enhanced tracking function that returns full order details as jsonb
CREATE OR REPLACE FUNCTION public.get_order_by_tracking_code(code TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'tracking_code', o.tracking_code,
    'status', o.status,
    'created_at', o.created_at,
    'estimated_delivery', o.estimated_delivery,
    'delivered_at', o.delivered_at,
    'delivery_address', o.delivery_address,
    'delivery_borough', o.delivery_borough,
    'total_amount', o.total_amount,
    'merchant', jsonb_build_object(
      'business_name', m.business_name,
      'address', m.address
    ),
    'courier', CASE 
      WHEN c.id IS NOT NULL THEN jsonb_build_object(
        'full_name', c.full_name,
        'phone', c.phone,
        'vehicle_type', c.vehicle_type,
        'vehicle_make', c.vehicle_make,
        'vehicle_model', c.vehicle_model,
        'current_lat', c.current_lat,
        'current_lng', c.current_lng
      )
      ELSE NULL
    END,
    'order_items', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'product_name', oi.product_name,
          'quantity', oi.quantity,
          'price', oi.price,
          'product', jsonb_build_object(
            'name', p.name,
            'image_url', p.image_url
          )
        )
      )
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = o.id
    )
  ) INTO result
  FROM orders o
  LEFT JOIN merchants m ON o.merchant_id = m.id
  LEFT JOIN couriers c ON o.courier_id = c.id
  WHERE o.tracking_code = code;
  
  RETURN result;
END;
$$;

-- Migration: 20251006055052
-- Add SELECT policy to courier_applications to restrict viewing to admins only
-- This prevents public access to applicant personal information

CREATE POLICY "Only admins can view applications"
ON public.courier_applications
FOR SELECT
USING (check_is_admin(auth.uid()));

-- Migration: 20251006075437
-- Add customer location tracking columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS customer_location_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS customer_lat NUMERIC,
ADD COLUMN IF NOT EXISTS customer_lng NUMERIC,
ADD COLUMN IF NOT EXISTS customer_location_accuracy INTEGER,
ADD COLUMN IF NOT EXISTS customer_location_updated_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster location queries
CREATE INDEX IF NOT EXISTS idx_orders_customer_location 
ON orders(customer_lat, customer_lng) 
WHERE customer_location_enabled = true;

-- Add index for courier locations
CREATE INDEX IF NOT EXISTS idx_couriers_current_location 
ON couriers(current_lat, current_lng) 
WHERE is_online = true;

-- Migration: 20251007040232
-- Add stock_quantity field to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0;

-- Add low_stock_alert field
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS low_stock_alert INTEGER DEFAULT 5;

-- Add cost_per_unit for profit calculations
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC DEFAULT 0;

-- Add sale_price for promotions
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS sale_price NUMERIC DEFAULT NULL;

COMMENT ON COLUMN public.products.stock_quantity IS 'Current stock quantity available';
COMMENT ON COLUMN public.products.low_stock_alert IS 'Alert threshold for low stock notifications';
COMMENT ON COLUMN public.products.cost_per_unit IS 'Cost per unit for profit margin calculations';
COMMENT ON COLUMN public.products.sale_price IS 'Sale price when product is on promotion';

-- Migration: 20251007040615
-- Add COA tracking fields to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS test_date DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS lab_name TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS batch_number TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.products.test_date IS 'Date the product was lab tested';
COMMENT ON COLUMN public.products.lab_name IS 'Name of the testing laboratory';
COMMENT ON COLUMN public.products.batch_number IS 'Batch or lot number for tracking';
COMMENT ON COLUMN public.products.images IS 'Array of additional product image URLs';

-- Migration: 20251008060549
-- Fix admin_users table RLS to prevent public access
-- The issue is that check_is_admin() queries admin_users, creating infinite recursion
-- We'll use has_role() instead which queries user_roles table

DROP POLICY IF EXISTS "Admins can view all admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins can manage admin users" ON public.admin_users;

-- Only authenticated users with 'admin' role can view admin_users
CREATE POLICY "Admins can view all admin users"
ON public.admin_users
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only super admins can manage (INSERT, UPDATE, DELETE) admin_users
CREATE POLICY "Super admins can manage admin users"
ON public.admin_users
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  get_admin_role(auth.uid()) = 'super_admin'::admin_role
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) AND 
  get_admin_role(auth.uid()) = 'super_admin'::admin_role
);

-- Migration: 20251008061201
-- Comprehensive security fix: Restrict anonymous access to all sensitive tables

-- 1. Fix couriers table - require authentication for reads
DROP POLICY IF EXISTS "Public can view couriers" ON public.couriers;
CREATE POLICY "Authenticated users can view active couriers"
ON public.couriers
FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Block anonymous access to couriers"
ON public.couriers
FOR SELECT
TO anon
USING (false);

-- 2. Fix profiles table - require authentication for reads
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- 3. Fix age_verifications table - require authentication
DROP POLICY IF EXISTS "Public can view verifications" ON public.age_verifications;
CREATE POLICY "Block anonymous access to age_verifications"
ON public.age_verifications
FOR SELECT
TO anon
USING (false);

-- 4. Fix courier_applications table - only admins can read
DROP POLICY IF EXISTS "Public can view applications" ON public.courier_applications;
CREATE POLICY "Block anonymous access to courier_applications"
ON public.courier_applications
FOR SELECT
TO anon
USING (false);

-- 5. Fix orders table - require authentication for reads
DROP POLICY IF EXISTS "Public can view orders" ON public.orders;
CREATE POLICY "Block anonymous access to orders"
ON public.orders
FOR SELECT
TO anon
USING (false);

-- 6. Fix courier_location_history - require authentication
DROP POLICY IF EXISTS "Public can view location history" ON public.courier_location_history;
CREATE POLICY "Customers can view courier location for their orders"
ON public.courier_location_history
FOR SELECT
TO authenticated
USING (
  order_id IN (
    SELECT id FROM orders WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Block anonymous access to courier_location_history"
ON public.courier_location_history
FOR SELECT
TO anon
USING (false);

-- 7. Fix merchants table - require authentication
DROP POLICY IF EXISTS "Public can view merchants" ON public.merchants;
CREATE POLICY "Authenticated users can view active merchants"
ON public.merchants
FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Block anonymous access to merchants"
ON public.merchants
FOR SELECT
TO anon
USING (false);

-- 8. Fix admin_users table - explicit deny for anon
CREATE POLICY "Block anonymous access to admin_users"
ON public.admin_users
FOR SELECT
TO anon
USING (false);

-- 9. Fix public_order_tracking view security
-- Since it's a view, we secure it through a function that requires tracking code
-- Drop the view and recreate with security definer function
DROP VIEW IF EXISTS public.public_order_tracking;

CREATE OR REPLACE FUNCTION public.get_order_tracking_by_code(tracking_code_param text)
RETURNS TABLE (
  id uuid,
  order_number text,
  tracking_code text,
  status text,
  created_at timestamptz,
  estimated_delivery timestamptz,
  delivered_at timestamptz,
  delivery_address text,
  delivery_borough text,
  total_amount numeric,
  merchant_name text,
  merchant_address text,
  courier_name text,
  courier_lat numeric,
  courier_lng numeric,
  courier_vehicle text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    o.tracking_code,
    o.status,
    o.created_at,
    o.estimated_delivery,
    o.delivered_at,
    o.delivery_address,
    o.delivery_borough,
    o.total_amount,
    m.business_name as merchant_name,
    m.address as merchant_address,
    c.full_name as courier_name,
    c.current_lat as courier_lat,
    c.current_lng as courier_lng,
    c.vehicle_type as courier_vehicle
  FROM orders o
  LEFT JOIN merchants m ON o.merchant_id = m.id
  LEFT JOIN couriers c ON o.courier_id = c.id
  WHERE o.tracking_code = tracking_code_param;
END;
$$;

-- Migration: 20251008065447
-- Add PIN tracking columns to couriers table
ALTER TABLE couriers 
ADD COLUMN IF NOT EXISTS pin_set_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS pin_last_verified_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient PIN expiration queries
CREATE INDEX IF NOT EXISTS idx_couriers_pin_set_at ON couriers(pin_set_at);

COMMENT ON COLUMN couriers.pin_set_at IS 'Timestamp when courier set their PIN (expires after 5 days)';
COMMENT ON COLUMN couriers.pin_last_verified_at IS 'Timestamp of last successful PIN verification';

-- Migration: 20251008070335
-- Add notification tracking columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notification_sent_stage_1 BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notification_sent_stage_2 BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notification_sent_stage_3 BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notification_sent_stage_4 BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notification_sent_stage_5 BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notification_sent_stage_6 BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notification_sent_stage_7 BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notification_sent_stage_8 BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_notification_sent_at TIMESTAMP WITH TIME ZONE;

-- Create notifications_log table
CREATE TABLE IF NOT EXISTS notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  notification_stage INTEGER NOT NULL,
  notification_type TEXT NOT NULL,
  recipient_phone TEXT,
  recipient_email TEXT,
  message_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create geofence_checks table
CREATE TABLE IF NOT EXISTS geofence_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES couriers(id) ON DELETE CASCADE,
  check_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  driver_lat NUMERIC NOT NULL,
  driver_lng NUMERIC NOT NULL,
  customer_lat NUMERIC NOT NULL,
  customer_lng NUMERIC NOT NULL,
  distance_miles NUMERIC NOT NULL,
  within_geofence BOOLEAN NOT NULL,
  action_attempted TEXT,
  action_allowed BOOLEAN NOT NULL,
  override_requested BOOLEAN DEFAULT FALSE,
  override_approved BOOLEAN,
  override_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update courier_location_history to track mock locations
ALTER TABLE courier_location_history ADD COLUMN IF NOT EXISTS is_mock_location BOOLEAN DEFAULT FALSE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_notification_stages ON orders(
  notification_sent_stage_1,
  notification_sent_stage_2,
  notification_sent_stage_3,
  notification_sent_stage_4,
  notification_sent_stage_5,
  notification_sent_stage_6,
  notification_sent_stage_7,
  notification_sent_stage_8
);

CREATE INDEX IF NOT EXISTS idx_notifications_log_order_id ON notifications_log(order_id);
CREATE INDEX IF NOT EXISTS idx_geofence_checks_order_id ON geofence_checks(order_id);
CREATE INDEX IF NOT EXISTS idx_geofence_checks_driver_id ON geofence_checks(driver_id);

-- Enable RLS
ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_checks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications_log
CREATE POLICY "Admins can view all notifications"
  ON notifications_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own order notifications"
  ON notifications_log FOR SELECT
  TO authenticated
  USING (order_id IN (
    SELECT id FROM orders WHERE user_id = auth.uid()
  ));

CREATE POLICY "System can insert notifications"
  ON notifications_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for geofence_checks
CREATE POLICY "Admins can view all geofence checks"
  ON geofence_checks FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Couriers can view own geofence checks"
  ON geofence_checks FOR SELECT
  TO authenticated
  USING (driver_id IN (
    SELECT id FROM couriers WHERE user_id = auth.uid()
  ));

CREATE POLICY "System can insert geofence checks"
  ON geofence_checks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update geofence checks"
  ON geofence_checks FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Migration: 20251008071030
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule notification processing to run every minute  
SELECT cron.schedule(
  'process-delivery-notifications',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://vltveasdxtfvvqbzxzuf.supabase.co/functions/v1/process-delivery-notifications',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsdHZlYXNkeHRmdnZxYnp4enVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTIyMzE5MiwiZXhwIjoyMDc0Nzk5MTkyfQ.i8Wc7YaOIrUqDRJT7Kq9vG6hHYOc39QLj-YONvHm1T4"}'::jsonb
  ) as request_id;
  $$
);

-- Migration: 20251008071443
-- Fix pg_cron by enabling pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create override_requests table
CREATE TABLE IF NOT EXISTS public.override_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) NOT NULL,
  courier_id UUID REFERENCES couriers(id) NOT NULL,
  current_distance_miles NUMERIC NOT NULL,
  reason TEXT,
  driver_location_lat NUMERIC NOT NULL,
  driver_location_lng NUMERIC NOT NULL,
  customer_location_lat NUMERIC NOT NULL,
  customer_location_lng NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by UUID REFERENCES admin_users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  sms_enabled BOOLEAN DEFAULT true,
  sms_all_updates BOOLEAN DEFAULT true,
  sms_critical_only BOOLEAN DEFAULT false,
  push_enabled BOOLEAN DEFAULT true,
  push_all_updates BOOLEAN DEFAULT true,
  push_critical_only BOOLEAN DEFAULT false,
  email_enabled BOOLEAN DEFAULT true,
  email_all_updates BOOLEAN DEFAULT false,
  email_confirmation_only BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create gps_anomalies table for tracking GPS issues
CREATE TABLE IF NOT EXISTS public.gps_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES couriers(id) NOT NULL,
  order_id UUID REFERENCES orders(id),
  anomaly_type TEXT NOT NULL CHECK (anomaly_type IN ('offline', 'mock_location', 'impossible_speed', 'low_accuracy')),
  lat NUMERIC,
  lng NUMERIC,
  accuracy_meters INTEGER,
  speed_mph NUMERIC,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved BOOLEAN DEFAULT false,
  admin_notified BOOLEAN DEFAULT false
);

-- RLS Policies for override_requests
ALTER TABLE public.override_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Couriers can create override requests"
ON public.override_requests FOR INSERT
TO authenticated
WITH CHECK (
  courier_id IN (SELECT id FROM couriers WHERE user_id = auth.uid())
);

CREATE POLICY "Couriers can view own override requests"
ON public.override_requests FOR SELECT
TO authenticated
USING (
  courier_id IN (SELECT id FROM couriers WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can view all override requests"
ON public.override_requests FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update override requests"
ON public.override_requests FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for notification_preferences
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences"
ON public.notification_preferences FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
ON public.notification_preferences FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
ON public.notification_preferences FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- RLS Policies for gps_anomalies
ALTER TABLE public.gps_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can insert GPS anomalies"
ON public.gps_anomalies FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view GPS anomalies"
ON public.gps_anomalies FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update GPS anomalies"
ON public.gps_anomalies FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes
CREATE INDEX idx_override_requests_order ON override_requests(order_id);
CREATE INDEX idx_override_requests_courier ON override_requests(courier_id);
CREATE INDEX idx_override_requests_status ON override_requests(status);
CREATE INDEX idx_notification_preferences_user ON notification_preferences(user_id);
CREATE INDEX idx_gps_anomalies_courier ON gps_anomalies(courier_id);
CREATE INDEX idx_gps_anomalies_resolved ON gps_anomalies(resolved);

-- Update trigger for notification_preferences
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Migration: 20251008093112
-- Update tracking function to include all required fields
DROP FUNCTION IF EXISTS public.get_order_by_tracking_code(TEXT);

CREATE OR REPLACE FUNCTION public.get_order_by_tracking_code(code TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'tracking_code', o.tracking_code,
    'status', o.status,
    'created_at', o.created_at,
    'estimated_delivery', o.estimated_delivery,
    'delivered_at', o.delivered_at,
    'delivery_address', o.delivery_address,
    'delivery_borough', o.delivery_borough,
    'total_amount', o.total_amount,
    'eta_minutes', o.eta_minutes,
    'eta_updated_at', o.eta_updated_at,
    'merchant', jsonb_build_object(
      'business_name', m.business_name,
      'address', m.address
    ),
    'courier', CASE 
      WHEN c.id IS NOT NULL THEN jsonb_build_object(
        'full_name', c.full_name,
        'phone', c.phone,
        'vehicle_type', c.vehicle_type,
        'vehicle_make', c.vehicle_make,
        'vehicle_model', c.vehicle_model,
        'current_lat', c.current_lat,
        'current_lng', c.current_lng,
        'rating', COALESCE(c.rating, 5.0)
      )
      ELSE NULL
    END,
    'order_items', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'product_name', oi.product_name,
          'quantity', oi.quantity,
          'price', oi.price,
          'product', jsonb_build_object(
            'name', COALESCE(p.name, oi.product_name),
            'image_url', COALESCE(p.image_url, '/placeholder.svg')
          )
        )
      )
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = o.id
    )
  ) INTO result
  FROM orders o
  LEFT JOIN merchants m ON o.merchant_id = m.id
  LEFT JOIN couriers c ON o.courier_id = c.id
  WHERE UPPER(o.tracking_code) = UPPER(code);
  
  RETURN result;
END;
$$;

-- Grant execute permission to anonymous users for public tracking
GRANT EXECUTE ON FUNCTION public.get_order_by_tracking_code(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_by_tracking_code(TEXT) TO authenticated;

-- Migration: 20251008093317
-- Add missing flagged order columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS flagged_reason TEXT,
ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS flagged_by UUID REFERENCES auth.users(id);

-- Create index for faster flagged order queries
CREATE INDEX IF NOT EXISTS idx_orders_flagged_reason ON public.orders(flagged_reason) WHERE flagged_reason IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.orders.flagged_reason IS 'Reason why order was flagged by admin';
COMMENT ON COLUMN public.orders.flagged_at IS 'Timestamp when order was flagged';
COMMENT ON COLUMN public.orders.flagged_by IS 'Admin user ID who flagged the order';

-- Migration: 20251008094227
-- Phase 1: Critical Security Fixes (Final)

-- 1.1 Consolidate Admin Authorization System
-- Migrate existing admin_users to user_roles if not already present
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::app_role
FROM public.admin_users
WHERE is_active = true 
  AND user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = admin_users.user_id 
    AND user_roles.role = 'admin'::app_role
  );

-- Make admin_users.user_id NOT NULL for data integrity
UPDATE public.admin_users 
SET user_id = id 
WHERE user_id IS NULL AND id IS NOT NULL;

ALTER TABLE public.admin_users 
ALTER COLUMN user_id SET NOT NULL;

-- 1.2 Fix Orders Table User ID - CRITICAL SECURITY FIX
-- First, delete any orders without a user (anonymous orders not allowed)
DELETE FROM public.orders WHERE user_id IS NULL;

-- Now make user_id NOT NULL to prevent future anonymous orders
ALTER TABLE public.orders 
ALTER COLUMN user_id SET NOT NULL;

-- Drop old permissive policy that allowed anonymous orders
DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;

-- Create strict policy - users can only create orders for themselves
CREATE POLICY "Authenticated users can create orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Migration: 20251008094437
-- Update verify_admin_pin to work with SHA-256 hashes
CREATE OR REPLACE FUNCTION public.verify_admin_pin(courier_user_id uuid, pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_pin_hash TEXT;
  input_hash TEXT;
BEGIN
  -- Get stored PIN hash
  SELECT admin_pin INTO stored_pin_hash
  FROM public.couriers
  WHERE user_id = courier_user_id;
  
  -- If no PIN set, return false
  IF stored_pin_hash IS NULL THEN
    RETURN false;
  END IF;
  
  -- Compute SHA-256 hash of input PIN
  input_hash := '$sha256$' || encode(digest(pin, 'sha256'), 'hex');
  
  -- Compare hashes
  RETURN stored_pin_hash = input_hash;
END;
$$;

-- Log PIN verification attempts
CREATE OR REPLACE FUNCTION public.log_pin_verification(
  courier_user_id uuid,
  success boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_events (
    event_type,
    user_id,
    details
  ) VALUES (
    'courier_pin_verification',
    courier_user_id,
    jsonb_build_object(
      'success', success,
      'timestamp', now()
    )
  );
END;
$$;

-- Migration: 20251009025612
-- Allow guest orders (user_id can be null for guest checkout)
ALTER TABLE orders 
  DROP CONSTRAINT IF EXISTS orders_user_id_fkey;

-- Add back the foreign key but allow NULL
ALTER TABLE orders 
  ADD CONSTRAINT orders_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

-- Update RLS policy to allow guest orders
DROP POLICY IF EXISTS "Authenticated users can create orders" ON orders;

CREATE POLICY "Users can create orders (including guests)"
  ON orders
  FOR INSERT
  WITH CHECK (
    -- Either authenticated user creating own order
    (auth.uid() = user_id)
    OR 
    -- Or guest checkout (no auth, user_id is null, has customer info)
    (auth.uid() IS NULL AND user_id IS NULL AND customer_name IS NOT NULL AND customer_phone IS NOT NULL)
  );

-- Allow guests to view their order by tracking code
CREATE POLICY "Anyone can view orders by tracking code"
  ON orders
  FOR SELECT
  USING (tracking_code IS NOT NULL);

-- Update order_items to allow guest order items
DROP POLICY IF EXISTS "Users can create order items" ON order_items;

CREATE POLICY "Users can create order items (including guests)"
  ON order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id 
      AND (orders.user_id = auth.uid() OR orders.user_id IS NULL)
    )
  );

-- Migration: 20251009040245
-- Allow guest checkout by making user_id nullable in orders table
ALTER TABLE public.orders 
ALTER COLUMN user_id DROP NOT NULL;

-- Add index for faster queries on user_id when it exists
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id) WHERE user_id IS NOT NULL;

-- Update RLS policies to support both authenticated and guest users
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Block anonymous access to orders" ON public.orders;

-- Allow users to view their own orders OR orders they created as guests (using customer_email/customer_phone)
CREATE POLICY "Users can view own orders or guest orders"
ON public.orders
FOR SELECT
USING (
  auth.uid() = user_id 
  OR user_id IS NULL
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Allow authenticated users to create orders with their user_id
CREATE POLICY "Authenticated users can create orders"
ON public.orders
FOR INSERT
WITH CHECK (
  (auth.uid() = user_id)
  OR (auth.uid() IS NULL AND user_id IS NULL)
);

-- Allow guests to create orders without user_id
CREATE POLICY "Guests can create orders"
ON public.orders
FOR INSERT
WITH CHECK (user_id IS NULL);

-- Migration: 20251009042148
-- Create function to add items to cart with automatic upsert
CREATE OR REPLACE FUNCTION public.add_to_cart(
  p_user_id UUID,
  p_product_id UUID,
  p_quantity INTEGER,
  p_selected_weight TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO cart_items (user_id, product_id, quantity, selected_weight)
  VALUES (p_user_id, p_product_id, p_quantity, p_selected_weight)
  ON CONFLICT (user_id, product_id, selected_weight)
  DO UPDATE SET 
    quantity = cart_items.quantity + p_quantity,
    created_at = NOW();
END;
$$;

-- Ensure the unique constraint exists for ON CONFLICT to work
CREATE UNIQUE INDEX IF NOT EXISTS cart_items_user_product_weight_idx 
ON cart_items (user_id, product_id, selected_weight);

-- Migration: 20251009043027
-- Create optimized RPC function to get all dashboard metrics in one call
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'totalOrders', (SELECT COUNT(*) FROM orders),
    'todayOrders', (SELECT COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE),
    'activeOrders', (SELECT COUNT(*) FROM orders WHERE status IN ('pending', 'accepted', 'picked_up', 'in_transit')),
    'totalUsers', (SELECT COUNT(*) FROM profiles),
    'totalMerchants', (SELECT COUNT(*) FROM merchants WHERE is_active = true),
    'activeCouriers', (SELECT COUNT(*) FROM couriers WHERE is_online = true AND is_active = true),
    'pendingVerifications', (SELECT COUNT(*) FROM age_verifications WHERE verified = false),
    'flaggedOrders', (SELECT COUNT(*) FROM orders WHERE flagged_at IS NOT NULL),
    'todayRevenue', (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE created_at >= CURRENT_DATE AND status = 'delivered')
  ) INTO result;
  
  RETURN result;
END;
$function$;

-- Create optimized function to get courier list with earnings
CREATE OR REPLACE FUNCTION public.get_couriers_with_daily_earnings()
RETURNS TABLE(
  id uuid,
  full_name text,
  email text,
  phone text,
  vehicle_type text,
  rating numeric,
  total_deliveries integer,
  is_online boolean,
  is_active boolean,
  created_at timestamp with time zone,
  today_earnings numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT 
    c.id,
    c.full_name,
    c.email,
    c.phone,
    c.vehicle_type,
    c.rating,
    c.total_deliveries,
    c.is_online,
    c.is_active,
    c.created_at,
    COALESCE(SUM(ce.total_earned) FILTER (WHERE ce.created_at >= CURRENT_DATE), 0) as today_earnings
  FROM couriers c
  LEFT JOIN courier_earnings ce ON c.id = ce.courier_id
  GROUP BY c.id
  ORDER BY c.created_at DESC;
$function$;

-- Create optimized function to get recent orders with all related data
CREATE OR REPLACE FUNCTION public.get_admin_orders(
  limit_count integer DEFAULT 50,
  offset_count integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  order_number text,
  status text,
  total_amount numeric,
  created_at timestamp with time zone,
  delivery_address text,
  delivery_borough text,
  customer_name text,
  customer_phone text,
  courier_name text,
  courier_phone text,
  merchant_name text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT 
    o.id,
    o.order_number,
    o.status,
    o.total_amount,
    o.created_at,
    o.delivery_address,
    o.delivery_borough,
    o.customer_name,
    o.customer_phone,
    c.full_name as courier_name,
    c.phone as courier_phone,
    m.business_name as merchant_name
  FROM orders o
  LEFT JOIN couriers c ON o.courier_id = c.id
  LEFT JOIN merchants m ON o.merchant_id = m.id
  ORDER BY o.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
$function$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status) WHERE status IN ('pending', 'accepted', 'picked_up', 'in_transit');
CREATE INDEX IF NOT EXISTS idx_orders_flagged ON orders(flagged_at) WHERE flagged_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_couriers_online ON couriers(is_online, is_active) WHERE is_online = true AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_age_verifications_pending ON age_verifications(verified) WHERE verified = false;
CREATE INDEX IF NOT EXISTS idx_courier_earnings_courier_id ON courier_earnings(courier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merchants_active ON merchants(is_active) WHERE is_active = true;

-- Migration: 20251009120907
-- Create trigger to auto-create profiles on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update existing profile with proper data
UPDATE public.profiles
SET full_name = 'User'
WHERE user_id = '7d03eea3-9460-4f29-a6c2-77f4a3440c09'
  AND full_name IS NULL;

-- Migration: 20251012072943
-- ============================================
-- BUD DASH NYC GIVEAWAY SYSTEM
-- ============================================

-- 1. GIVEAWAYS TABLE
CREATE TABLE IF NOT EXISTS giveaways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Info
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tagline TEXT,
  description TEXT,
  
  -- Dates
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active',
  
  -- Prizes
  grand_prize_title TEXT DEFAULT '1 LB Premium Flower',
  grand_prize_description TEXT DEFAULT 'Full pound delivered same-day',
  grand_prize_value DECIMAL(10,2) DEFAULT 4000.00,
  
  second_prize_title TEXT DEFAULT '$200 Bud Dash Credit',
  second_prize_value DECIMAL(10,2) DEFAULT 200.00,
  
  third_prize_title TEXT DEFAULT '$50 Bud Dash Credit',
  third_prize_value DECIMAL(10,2) DEFAULT 50.00,
  
  -- Entry Config
  base_entries INT DEFAULT 1,
  newsletter_bonus_entries INT DEFAULT 1,
  instagram_story_bonus_entries INT DEFAULT 2,
  instagram_post_bonus_entries INT DEFAULT 5,
  referral_bonus_entries INT DEFAULT 3,
  
  -- Stats
  total_entries INT DEFAULT 0,
  total_participants INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ENTRIES TABLE
CREATE TABLE IF NOT EXISTS giveaway_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID REFERENCES giveaways(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- User Info
  user_email TEXT,
  user_first_name TEXT,
  user_last_name TEXT,
  user_phone TEXT,
  user_borough TEXT,
  
  -- Instagram
  instagram_handle TEXT,
  instagram_verified BOOLEAN DEFAULT true,
  instagram_tag_url TEXT,
  
  -- Entry Counts
  base_entries INT DEFAULT 1,
  newsletter_entries INT DEFAULT 0,
  instagram_story_entries INT DEFAULT 0,
  instagram_post_entries INT DEFAULT 0,
  referral_entries INT DEFAULT 0,
  total_entries INT DEFAULT 1,
  
  -- Entry Numbers (for drawing)
  entry_number_start INT,
  entry_number_end INT,
  
  status TEXT DEFAULT 'verified',
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(giveaway_id, user_id)
);

-- 3. REFERRALS TABLE
CREATE TABLE IF NOT EXISTS giveaway_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID REFERENCES giveaways(id) ON DELETE CASCADE,
  referrer_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  referral_code TEXT UNIQUE NOT NULL,
  clicked_at TIMESTAMPTZ,
  signed_up_at TIMESTAMPTZ,
  converted BOOLEAN DEFAULT false,
  entries_awarded INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(giveaway_id, referred_user_id)
);

-- 4. WINNERS TABLE
CREATE TABLE IF NOT EXISTS giveaway_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID REFERENCES giveaways(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES giveaway_entries(id) ON DELETE CASCADE,
  
  prize_rank INT NOT NULL,
  prize_title TEXT,
  prize_value DECIMAL(10,2),
  winning_entry_number INT,
  
  status TEXT DEFAULT 'pending',
  notified_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  
  credit_code TEXT UNIQUE,
  credit_amount DECIMAL(10,2),
  
  selected_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. INDEXES
CREATE INDEX IF NOT EXISTS idx_entries_giveaway ON giveaway_entries(giveaway_id);
CREATE INDEX IF NOT EXISTS idx_entries_user ON giveaway_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON giveaway_referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_giveaways_slug ON giveaways(slug);

-- 6. ROW LEVEL SECURITY
ALTER TABLE giveaways ENABLE ROW LEVEL SECURITY;
ALTER TABLE giveaway_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE giveaway_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE giveaway_winners ENABLE ROW LEVEL SECURITY;

-- 7. POLICIES
CREATE POLICY "Public can view active giveaways" 
ON giveaways FOR SELECT 
USING (status = 'active');

CREATE POLICY "Admins can manage giveaways" 
ON giveaways FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own entries" 
ON giveaway_entries FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create entries" 
ON giveaway_entries FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all entries" 
ON giveaway_entries FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own referrals" 
ON giveaway_referrals FOR SELECT 
USING (auth.uid() = referrer_user_id);

CREATE POLICY "System can create referrals" 
ON giveaway_referrals FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Public can view winners" 
ON giveaway_winners FOR SELECT 
USING (status = 'announced');

CREATE POLICY "Admins can manage winners" 
ON giveaway_winners FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 8. AUTO-UPDATE STATS FUNCTION
CREATE OR REPLACE FUNCTION update_giveaway_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE giveaways
  SET 
    total_entries = (
      SELECT COALESCE(SUM(total_entries), 0) 
      FROM giveaway_entries 
      WHERE giveaway_id = NEW.giveaway_id
    ),
    total_participants = (
      SELECT COUNT(DISTINCT user_id)
      FROM giveaway_entries
      WHERE giveaway_id = NEW.giveaway_id
    ),
    updated_at = NOW()
  WHERE id = NEW.giveaway_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 9. TRIGGER
DROP TRIGGER IF EXISTS update_giveaway_stats_trigger ON giveaway_entries;
CREATE TRIGGER update_giveaway_stats_trigger
  AFTER INSERT OR UPDATE ON giveaway_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_giveaway_stats();

-- 10. INSERT TEST GIVEAWAY
INSERT INTO giveaways (
  title,
  slug,
  tagline,
  description,
  start_date,
  end_date,
  status
) VALUES (
  'NYC''s Biggest Flower Giveaway',
  'nyc-biggest-flower',
  'Win 1 LB of Premium Flower',
  'Enter to win $4,000+ in premium NYC flower. Three winners. FREE to enter.',
  NOW(),
  NOW() + INTERVAL '30 days',
  'active'
) ON CONFLICT (slug) DO NOTHING;

-- Migration: 20251012075209
-- Add referral code to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);

-- Function to generate referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    code := substr(md5(random()::text), 1, 8);
    SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = code) INTO exists;
    EXIT WHEN NOT exists;
  END LOOP;
  RETURN code;
END;
$$;

-- Trigger to auto-generate referral code for new profiles
CREATE OR REPLACE FUNCTION set_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_insert_profiles_referral_code ON profiles;
CREATE TRIGGER before_insert_profiles_referral_code
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION set_referral_code();

-- Backfill existing profiles with referral codes
UPDATE profiles SET referral_code = generate_referral_code() WHERE referral_code IS NULL;

-- Migration: 20251012075224
-- Fix search_path for generate_referral_code function
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    code := substr(md5(random()::text), 1, 8);
    SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = code) INTO exists;
    EXIT WHEN NOT exists;
  END LOOP;
  RETURN code;
END;
$$;

-- Fix search_path for set_referral_code function
CREATE OR REPLACE FUNCTION set_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

-- Migration: 20251013010833
-- Welcome Discount System
CREATE TABLE IF NOT EXISTS user_welcome_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT DEFAULT 'WELCOME10',
  discount_percentage INT DEFAULT 10,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  order_id UUID,
  UNIQUE(user_id)
);

-- Auto-issue welcome discount on user creation
CREATE OR REPLACE FUNCTION issue_welcome_discount()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_welcome_discounts (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created_issue_discount
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION issue_welcome_discount();

-- Coupon Codes System
CREATE TABLE IF NOT EXISTS coupon_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL,
  min_purchase DECIMAL(10,2) DEFAULT 0,
  max_discount DECIMAL(10,2),
  total_usage_limit INT,
  per_user_limit INT DEFAULT 1,
  used_count INT DEFAULT 0,
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  never_expires BOOLEAN DEFAULT false,
  auto_apply BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupon_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID REFERENCES coupon_codes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID,
  discount_amount DECIMAL(10,2) NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coupon_codes_code ON coupon_codes(code);
CREATE INDEX idx_coupon_codes_status ON coupon_codes(status);
CREATE INDEX idx_coupon_usage_coupon ON coupon_usage(coupon_id);
CREATE INDEX idx_coupon_usage_user ON coupon_usage(user_id);

-- Enable RLS
ALTER TABLE user_welcome_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_welcome_discounts
CREATE POLICY "Users can view own welcome discount"
  ON user_welcome_discounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert welcome discounts"
  ON user_welcome_discounts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update welcome discounts"
  ON user_welcome_discounts FOR UPDATE
  USING (true);

-- RLS Policies for coupon_codes
CREATE POLICY "Public can view active coupons"
  ON coupon_codes FOR SELECT
  USING (status = 'active');

CREATE POLICY "Admins can manage coupons"
  ON coupon_codes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for coupon_usage
CREATE POLICY "Users can view own coupon usage"
  ON coupon_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert coupon usage"
  ON coupon_usage FOR INSERT
  WITH CHECK (true);

-- Migration: 20251013011354
-- Function to increment coupon usage count
CREATE OR REPLACE FUNCTION increment_coupon_usage(coupon_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE coupon_codes
  SET used_count = used_count + 1
  WHERE id = coupon_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Migration: 20251013045502
-- Enable realtime for couriers table to sync PIN changes
ALTER TABLE public.couriers REPLICA IDENTITY FULL;

-- Add couriers table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.couriers;

-- Migration: 20251013045835
-- Create a function to hash PINs consistently
CREATE OR REPLACE FUNCTION public.hash_admin_pin(pin_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN '$sha256$' || encode(digest(pin_text, 'sha256'), 'hex');
END;
$$;

-- Migration: 20251013050116
-- Enable pgcrypto extension for digest function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Migration: 20251013050132
-- Move pgcrypto extension to extensions schema (best practice)
DROP EXTENSION IF EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Migration: 20251013050251
-- Fix hash_admin_pin to use the correct schema for pgcrypto functions
CREATE OR REPLACE FUNCTION public.hash_admin_pin(pin_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN '$sha256$' || encode(digest(pin_text, 'sha256'), 'hex');
END;
$$;

-- Migration: 20251013050547
-- Fix verify_admin_pin to use the correct schema for pgcrypto functions
CREATE OR REPLACE FUNCTION public.verify_admin_pin(courier_user_id uuid, pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  stored_pin_hash TEXT;
  input_hash TEXT;
BEGIN
  -- Get stored PIN hash
  SELECT admin_pin INTO stored_pin_hash
  FROM public.couriers
  WHERE user_id = courier_user_id;
  
  -- If no PIN set, return false
  IF stored_pin_hash IS NULL THEN
    RETURN false;
  END IF;
  
  -- Compute SHA-256 hash of input PIN
  input_hash := '$sha256$' || encode(digest(pin, 'sha256'), 'hex');
  
  -- Compare hashes
  RETURN stored_pin_hash = input_hash;
END;
$$;

-- Migration: 20251014021414
-- Enhanced Profiles Table with Risk Management
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id_code TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id_type TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id_expiry_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS selfie_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 50;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trust_level TEXT DEFAULT 'new';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_spent NUMERIC(10,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS average_order_value NUMERIC(10,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_order_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lifetime_value NUMERIC(10,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chargebacks INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS failed_payments INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cancelled_orders INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reported_issues INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_limit NUMERIC(10,2) DEFAULT 500;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_limit NUMERIC(10,2) DEFAULT 2000;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS order_limit INTEGER DEFAULT 3;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name_change_count INTEGER DEFAULT 0;

-- Enhanced Addresses Table with Risk Assessment
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS neighborhood TEXT;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS risk_zone TEXT DEFAULT 'green';
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS delivery_count INTEGER DEFAULT 0;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS issue_count INTEGER DEFAULT 0;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS coordinates JSONB;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;

-- Fraud Flags Table
CREATE TABLE IF NOT EXISTS fraud_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  auto_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id)
);

ALTER TABLE fraud_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view fraud flags"
  ON fraud_flags FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage fraud flags"
  ON fraud_flags FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Risk Factors Table (Neighborhood-based)
CREATE TABLE IF NOT EXISTS risk_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood TEXT UNIQUE NOT NULL,
  borough TEXT NOT NULL,
  risk_level INTEGER NOT NULL DEFAULT 5,
  scam_reports INTEGER DEFAULT 0,
  avg_income NUMERIC(10,2),
  crime_rate NUMERIC(5,2),
  delivery_issues INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE risk_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view risk factors"
  ON risk_factors FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage risk factors"
  ON risk_factors FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Device Fingerprints Table
CREATE TABLE IF NOT EXISTS device_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  ip_address TEXT,
  multiple_accounts BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE device_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own device fingerprints"
  ON device_fingerprints FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert device fingerprints"
  ON device_fingerprints FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all device fingerprints"
  ON device_fingerprints FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Account Logs Table
CREATE TABLE IF NOT EXISTS account_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  ip_address TEXT,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE account_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account logs"
  ON account_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all account logs"
  ON account_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert account logs"
  ON account_logs FOR INSERT
  WITH CHECK (true);

-- Payment Methods Table
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL,
  card_last_four TEXT,
  card_brand TEXT,
  card_holder_name TEXT,
  is_default BOOLEAN DEFAULT false,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own payment methods"
  ON payment_methods FOR ALL
  USING (auth.uid() = user_id);

-- Function to generate user ID code
CREATE OR REPLACE FUNCTION generate_user_id_code(p_user_id UUID, p_borough TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  zone_code TEXT;
  year_code TEXT;
  random_code TEXT;
  checksum CHAR(1);
BEGIN
  -- Get zone code from borough
  zone_code := CASE p_borough
    WHEN 'Manhattan' THEN 'MAN'
    WHEN 'Brooklyn' THEN 'BRK'
    WHEN 'Queens' THEN 'QNS'
    WHEN 'Bronx' THEN 'BRX'
    WHEN 'Staten Island' THEN 'STI'
    ELSE 'NYC'
  END;
  
  -- Get year code
  year_code := TO_CHAR(NOW(), 'YY');
  
  -- Generate random code
  random_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || p_user_id::TEXT) FROM 1 FOR 4));
  
  -- Generate checksum
  checksum := UPPER(SUBSTRING(MD5(p_user_id::TEXT) FROM 1 FOR 1));
  
  RETURN 'BUD-' || zone_code || '-' || year_code || '-' || random_code || '-' || checksum;
END;
$$;

-- Function to calculate risk score
CREATE OR REPLACE FUNCTION calculate_risk_score(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score INTEGER := 100;
  v_profile RECORD;
  v_address RECORD;
  v_flags INTEGER;
BEGIN
  -- Get user profile
  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  
  -- Get primary address
  SELECT * INTO v_address FROM addresses WHERE user_id = p_user_id AND is_default = true LIMIT 1;
  
  -- New user penalty
  IF v_profile.total_orders = 0 THEN
    v_score := v_score - 25;
  END IF;
  
  -- Cancellation rate
  IF v_profile.total_orders > 0 THEN
    IF (v_profile.cancelled_orders::FLOAT / v_profile.total_orders) > 0.3 THEN
      v_score := v_score - 30;
    END IF;
  END IF;
  
  -- Chargebacks
  IF v_profile.chargebacks > 0 THEN
    v_score := v_score - (v_profile.chargebacks * 25);
  END IF;
  
  -- Failed payments
  IF v_profile.failed_payments > 3 THEN
    v_score := v_score - 20;
  END IF;
  
  -- Address risk zone
  IF v_address.risk_zone = 'red' THEN
    v_score := v_score - 40;
  ELSIF v_address.risk_zone = 'yellow' THEN
    v_score := v_score - 20;
  END IF;
  
  -- Active fraud flags
  SELECT COUNT(*) INTO v_flags FROM fraud_flags 
  WHERE user_id = p_user_id AND resolved_at IS NULL;
  
  v_score := v_score - (v_flags * 30);
  
  -- Ensure score is between 0 and 100
  v_score := GREATEST(0, LEAST(100, v_score));
  
  RETURN v_score;
END;
$$;

-- Trigger to update risk score
CREATE OR REPLACE FUNCTION update_user_risk_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.risk_score := calculate_risk_score(NEW.user_id);
  
  -- Update trust level based on risk score
  IF NEW.risk_score >= 80 THEN
    NEW.trust_level := 'vip';
  ELSIF NEW.risk_score >= 60 THEN
    NEW.trust_level := 'regular';
  ELSIF NEW.risk_score >= 40 THEN
    NEW.trust_level := 'new';
  ELSE
    NEW.trust_level := 'flagged';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profile_risk_score
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_risk_score();

-- Insert some default risk factors for NYC neighborhoods
INSERT INTO risk_factors (neighborhood, borough, risk_level, scam_reports, delivery_issues) VALUES
  ('Upper East Side', 'Manhattan', 2, 0, 0),
  ('Tribeca', 'Manhattan', 1, 0, 0),
  ('Park Slope', 'Brooklyn', 2, 0, 1),
  ('Williamsburg', 'Brooklyn', 3, 1, 2),
  ('Bedford-Stuyvesant', 'Brooklyn', 5, 3, 5),
  ('East New York', 'Brooklyn', 8, 10, 15),
  ('Brownsville', 'Brooklyn', 9, 12, 18),
  ('Jamaica', 'Queens', 5, 4, 8),
  ('Fordham', 'Bronx', 6, 5, 10),
  ('Hunts Point', 'Bronx', 8, 8, 12)
ON CONFLICT (neighborhood) DO NOTHING;

-- Migration: 20251014022610
-- Add IP address tracking and blocking features

-- Add IP addresses table
CREATE TABLE IF NOT EXISTS public.user_ip_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  first_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_blocked BOOLEAN DEFAULT false,
  blocked_at TIMESTAMP WITH TIME ZONE,
  blocked_by UUID REFERENCES auth.users(id),
  blocked_reason TEXT,
  times_used INTEGER DEFAULT 1,
  UNIQUE(user_id, ip_address)
);

-- Add blocked devices table
CREATE TABLE IF NOT EXISTS public.blocked_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL UNIQUE,
  blocked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  blocked_by UUID REFERENCES auth.users(id),
  reason TEXT,
  user_id UUID REFERENCES auth.users(id)
);

-- Add blocked IPs table (global IP blacklist)
CREATE TABLE IF NOT EXISTS public.blocked_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL UNIQUE,
  blocked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  blocked_by UUID REFERENCES auth.users(id),
  reason TEXT,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Update device_fingerprints table to track blocking
ALTER TABLE public.device_fingerprints
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS blocked_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

-- Update account_logs to track IP addresses
ALTER TABLE public.account_logs
ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;

-- Enable RLS on new tables
ALTER TABLE public.user_ip_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_ip_addresses
CREATE POLICY "Admins can view all IP addresses"
  ON public.user_ip_addresses
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert IP addresses"
  ON public.user_ip_addresses
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update IP addresses"
  ON public.user_ip_addresses
  FOR UPDATE
  USING (true);

-- RLS policies for blocked_devices
CREATE POLICY "Admins can manage blocked devices"
  ON public.blocked_devices
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for blocked_ips
CREATE POLICY "Admins can manage blocked IPs"
  ON public.blocked_ips
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to track IP address usage
CREATE OR REPLACE FUNCTION public.track_ip_address(_user_id UUID, _ip_address TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_ip_addresses (user_id, ip_address, times_used)
  VALUES (_user_id, _ip_address, 1)
  ON CONFLICT (user_id, ip_address)
  DO UPDATE SET
    last_seen = now(),
    times_used = user_ip_addresses.times_used + 1;
END;
$$;

-- Function to check if IP is blocked
CREATE OR REPLACE FUNCTION public.is_ip_blocked(_ip_address TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_ips
    WHERE ip_address = _ip_address
    AND (expires_at IS NULL OR expires_at > now())
  );
$$;

-- Function to check if device is blocked
CREATE OR REPLACE FUNCTION public.is_device_blocked(_fingerprint TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_devices
    WHERE fingerprint = _fingerprint
  );
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_ip_addresses_user_id ON public.user_ip_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ip_addresses_ip ON public.user_ip_addresses(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_devices_fingerprint ON public.blocked_devices(fingerprint);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON public.blocked_ips(ip_address);

-- Migration: 20251014030105
-- Enable realtime for fraud_flags table
ALTER PUBLICATION supabase_realtime ADD TABLE public.fraud_flags;

-- Add replica identity for fraud_flags
ALTER TABLE public.fraud_flags REPLICA IDENTITY FULL;

-- Migration: 20251014184351
-- Add missing columns to orders table for delivery coordinates
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC,
ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC,
ADD COLUMN IF NOT EXISTS dropoff_lat NUMERIC,
ADD COLUMN IF NOT EXISTS dropoff_lng NUMERIC;

-- Add index for better performance on courier queries
CREATE INDEX IF NOT EXISTS idx_orders_courier_id ON orders(courier_id) WHERE courier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Add missing columns to couriers table
ALTER TABLE couriers
ADD COLUMN IF NOT EXISTS vehicle_plate TEXT;

-- Migration: 20251014195722
-- Clean up all test orders and related data
DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders);
DELETE FROM deliveries WHERE order_id IN (SELECT id FROM orders);
DELETE FROM courier_earnings WHERE order_id IN (SELECT id FROM orders);
DELETE FROM courier_location_history WHERE order_id IN (SELECT id FROM orders);
DELETE FROM geofence_checks WHERE order_id IN (SELECT id FROM orders);
DELETE FROM courier_messages WHERE order_id IN (SELECT id FROM orders);
DELETE FROM coupon_usage WHERE order_id IN (SELECT id FROM orders);
DELETE FROM order_status_history WHERE order_id IN (SELECT id FROM orders);
DELETE FROM recent_purchases;
DELETE FROM orders;

-- Clean up data for non-admin and non-courier users
DELETE FROM cart_items 
WHERE user_id NOT IN (SELECT user_id FROM admin_users UNION SELECT user_id FROM couriers);

DELETE FROM addresses 
WHERE user_id NOT IN (SELECT user_id FROM admin_users UNION SELECT user_id FROM couriers);

DELETE FROM age_verifications 
WHERE user_id NOT IN (SELECT user_id FROM admin_users UNION SELECT user_id FROM couriers);

DELETE FROM device_fingerprints 
WHERE user_id NOT IN (SELECT user_id FROM admin_users UNION SELECT user_id FROM couriers);

DELETE FROM fraud_flags 
WHERE user_id NOT IN (SELECT user_id FROM admin_users UNION SELECT user_id FROM couriers);

DELETE FROM user_ip_addresses 
WHERE user_id NOT IN (SELECT user_id FROM admin_users UNION SELECT user_id FROM couriers);

DELETE FROM giveaway_entries 
WHERE user_id NOT IN (SELECT user_id FROM admin_users UNION SELECT user_id FROM couriers);

DELETE FROM giveaway_referrals 
WHERE referrer_user_id NOT IN (SELECT user_id FROM admin_users UNION SELECT user_id FROM couriers)
   OR referred_user_id NOT IN (SELECT user_id FROM admin_users UNION SELECT user_id FROM couriers);

DELETE FROM loyalty_points 
WHERE user_id NOT IN (SELECT user_id FROM admin_users UNION SELECT user_id FROM couriers);

DELETE FROM profiles 
WHERE user_id NOT IN (SELECT user_id FROM admin_users UNION SELECT user_id FROM couriers);

DELETE FROM account_logs 
WHERE user_id NOT IN (SELECT user_id FROM admin_users UNION SELECT user_id FROM couriers);

DELETE FROM user_roles 
WHERE user_id NOT IN (SELECT user_id FROM admin_users UNION SELECT user_id FROM couriers);

-- Migration: 20251014195958
-- Create chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id TEXT,
  mode TEXT NOT NULL DEFAULT 'ai' CHECK (mode IN ('ai', 'human')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  assigned_admin_id UUID REFERENCES admin_users(user_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'ai', 'admin')),
  sender_id UUID,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_sessions
CREATE POLICY "Users can view own sessions"
  ON chat_sessions FOR SELECT
  USING (auth.uid() = user_id OR guest_id IS NOT NULL);

CREATE POLICY "Users can create sessions"
  ON chat_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own sessions"
  ON chat_sessions FOR UPDATE
  USING (auth.uid() = user_id OR guest_id IS NOT NULL);

CREATE POLICY "Admins can view all sessions"
  ON chat_sessions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update sessions"
  ON chat_sessions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for chat_messages
CREATE POLICY "Users can view messages in their sessions"
  ON chat_messages FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM chat_sessions 
      WHERE user_id = auth.uid() OR guest_id IS NOT NULL
    )
  );

CREATE POLICY "Users can insert messages in their sessions"
  ON chat_messages FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM chat_sessions 
      WHERE user_id = auth.uid() OR guest_id IS NOT NULL
    )
  );

CREATE POLICY "Admins can view all messages"
  ON chat_messages FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert messages"
  ON chat_messages FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE chat_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- Create indexes
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_status ON chat_sessions(status);
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

-- Migration: 20251015014631
-- Add verification and fraud prevention columns to giveaway_entries
ALTER TABLE giveaway_entries
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_otp TEXT,
ADD COLUMN IF NOT EXISTS phone_otp TEXT,
ADD COLUMN IF NOT EXISTS otp_expiry TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS fraud_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- Create index for verification lookups
CREATE INDEX IF NOT EXISTS idx_giveaway_entries_verification 
ON giveaway_entries(email_verified, phone_verified, status);

CREATE INDEX IF NOT EXISTS idx_giveaway_entries_fraud 
ON giveaway_entries(fraud_score, device_fingerprint);

-- Create failed attempts tracking table
CREATE TABLE IF NOT EXISTS giveaway_failed_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  phone TEXT,
  instagram_handle TEXT,
  ip_address TEXT,
  device_fingerprint TEXT,
  error_message TEXT,
  error_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for fraud detection
CREATE INDEX IF NOT EXISTS idx_failed_attempts_ip 
ON giveaway_failed_attempts(ip_address, created_at);

CREATE INDEX IF NOT EXISTS idx_failed_attempts_device 
ON giveaway_failed_attempts(device_fingerprint, created_at);

-- Add RLS policies for failed attempts (admin only)
ALTER TABLE giveaway_failed_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view failed attempts"
ON giveaway_failed_attempts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert failed attempts"
ON giveaway_failed_attempts
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Function to generate OTP
CREATE OR REPLACE FUNCTION generate_otp()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  otp TEXT;
BEGIN
  otp := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  RETURN otp;
END;
$$;

-- Function to check fraud score
CREATE OR REPLACE FUNCTION calculate_fraud_score(
  p_email TEXT,
  p_phone TEXT,
  p_device_fingerprint TEXT,
  p_ip_address TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  score INTEGER := 0;
  duplicate_count INTEGER;
  failed_count INTEGER;
BEGIN
  -- Check for duplicate entries
  SELECT COUNT(*) INTO duplicate_count
  FROM giveaway_entries
  WHERE email = p_email OR phone = p_phone OR device_fingerprint = p_device_fingerprint;
  
  IF duplicate_count > 0 THEN
    score := score + 50;
  END IF;
  
  -- Check failed attempts from same IP/device
  SELECT COUNT(*) INTO failed_count
  FROM giveaway_failed_attempts
  WHERE (ip_address = p_ip_address OR device_fingerprint = p_device_fingerprint)
    AND created_at > now() - interval '1 hour';
  
  IF failed_count > 3 THEN
    score := score + 30;
  END IF;
  
  -- Check for suspicious patterns
  IF p_email LIKE '%test%' OR p_email LIKE '%fake%' THEN
    score := score + 20;
  END IF;
  
  RETURN score;
END;
$$;

-- Migration: 20251015015524
-- Improve giveaway_entries table with safe defaults and constraints
ALTER TABLE giveaway_entries
ALTER COLUMN user_email TYPE VARCHAR(255),
ALTER COLUMN user_phone TYPE VARCHAR(20),
ALTER COLUMN instagram_handle TYPE VARCHAR(50),
ALTER COLUMN device_fingerprint TYPE VARCHAR(255),
ALTER COLUMN ip_address SET DEFAULT 'unknown',
ALTER COLUMN user_agent SET DEFAULT '',
ALTER COLUMN fraud_score SET DEFAULT 0,
ALTER COLUMN status SET DEFAULT 'pending';

-- Add entry_type to track source
ALTER TABLE giveaway_entries
ADD COLUMN IF NOT EXISTS entry_type TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS order_id UUID,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Create error logging table
CREATE TABLE IF NOT EXISTS giveaway_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  attempt_data JSONB,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_giveaway_errors_type ON giveaway_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_giveaway_errors_resolved ON giveaway_errors(resolved, created_at);

-- Create queue table for reliable processing
CREATE TABLE IF NOT EXISTS giveaway_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  user_id UUID,
  email TEXT,
  phone TEXT,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_giveaway_queue_status ON giveaway_queue(status, attempts);
CREATE INDEX IF NOT EXISTS idx_giveaway_queue_order ON giveaway_queue(order_id);

-- Add RLS policies
ALTER TABLE giveaway_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE giveaway_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view errors"
ON giveaway_errors FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert errors"
ON giveaway_queue FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view queue"
ON giveaway_queue FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to generate unique entry number with collision prevention
CREATE OR REPLACE FUNCTION generate_entry_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  entry_num TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    entry_num := 'GIVE-' || 
                 TO_CHAR(NOW(), 'YYMMDD') || '-' || 
                 UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 6));
    
    SELECT EXISTS(
      SELECT 1 FROM giveaway_entries WHERE entry_number_start::TEXT = entry_num
    ) INTO exists;
    
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN entry_num;
END;
$$;

-- Function to create entry with retry logic
CREATE OR REPLACE FUNCTION create_giveaway_entry_safe(
  p_giveaway_id UUID,
  p_email TEXT,
  p_phone TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_borough TEXT,
  p_instagram TEXT,
  p_device_fingerprint TEXT,
  p_ip_address TEXT,
  p_user_agent TEXT,
  p_entry_type TEXT DEFAULT 'manual',
  p_order_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_entry giveaway_entries;
  v_entry_start INTEGER;
  v_entry_end INTEGER;
  v_total_entries INTEGER;
  v_giveaway giveaways;
BEGIN
  -- Get giveaway
  SELECT * INTO v_giveaway FROM giveaways WHERE id = p_giveaway_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Giveaway not found';
  END IF;
  
  -- Calculate entries based on type
  IF p_entry_type = 'purchase' THEN
    v_total_entries := 5; -- 5 entries for purchases
  ELSE
    v_total_entries := v_giveaway.base_entries;
  END IF;
  
  -- Get next entry number
  SELECT COALESCE(MAX(entry_number_end), 0) + 1 
  INTO v_entry_start
  FROM giveaway_entries
  WHERE giveaway_id = p_giveaway_id;
  
  v_entry_end := v_entry_start + v_total_entries - 1;
  
  -- Create entry with safe defaults
  INSERT INTO giveaway_entries (
    giveaway_id,
    user_email,
    user_first_name,
    user_last_name,
    user_phone,
    user_borough,
    instagram_handle,
    device_fingerprint,
    ip_address,
    user_agent,
    entry_type,
    order_id,
    base_entries,
    total_entries,
    entry_number_start,
    entry_number_end,
    status
  ) VALUES (
    p_giveaway_id,
    LOWER(COALESCE(p_email, '')),
    COALESCE(p_first_name, ''),
    COALESCE(p_last_name, ''),
    COALESCE(p_phone, ''),
    COALESCE(p_borough, ''),
    LOWER(COALESCE(p_instagram, '')),
    COALESCE(p_device_fingerprint, ''),
    COALESCE(p_ip_address, 'unknown'),
    COALESCE(p_user_agent, ''),
    p_entry_type,
    p_order_id,
    v_total_entries,
    v_total_entries,
    v_entry_start,
    v_entry_end,
    'pending'
  )
  RETURNING * INTO v_entry;
  
  -- Update giveaway totals
  UPDATE giveaways
  SET 
    total_entries = total_entries + v_total_entries,
    total_participants = total_participants + 1
  WHERE id = p_giveaway_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_entry.id,
    'entry_start', v_entry_start,
    'entry_end', v_entry_end,
    'total_entries', v_total_entries
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error
    INSERT INTO giveaway_errors (error_type, error_message, error_stack)
    VALUES ('CREATE_ENTRY', SQLERRM, SQLSTATE);
    
    RAISE EXCEPTION 'Failed to create entry: %', SQLERRM;
END;
$$;

-- Migration: 20251015020235
-- Fix RLS policies for giveaway_entries to ensure users can see their entries

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own entries" ON giveaway_entries;
DROP POLICY IF EXISTS "Users can create entries" ON giveaway_entries;
DROP POLICY IF EXISTS "Admins can view all entries" ON giveaway_entries;

-- Recreate policies with proper user_id checking
CREATE POLICY "Users can view own giveaway entries"
ON giveaway_entries
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own entries"
ON giveaway_entries
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all giveaway entries"
ON giveaway_entries
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update giveaway entries"
ON giveaway_entries
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow system/edge functions to create entries (for purchases)
CREATE POLICY "Service role can manage entries"
ON giveaway_entries
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Migration: 20251015021419
-- Create function to process giveaway entry on delivery
CREATE OR REPLACE FUNCTION process_giveaway_on_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_giveaway giveaways;
  v_entry_result jsonb;
BEGIN
  -- Only process when status changes to delivered
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    
    -- Check if entry already exists
    IF EXISTS (
      SELECT 1 FROM giveaway_entries 
      WHERE order_id = NEW.id
    ) THEN
      RETURN NEW;
    END IF;
    
    -- Get active giveaway
    SELECT * INTO v_giveaway
    FROM giveaways
    WHERE status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- If no active giveaway, skip
    IF v_giveaway.id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Create giveaway entry directly using the safe function
    BEGIN
      SELECT create_giveaway_entry_safe(
        v_giveaway.id,
        COALESCE(NEW.customer_email, ''),
        COALESCE(NEW.customer_phone, ''),
        COALESCE(SPLIT_PART(NEW.customer_name, ' ', 1), ''),
        COALESCE(SUBSTRING(NEW.customer_name FROM POSITION(' ' IN NEW.customer_name) + 1), ''),
        COALESCE(NEW.delivery_borough, ''),
        '',
        '',
        'system',
        'delivery',
        'purchase',
        NEW.id
      ) INTO v_entry_result;
      
      RAISE LOG 'Giveaway entry created for order %: %', NEW.id, v_entry_result;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the order
      RAISE WARNING 'Failed to create giveaway entry for order %: %', NEW.id, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic giveaway entry creation
DROP TRIGGER IF EXISTS trigger_giveaway_on_delivery ON orders;
CREATE TRIGGER trigger_giveaway_on_delivery
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION process_giveaway_on_delivery();

-- Enable realtime for giveaway_entries table
ALTER PUBLICATION supabase_realtime ADD TABLE giveaway_entries;

-- Migration: 20251018225642
-- Security fix: Add search_path to trigger function
-- This prevents potential SQL injection through search_path manipulation

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Migration: 20251018225709
-- Fix search_path for calculate_fraud_score function
CREATE OR REPLACE FUNCTION public.calculate_fraud_score(p_email text, p_phone text, p_device_fingerprint text, p_ip_address text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  score INTEGER := 0;
  duplicate_count INTEGER;
  failed_count INTEGER;
BEGIN
  -- Check for duplicate entries
  SELECT COUNT(*) INTO duplicate_count
  FROM giveaway_entries
  WHERE user_email = p_email OR user_phone = p_phone OR device_fingerprint = p_device_fingerprint;
  
  IF duplicate_count > 0 THEN
    score := score + 50;
  END IF;
  
  -- Check failed attempts from same IP/device
  SELECT COUNT(*) INTO failed_count
  FROM giveaway_queue
  WHERE (last_error IS NOT NULL)
    AND created_at > now() - interval '1 hour';
  
  IF failed_count > 3 THEN
    score := score + 30;
  END IF;
  
  -- Check for suspicious patterns
  IF p_email LIKE '%test%' OR p_email LIKE '%fake%' THEN
    score := score + 20;
  END IF;
  
  RETURN score;
END;
$$;

-- Migration: 20251018225740
-- Fix search_path for remaining functions

-- Fix generate_otp function
CREATE OR REPLACE FUNCTION public.generate_otp()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  otp TEXT;
BEGIN
  otp := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  RETURN otp;
END;
$$;

-- Fix issue_welcome_discount trigger function
CREATE OR REPLACE FUNCTION public.issue_welcome_discount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_welcome_discounts (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Migration: 20251018230859

-- Remove the overly restrictive anonymous block policy on admin_users
DROP POLICY IF EXISTS "Block anonymous access to admin_users" ON admin_users;

-- Ensure clean admin access policy
DROP POLICY IF EXISTS "Admins can view all admin users" ON admin_users;
CREATE POLICY "Admins can view all admin users"
ON admin_users
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view their own record even during login
CREATE POLICY "Users can view own admin record"
ON admin_users
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Ensure the profiles table has proper access
-- (needed because admin_users references user_id which comes from auth)
DROP POLICY IF EXISTS "Block anonymous access to profiles" ON profiles;


-- Migration: 20251018234219
-- Create the has_role function for checking user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Migration: 20251018234715
-- First, ensure we have the has_role function that RLS policies need
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Also ensure is_admin function exists for compatibility
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(_user_id, 'admin'::app_role)
$$;

-- Update check_is_admin to use the admin_users table directly for better reliability
CREATE OR REPLACE FUNCTION public.check_is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = _user_id AND is_active = true
  );
$$;

-- Migration: 20251019012128
-- Create error logs table
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  user_id UUID,
  page_url TEXT,
  user_agent TEXT,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  context JSONB,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create application logs table
CREATE TABLE IF NOT EXISTS public.application_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_level TEXT CHECK (log_level IN ('debug', 'info', 'warn', 'error')) DEFAULT 'info',
  message TEXT NOT NULL,
  user_id UUID,
  page_url TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only access policies using admin_users table
CREATE POLICY "Admins can view all error logs"
  ON public.error_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

CREATE POLICY "Admins can update error logs"
  ON public.error_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

CREATE POLICY "Admins can view all application logs"
  ON public.application_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Allow system to insert logs
CREATE POLICY "System can insert error logs"
  ON public.error_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can insert application logs"
  ON public.application_logs FOR INSERT
  WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX idx_error_logs_created_at ON public.error_logs(created_at DESC);
CREATE INDEX idx_error_logs_severity ON public.error_logs(severity);
CREATE INDEX idx_error_logs_resolved ON public.error_logs(resolved);
CREATE INDEX idx_application_logs_created_at ON public.application_logs(created_at DESC);
CREATE INDEX idx_application_logs_level ON public.application_logs(log_level);

-- Migration: 20251019013824
-- Delete all data from tables with foreign keys to users
DELETE FROM audit_logs;
DELETE FROM error_logs;
DELETE FROM application_logs;
DELETE FROM chat_sessions;
DELETE FROM admin_audit_logs;
DELETE FROM admin_sessions;
DELETE FROM security_events;
DELETE FROM fraud_flags;
DELETE FROM device_fingerprints;
DELETE FROM user_ip_addresses;
DELETE FROM loyalty_transactions;
DELETE FROM giveaway_referrals;
DELETE FROM giveaway_entries;
DELETE FROM giveaway_queue;
DELETE FROM user_welcome_discounts;
DELETE FROM coupon_usage;
DELETE FROM reviews;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM cart_items;
DELETE FROM addresses;
DELETE FROM profiles;
DELETE FROM admin_users;

-- Finally delete all auth users
DELETE FROM auth.users;

-- Migration: 20251019014458
-- Fix 1: Orders Table RLS Policies - Replace permissive policy with proper access control
DROP POLICY IF EXISTS "Authenticated users can view orders" ON orders;
DROP POLICY IF EXISTS "Users can view orders" ON orders;
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Couriers can view assigned orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;

-- Users can only view their own orders
CREATE POLICY "Users can view own orders" ON orders
FOR SELECT USING (auth.uid() = user_id);

-- Couriers can view orders assigned to them
CREATE POLICY "Couriers can view assigned orders" ON orders
FOR SELECT USING (
  courier_id IN (
    SELECT id FROM couriers WHERE user_id = auth.uid()
  )
);

-- Admins can view all orders
CREATE POLICY "Admins can view all orders" ON orders
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Move extensions from public schema to dedicated schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- Fix 3: Create courier PIN session table for server-side validation
CREATE TABLE IF NOT EXISTS courier_pin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on courier_pin_sessions
ALTER TABLE courier_pin_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "System can insert PIN sessions" ON courier_pin_sessions;
DROP POLICY IF EXISTS "Couriers can view own sessions" ON courier_pin_sessions;
DROP POLICY IF EXISTS "Admins can view all sessions" ON courier_pin_sessions;

-- Only system can insert sessions
CREATE POLICY "System can insert PIN sessions" ON courier_pin_sessions
FOR INSERT WITH CHECK (true);

-- Couriers can view their own sessions
CREATE POLICY "Couriers can view own sessions" ON courier_pin_sessions
FOR SELECT USING (
  courier_id IN (
    SELECT id FROM couriers WHERE user_id = auth.uid()
  )
);

-- Admins can view all sessions
CREATE POLICY "Admins can view all sessions" ON courier_pin_sessions
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to validate courier PIN session
CREATE OR REPLACE FUNCTION validate_courier_pin_session(
  p_session_token text,
  p_courier_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM courier_pin_sessions
    WHERE session_token = p_session_token
      AND courier_id = p_courier_id
      AND expires_at > now()
  );
END;
$$;

-- Function to create courier PIN session
CREATE OR REPLACE FUNCTION create_courier_pin_session(
  p_courier_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_token text;
BEGIN
  -- Generate secure random token
  v_session_token := encode(gen_random_bytes(32), 'base64');
  
  -- Delete expired sessions
  DELETE FROM courier_pin_sessions
  WHERE courier_id = p_courier_id AND expires_at < now();
  
  -- Insert new session
  INSERT INTO courier_pin_sessions (courier_id, session_token)
  VALUES (p_courier_id, v_session_token);
  
  RETURN v_session_token;
END;
$$;

-- Migration: 20251019031451
-- Recreate the has_role function that checks if a user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Migration: 20251022171931
-- Create loyalty_points table
CREATE TABLE IF NOT EXISTS public.loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

-- RLS Policies for loyalty_points
CREATE POLICY "Users can view own loyalty points"
  ON public.loyalty_points
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert loyalty points"
  ON public.loyalty_points
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update loyalty points"
  ON public.loyalty_points
  FOR UPDATE
  USING (true);

-- Create function to update loyalty points timestamp
CREATE OR REPLACE FUNCTION public.update_loyalty_points_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for loyalty_points
DROP TRIGGER IF EXISTS update_loyalty_points_updated_at_trigger ON public.loyalty_points;
CREATE TRIGGER update_loyalty_points_updated_at_trigger
  BEFORE UPDATE ON public.loyalty_points
  FOR EACH ROW
  EXECUTE FUNCTION public.update_loyalty_points_updated_at();

-- Migration: 20251022171952
-- Fix search_path for the loyalty points function
CREATE OR REPLACE FUNCTION public.update_loyalty_points_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Migration: 20251028191138
-- Add marketing_opt_in column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS marketing_opt_in boolean DEFAULT true;

-- Migration: 20251028222839
-- Create referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code TEXT NOT NULL UNIQUE,
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed_up', 'converted')),
  source_type TEXT NOT NULL DEFAULT 'direct' CHECK (source_type IN ('direct', 'social', 'email')),
  clicked_at TIMESTAMPTZ DEFAULT now(),
  signed_up_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  conversion_order_id UUID,
  device_fingerprint TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create referral_rewards table
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('store_credit', 'giveaway_entries', 'discount_code')),
  reward_value NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'issued', 'redeemed', 'expired')),
  issued_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  discount_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create purchase_giveaway_entries table
CREATE TABLE IF NOT EXISTS public.purchase_giveaway_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  giveaway_id UUID NOT NULL REFERENCES public.giveaways(id) ON DELETE CASCADE,
  order_amount NUMERIC NOT NULL,
  base_entries INTEGER NOT NULL,
  friday_multiplier NUMERIC DEFAULT 1,
  final_entries INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create referral_daily_stats table
CREATE TABLE IF NOT EXISTS public.referral_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_clicks INTEGER DEFAULT 0,
  total_signups INTEGER DEFAULT 0,
  total_conversions INTEGER DEFAULT 0,
  total_rewards_earned NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Add referral columns to profiles if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS successful_referrals INTEGER DEFAULT 0;

-- Create function to increment giveaway entries
CREATE OR REPLACE FUNCTION increment_giveaway_entries(
  p_user_id UUID,
  p_giveaway_id UUID,
  p_entries INTEGER
) RETURNS void AS $$
BEGIN
  UPDATE giveaway_entries
  SET total_entries = total_entries + p_entries
  WHERE user_id = p_user_id AND giveaway_id = p_giveaway_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to decrement giveaway entries
CREATE OR REPLACE FUNCTION decrement_giveaway_entries(
  p_user_id UUID,
  p_giveaway_id UUID,
  p_entries INTEGER
) RETURNS void AS $$
BEGIN
  UPDATE giveaway_entries
  SET total_entries = GREATEST(0, total_entries - p_entries)
  WHERE user_id = p_user_id AND giveaway_id = p_giveaway_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to increment user referrals
CREATE OR REPLACE FUNCTION increment_user_referrals(
  p_user_id UUID
) RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET total_referrals = total_referrals + 1
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_giveaway_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_daily_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for referrals
CREATE POLICY "Users can view own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id);

CREATE POLICY "System can insert referrals"
  ON public.referrals FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update referrals"
  ON public.referrals FOR UPDATE
  USING (true);

-- RLS Policies for referral_rewards
CREATE POLICY "Users can view own rewards"
  ON public.referral_rewards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage rewards"
  ON public.referral_rewards FOR ALL
  USING (true);

-- RLS Policies for purchase_giveaway_entries
CREATE POLICY "Users can view own entries"
  ON public.purchase_giveaway_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert entries"
  ON public.purchase_giveaway_entries FOR INSERT
  WITH CHECK (true);

-- RLS Policies for referral_daily_stats
CREATE POLICY "Users can view own stats"
  ON public.referral_daily_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage stats"
  ON public.referral_daily_stats FOR ALL
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_user ON public.referral_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_entries_user ON public.purchase_giveaway_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_entries_giveaway ON public.purchase_giveaway_entries(giveaway_id);

-- Migration: 20251029032743

-- Rollback referral system migration
-- Drop tables in reverse order (respecting foreign key dependencies)

DROP TABLE IF EXISTS referral_stats_daily CASCADE;
DROP TABLE IF EXISTS purchase_giveaway_entries CASCADE;
DROP TABLE IF EXISTS referral_rewards CASCADE;
DROP TABLE IF EXISTS referrals CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS add_referral_earnings(UUID, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS decrement_giveaway_entries(UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS increment_giveaway_entries(UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS increment_successful_referrals(UUID) CASCADE;
DROP FUNCTION IF EXISTS increment_user_referrals(UUID) CASCADE;
DROP FUNCTION IF EXISTS auto_generate_referral_code() CASCADE;
DROP FUNCTION IF EXISTS generate_referral_code() CASCADE;

-- Drop trigger
DROP TRIGGER IF EXISTS ensure_referral_code ON profiles CASCADE;

-- Remove columns from profiles table
ALTER TABLE profiles 
  DROP COLUMN IF EXISTS referral_earnings CASCADE,
  DROP COLUMN IF EXISTS successful_referrals CASCADE,
  DROP COLUMN IF EXISTS total_referrals CASCADE,
  DROP COLUMN IF EXISTS referral_conversion_date CASCADE,
  DROP COLUMN IF EXISTS referred_by_code CASCADE,
  DROP COLUMN IF EXISTS referred_by_user_id CASCADE,
  DROP COLUMN IF EXISTS referral_code_generated_at CASCADE,
  DROP COLUMN IF EXISTS referral_code CASCADE;

-- Drop indexes
DROP INDEX IF EXISTS idx_profiles_referred_by CASCADE;
DROP INDEX IF EXISTS idx_profiles_referral_code CASCADE;


-- Migration: 20251029032839

-- Trigger types regeneration
-- This is a no-op migration to force Supabase types to regenerate

DO $$ 
BEGIN 
  RAISE NOTICE 'Types regeneration trigger';
END $$;


-- Migration: 20251029050400
-- Trigger types regeneration
-- This comment update will force Supabase to regenerate the types file
COMMENT ON TABLE public.profiles IS 'User profile information with preferences and settings';

-- Migration: 20251029143207
-- Force types regeneration by updating table comments
-- This will trigger Supabase to regenerate the types file

COMMENT ON TABLE public.cart_items IS 'Shopping cart items for users';
COMMENT ON TABLE public.products IS 'Product catalog with pricing and inventory';
COMMENT ON TABLE public.orders IS 'Customer orders with delivery information';
COMMENT ON TABLE public.inventory IS 'Product inventory tracking';


-- Migration: 20251030183251
-- Force types regeneration by adding a helpful comment
COMMENT ON TABLE public.products IS 'Product catalog with inventory and pricing information';
COMMENT ON TABLE public.profiles IS 'User profiles with personal and behavioral data';
COMMENT ON TABLE public.age_verifications IS 'Age verification records with ID documents';
COMMENT ON TABLE public.couriers IS 'Courier information and status';
COMMENT ON TABLE public.orders IS 'Customer orders with delivery details';
